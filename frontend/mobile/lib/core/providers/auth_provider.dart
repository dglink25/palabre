import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/secure_storage.dart';
import '../services/socket_service.dart';
import '../network/api_client.dart';

final authStateProvider = FutureProvider<AuthState>((ref) async {
  final storage = ref.read(secureStorageProvider);
  final token   = await storage.getAccessToken();
  final userId  = await storage.getUserId();
  final orgId   = await storage.getOrgId();

  if (token == null || userId == null) {
    return const AuthState(isAuthenticated: false);
  }

  // Connecter le WebSocket si on a un token valide
  final socket = ref.read(socketServiceProvider);
  if (!socket.isConnected) {
    await socket.connect(userId, orgId ?? '', token);
  }

  return AuthState(isAuthenticated: true, userId: userId, orgId: orgId);
});

class AuthState {
  const AuthState({
    required this.isAuthenticated,
    this.userId,
    this.orgId,
  });

  final bool    isAuthenticated;
  final String? userId;
  final String? orgId;
}

// ── Actions d'authentification ────────────────────────────────────────────────

final authActionsProvider = Provider<AuthActions>((ref) => AuthActions(ref));

class AuthActions {
  AuthActions(this._ref);
  final Ref _ref;

  Future<void> loginWithPhone(String phoneE164) async {
    await _ref.read(apiClientProvider).post('/auth/phone/request', data: {
      'phoneE164': phoneE164,
      'purpose':   'login',
    });
  }

  Future<void> verifyOtp({required String phoneE164, required String code}) async {
    final deviceId = await _ref.read(secureStorageProvider).getDeviceId();

    final data = await _ref.read(apiClientProvider).post<Map<String, dynamic>>(
      '/auth/phone/verify',
      data: {
        'phoneE164':         phoneE164,
        'code':              code,
        'purpose':           'login',
        'deviceFingerprint': deviceId,
        'platform':          'flutter',
        'model':             'mobile',
      },
    );

    await _saveSession(data);
  }

  Future<void> activateOrg({required String orgId, required String code}) async {
    final deviceId = await _ref.read(secureStorageProvider).getDeviceId();

    final data = await _ref.read(apiClientProvider).post<Map<String, dynamic>>(
      '/onboarding/invitations/activate',
      data: {
        'organizationId':    orgId,
        'code':              code,
        'deviceFingerprint': deviceId,
        'platform':          'flutter',
      },
    );

    await _saveSession(data);
  }

  Future<void> _saveSession(Map<String, dynamic> data) async {
    final storage = _ref.read(secureStorageProvider);
    await storage.saveTokens(
      access:  data['accessToken'],
      refresh: data['refreshToken'],
    );
    await storage.saveSession(
      userId: data['user']['id'],
      orgId:  data['user']['org'] ?? '',
    );

    // Connecter le WebSocket
    final token  = data['accessToken'] as String;
    final userId = data['user']['id'] as String;
    final orgId  = data['user']['org'] as String? ?? '';
    await _ref.read(socketServiceProvider).connect(userId, orgId, token);

    _ref.invalidate(authStateProvider);
  }

  Future<void> logout() async {
    try {
      await _ref.read(apiClientProvider).post('/auth/logout');
    } catch (_) {}
    await _ref.read(secureStorageProvider).clearSession();
    _ref.invalidate(authStateProvider);
  }
}
