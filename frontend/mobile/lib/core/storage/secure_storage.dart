import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

/// Stockage sécurisé - Keystore Android / Keychain iOS.
/// Utilisé pour : tokens JWT, clés Signal, device ID.
class SecureStorageService {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _keyAccessToken  = 'access_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyDeviceId     = 'device_id';
  static const _keyUserId       = 'user_id';
  static const _keyOrgId        = 'org_id';

  // ── Tokens JWT ───────────────────────────────────────────────────────────

  Future<void> saveTokens({required String access, required String refresh}) async {
    await Future.wait([
      _storage.write(key: _keyAccessToken,  value: access),
      _storage.write(key: _keyRefreshToken, value: refresh),
    ]);
  }

  Future<String?> getAccessToken()  => _storage.read(key: _keyAccessToken);
  Future<String?> getRefreshToken() => _storage.read(key: _keyRefreshToken);

  Future<void> deleteTokens() async {
    await Future.wait([
      _storage.delete(key: _keyAccessToken),
      _storage.delete(key: _keyRefreshToken),
    ]);
  }

  // ── Session ──────────────────────────────────────────────────────────────

  Future<void> saveSession({required String userId, required String orgId}) async {
    await Future.wait([
      _storage.write(key: _keyUserId, value: userId),
      _storage.write(key: _keyOrgId,  value: orgId),
    ]);
  }

  Future<String?> getUserId() => _storage.read(key: _keyUserId);
  Future<String?> getOrgId()  => _storage.read(key: _keyOrgId);

  Future<void> clearSession() async {
    await _storage.deleteAll();
  }

  // ── Device ID (stable, généré une seule fois) ────────────────────────────

  Future<String> getDeviceId() async {
    final existing = await _storage.read(key: _keyDeviceId);
    if (existing != null) return existing;
    final newId = const Uuid().v4();
    await _storage.write(key: _keyDeviceId, value: newId);
    return newId;
  }

  // ── Clés Signal Protocol ─────────────────────────────────────────────────

  Future<void> saveSignalKey(String keyName, String value) async {
    await _storage.write(key: 'signal_$keyName', value: value);
  }

  Future<String?> getSignalKey(String keyName) async {
    return _storage.read(key: 'signal_$keyName');
  }
}
