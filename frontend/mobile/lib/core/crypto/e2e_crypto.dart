import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:encrypt/encrypt.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pointycastle/export.dart';

import '../storage/secure_storage.dart';

final e2eCryptoProvider = Provider<E2ECrypto>((ref) {
  return E2ECrypto(ref.read(secureStorageProvider));
});

/// Chiffrement E2E pour les messages et les médias.
///
/// Messages : Signal Protocol (Double Ratchet)
///   - géré par libsignal_protocol_dart
///   - ce service expose une API simplifiée par-dessus
///
/// Médias : AES-256-CBC
///   - le client génère une clé symétrique aléatoire
///   - chiffre le fichier avec cette clé
///   - envoie la clé chiffrée avec Signal dans le message
///   - le serveur ne voit que le blob opaque
class E2ECrypto {
  E2ECrypto(this._storage);

  final SecureStorageService _storage;
  final _random = Random.secure();

  // ── Chiffrement de médias (AES-256-CBC) ───────────────────────────────────

  /// Chiffre un fichier média localement avant upload.
  /// Retourne le blob chiffré et la clé AES en base64.
  MediaEncryptResult encryptMedia(Uint8List plainBytes) {
    // Générer une clé AES-256 aléatoire
    final keyBytes = Uint8List(32);
    for (var i = 0; i < 32; i++) {
      keyBytes[i] = _random.nextInt(256);
    }

    // Générer un IV aléatoire (16 bytes pour AES-CBC)
    final ivBytes = Uint8List(16);
    for (var i = 0; i < 16; i++) {
      ivBytes[i] = _random.nextInt(256);
    }

    final key       = Key(keyBytes);
    final iv        = IV(ivBytes);
    final encrypter = Encrypter(AES(key, mode: AESMode.cbc));

    final encrypted = encrypter.encryptBytes(plainBytes, iv: iv);

    // Concaténer IV + ciphertext dans le blob final
    // Format : [16 bytes IV][N bytes ciphertext]
    final blob = Uint8List(16 + encrypted.bytes.length);
    blob.setRange(0, 16, ivBytes);
    blob.setRange(16, blob.length, encrypted.bytes);

    return MediaEncryptResult(
      encryptedBlob: blob,
      mediaKey:      base64.encode(keyBytes),  // à inclure dans le message Signal
    );
  }

  /// Déchiffre un fichier média après téléchargement.
  Uint8List decryptMedia(Uint8List encryptedBlob, String mediaKeyBase64) {
    final keyBytes = base64.decode(mediaKeyBase64);
    final ivBytes  = encryptedBlob.sublist(0, 16);
    final cipher   = encryptedBlob.sublist(16);

    final key       = Key(Uint8List.fromList(keyBytes));
    final iv        = IV(Uint8List.fromList(ivBytes));
    final encrypter = Encrypter(AES(key, mode: AESMode.cbc));

    return Uint8List.fromList(
      encrypter.decryptBytes(Encrypted(Uint8List.fromList(cipher)), iv: iv),
    );
  }

  // ── Génération de clés Signal ─────────────────────────────────────────────

  /// Génère une paire de clés X25519 pour Signal Protocol.
  KeyPair generateKeyPair() {
    final params    = ECKeyGeneratorParameters(ECCurve_curve25519());
    final generator = ECKeyGenerator()..init(ParametersWithRandom(params, _secureRandom()));

    final pair = generator.generateKeyPair();
    return KeyPair(
      privateKey: base64.encode((pair.privateKey as ECPrivateKey).d!.toByteArray()),
      publicKey:  base64.encode((pair.publicKey  as ECPublicKey).Q!.getEncoded(true)),
    );
  }

  /// Génère N one-time prekeys pour Signal.
  List<PreKey> generateOneTimePrekeys({int count = 100, int startId = 0}) {
    return List.generate(count, (i) {
      final pair = generateKeyPair();
      return PreKey(keyId: startId + i, publicKey: pair.publicKey, privateKey: pair.privateKey);
    });
  }

  SecureRandom _secureRandom() {
    final secRandom = SecureRandom('Fortuna')
      ..seed(KeyParameter(
        Uint8List.fromList(List.generate(32, (_) => _random.nextInt(256)))
      ));
    return secRandom;
  }
}

class MediaEncryptResult {
  const MediaEncryptResult({required this.encryptedBlob, required this.mediaKey});
  final Uint8List encryptedBlob;
  final String    mediaKey;      // base64 de la clé AES-256
}

class KeyPair {
  const KeyPair({required this.privateKey, required this.publicKey});
  final String privateKey;
  final String publicKey;
}

class PreKey {
  const PreKey({required this.keyId, required this.publicKey, required this.privateKey});
  final int    keyId;
  final String publicKey;
  final String privateKey;
}
