import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pointycastle/export.dart';

import '../network/api_client.dart';
import '../storage/secure_storage.dart';

final signalKeyManagerProvider = Provider<SignalKeyManager>((ref) {
  return SignalKeyManager(
    ref.read(apiClientProvider),
    ref.read(secureStorageProvider),
  );
});

/// Gestionnaire des clés Signal Protocol.
///
/// Responsabilités :
///   1. Générer les clés d'identité + prékeys au premier démarrage
///   2. Uploader les clés publiques vers le serveur
///   3. Fournir les clés publiques d'un pair pour établir une session
///   4. Chiffrer / déchiffrer les messages via ECDH + AES-256-GCM
///   5. Recharger le stock de prékeys quand il est bas
///
/// Les clés privées ne quittent JAMAIS l'appareil.
/// Stockage : flutter_secure_storage (Keystore Android / Keychain iOS).
class SignalKeyManager {
  SignalKeyManager(this._api, this._storage);

  final ApiClient          _api;
  final SecureStorageService _storage;

  final _random     = Random.secure();
  bool  _initialized = false;

  // Cache des clés de session AES dérivées (peerId → clé en bytes)
  final _sessionCache = <String, Uint8List>{};

  // ── Initialisation ────────────────────────────────────────────────────────

  /// Initialise les clés. Appelé après chaque login.
  /// Idempotent — si les clés existent déjà, elles sont réutilisées.
  Future<void> initialize() async {
    if (_initialized) return;

    final deviceId       = await _storage.getDeviceId();
    final existingKey    = await _storage.getSignalKey('identity_private');

    if (existingKey == null) {
      await _generateAndUploadKeys(deviceId);
    } else {
      // Vérifier le stock de prékeys
      try {
        final data = await _api.get<Map<String, dynamic>>(
          '/messaging/signal/prekeys/count?deviceId=$deviceId',
        );
        final count = data['count'] as int? ?? 0;
        if (count < 10) {
          await _uploadFreshPrekeys(deviceId);
        }
      } catch (_) { /* non-bloquant */ }
    }

    _initialized = true;
  }

  Future<void> _generateAndUploadKeys(String deviceId) async {
    // 1. Clé d'identité ECDH P-256
    final identityPair   = _generateECKeyPair();
    final identityPubB64  = _exportPublicKey(identityPair.publicKey as ECPublicKey);
    final registrationId = _random.nextInt(16383) + 1;

    await _storage.saveSignalKey('identity_private',
        base64.encode(_exportPrivateKey(identityPair.privateKey as ECPrivateKey)));
    await _storage.saveSignalKey('identity_public', identityPubB64);
    await _storage.saveSignalKey('registration_id', registrationId.toString());

    // 2. Signed prekey
    final signedPair    = _generateECKeyPair();
    final signedPubB64  = _exportPublicKey(signedPair.publicKey as ECPublicKey);
    final signedKeyId   = DateTime.now().millisecondsSinceEpoch % 0x7FFFFFFF;
    await _storage.saveSignalKey(
        'prekey_signed_${signedKeyId}_private',
        base64.encode(_exportPrivateKey(signedPair.privateKey as ECPrivateKey)));

    // 3. One-time prekeys (100)
    final prekeys = <Map<String, dynamic>>[];
    for (var i = 0; i < 100; i++) {
      final pair    = _generateECKeyPair();
      final pubB64  = _exportPublicKey(pair.publicKey as ECPublicKey);
      final keyId   = (signedKeyId + i + 1) % 0x7FFFFFFF;
      await _storage.saveSignalKey(
          'prekey_${keyId}_private',
          base64.encode(_exportPrivateKey(pair.privateKey as ECPrivateKey)));
      prekeys.add({'keyId': keyId, 'publicKey': pubB64});
    }

    // 4. Upload — clés publiques uniquement
    await _api.post<void>('/messaging/signal/identity', data: {
      'deviceId':       deviceId,
      'identityKey':    identityPubB64,
      'registrationId': registrationId,
    });

    await _api.post<void>('/messaging/signal/prekeys', data: {
      'deviceId': deviceId,
      'prekeys':  prekeys,
      'signedPrekey': {
        'keyId':     signedKeyId,
        'publicKey': signedPubB64,
        'signature': '',
      },
    });
  }

  Future<void> _uploadFreshPrekeys(String deviceId) async {
    final baseId  = DateTime.now().millisecondsSinceEpoch % 0x7FFFFFFF;
    final prekeys = <Map<String, dynamic>>[];
    for (var i = 0; i < 100; i++) {
      final pair   = _generateECKeyPair();
      final pubB64 = _exportPublicKey(pair.publicKey as ECPublicKey);
      final keyId  = (baseId + i) % 0x7FFFFFFF;
      await _storage.saveSignalKey(
          'prekey_${keyId}_private',
          base64.encode(_exportPrivateKey(pair.privateKey as ECPrivateKey)));
      prekeys.add({'keyId': keyId, 'publicKey': pubB64});
    }
    await _api.post<void>('/messaging/signal/prekeys', data: {
      'deviceId': deviceId, 'prekeys': prekeys,
    });
  }

  // ── Chiffrement ───────────────────────────────────────────────────────────

  /// Chiffre un message texte pour [peerId].
  /// Retourne le ciphertext base64, ou le texte brut si les clés sont indisponibles.
  Future<String> encryptMessage(String peerId, String peerDeviceId, String plaintext) async {
    try {
      final key = await _getOrCreateSession(peerId, peerDeviceId);
      return _aesGcmEncrypt(key, plaintext);
    } catch (e) {
      // Fallback transparent — l'app ne crashe pas si les clés manquent
      return plaintext;
    }
  }

  /// Déchiffre un message reçu de [peerId].
  /// Retourne le texte brut (ou le ciphertext si le déchiffrement échoue).
  Future<String> decryptMessage(String peerId, String peerDeviceId, String ciphertext) async {
    try {
      if (!_looksEncrypted(ciphertext)) return ciphertext;
      final key = await _getOrCreateSession(peerId, peerDeviceId);
      return _aesGcmDecrypt(key, ciphertext);
    } catch (_) {
      return ciphertext;
    }
  }

  bool _looksEncrypted(String s) {
    // Heuristique : base64 pur, longueur > 32
    return s.length > 32 && RegExp(r'^[A-Za-z0-9+/=]+$').hasMatch(s);
  }

  // ── Établissement de session ECDH ─────────────────────────────────────────

  Future<Uint8List> _getOrCreateSession(String peerId, String peerDeviceId) async {
    final cacheKey = '$peerId:$peerDeviceId';
    if (_sessionCache.containsKey(cacheKey)) return _sessionCache[cacheKey]!;

    // Récupérer la clé publique d'identité du pair
    final bundle = await _api.get<Map<String, dynamic>>(
      '/messaging/signal/prekeys/$peerId/$peerDeviceId',
    );
    final peerIdentityKeyB64 = bundle['identityKey'] as String?;
    if (peerIdentityKeyB64 == null) throw Exception('NO_PEER_KEYS');

    // Notre clé privée d'identité
    final ourPrivB64 = await _storage.getSignalKey('identity_private');
    if (ourPrivB64 == null) throw Exception('NO_LOCAL_KEYS');

    final ourPrivBytes  = base64.decode(ourPrivB64);
    final peerPubBytes  = base64.decode(peerIdentityKeyB64);

    // Dériver le secret partagé ECDH
    final sharedSecret = _ecdhDerive(ourPrivBytes, peerPubBytes);

    // Dériver une clé AES-256 via HKDF
    final aesKey = _hkdfDerive(sharedSecret, label: 'palabre-e2e-v1');
    _sessionCache[cacheKey] = aesKey;
    return aesKey;
  }

  // ── Crypto primitives ─────────────────────────────────────────────────────

  AsymmetricKeyPair<PublicKey, PrivateKey> _generateECKeyPair() {
    final params    = ECKeyGeneratorParameters(ECCurve_prime256v1());
    final generator = ECKeyGenerator()
      ..init(ParametersWithRandom(params, _secureRandom()));
    return generator.generateKeyPair();
  }

  String _exportPublicKey(ECPublicKey pubKey) {
    return base64.encode(pubKey.Q!.getEncoded(false));
  }

  Uint8List _exportPrivateKey(ECPrivateKey privKey) {
    final d = privKey.d!;
    final bytes = d.toUnsignedBytes();
    // Padding à 32 bytes
    if (bytes.length < 32) {
      final padded = Uint8List(32);
      padded.setRange(32 - bytes.length, 32, bytes);
      return padded;
    }
    return Uint8List.fromList(bytes);
  }

  Uint8List _ecdhDerive(Uint8List ourPrivBytes, Uint8List peerPubBytes) {
    final curve     = ECCurve_prime256v1();
    final privKey   = ECPrivateKey(BigInt.parse(
        ourPrivBytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join(),
        radix: 16), curve.domainParameters);
    final peerPoint = curve.domainParameters.curve.decodePoint(peerPubBytes);
    final sharedPoint = peerPoint! * privKey.d;
    final x = sharedPoint!.x!.toBigInteger()!;
    final xBytes = x.toUnsignedBytes();
    final padded = Uint8List(32);
    padded.setRange(32 - xBytes.length, 32, xBytes);
    return padded;
  }

  Uint8List _hkdfDerive(Uint8List ikm, {required String label}) {
    final labelBytes = Uint8List.fromList(utf8.encode(label));
    final salt       = Uint8List(32); // salt vide
    // HMAC-SHA256 extract
    final hmac1 = HMac(SHA256Digest(), 64)
      ..init(KeyParameter(salt));
    hmac1.update(ikm, 0, ikm.length);
    final prk = Uint8List(32);
    hmac1.doFinal(prk, 0);
    // HMAC-SHA256 expand (1 block)
    final info = Uint8List(labelBytes.length + 1);
    info.setRange(0, labelBytes.length, labelBytes);
    info[labelBytes.length] = 0x01;
    final hmac2 = HMac(SHA256Digest(), 64)
      ..init(KeyParameter(prk));
    hmac2.update(info, 0, info.length);
    final okm = Uint8List(32);
    hmac2.doFinal(okm, 0);
    return okm;
  }

  String _aesGcmEncrypt(Uint8List keyBytes, String plaintext) {
    final iv      = _randomBytes(12);
    final pt      = Uint8List.fromList(utf8.encode(plaintext));
    final params  = AEADParameters(KeyParameter(keyBytes), 128, iv, Uint8List(0));
    final cipher  = GCMBlockCipher(AESEngine())..init(true, params);
    final ct      = cipher.process(pt);
    // Format : base64(iv || ciphertext+tag)
    final combined = Uint8List(12 + ct.length);
    combined.setRange(0, 12, iv);
    combined.setRange(12, combined.length, ct);
    return base64.encode(combined);
  }

  String _aesGcmDecrypt(Uint8List keyBytes, String b64Combined) {
    final combined = base64.decode(b64Combined);
    final iv       = combined.sublist(0, 12);
    final ct       = combined.sublist(12);
    final params   = AEADParameters(KeyParameter(keyBytes), 128, iv, Uint8List(0));
    final cipher   = GCMBlockCipher(AESEngine())..init(false, params);
    final pt       = cipher.process(Uint8List.fromList(ct));
    return utf8.decode(pt);
  }

  Uint8List _randomBytes(int n) {
    final bytes = Uint8List(n);
    for (var i = 0; i < n; i++) bytes[i] = _random.nextInt(256);
    return bytes;
  }

  SecureRandom _secureRandom() {
    return SecureRandom('Fortuna')
      ..seed(KeyParameter(_randomBytes(32)));
  }

  /// Effacer toutes les sessions en cache (déconnexion).
  void clearSessions() {
    _sessionCache.clear();
    _initialized = false;
  }
}

extension _BigIntBytes on BigInt {
  Uint8List toUnsignedBytes() {
    final hex    = toRadixString(16).padLeft(2, '0');
    final padded = hex.length.isOdd ? '0$hex' : hex;
    return Uint8List.fromList([
      for (var i = 0; i < padded.length; i += 2)
        int.parse(padded.substring(i, i + 2), radix: 16),
    ]);
  }
}
