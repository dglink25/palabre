import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/secure_storage.dart';
import '../services/socket_service.dart';
import '../network/api_client.dart';
import '../network/network_detector.dart';
import '../crypto/signal_key_manager.dart';

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

  // Initialiser les clés E2E (non-bloquant)
  ref.read(signalKeyManagerProvider).initialize().catchError((_) {});

  // Configurer le NetworkDetector si l'utilisateur a une organisation
  if (orgId != null && orgId.isNotEmpty) {
    final detector  = ref.read(networkDetectorProvider);
    final apiClient = ref.read(apiClientProvider);
    // Récupérer l'URL du tenant depuis le serveur central
    try {
      final data = await apiClient.get<Map<String, dynamic>>('/tenants/resolve/$orgId');
      final tenantUrl = data['tenantUrl'] as String? ?? '';
      final relayUrl  = AppNetworkConfig.relayApiUrl;
      await detector.configure(tenantUrl: tenantUrl, relayUrl: relayUrl);
    } catch (_) {
      // Pas de tenant configuré → mode relais uniquement
    }
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

  // ── Téléphone OTP ─────────────────────────────────────────────────────────

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

  // ── Connexion fédérée (Google, GitHub, Facebook via Firebase) ─────────────

  Future<void> loginWithFederated({required String idToken}) async {
    final deviceId = await _ref.read(secureStorageProvider).getDeviceId();

    final data = await _ref.read(apiClientProvider).post<Map<String, dynamic>>(
      '/auth/federated/login',
      data: {
        'idToken':           idToken,
        'deviceFingerprint': deviceId,
        'platform':          'flutter',
        'model':             'mobile',
      },
    );

    await _saveSession(data);
  }

  // ── Activation compte organisation ────────────────────────────────────────

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

  // ── Session ───────────────────────────────────────────────────────────────

  Future<void> _saveSession(Map<String, dynamic> data) async {
    final storage = _ref.read(secureStorageProvider);
    await storage.saveTokens(
      access:  data['accessToken'],
      refresh: data['refreshToken'],
    );
    final orgId = data['user']?['orgId'] as String?
        ?? data['user']?['org'] as String?
        ?? data['organization']?['id'] as String?
        ?? '';
    await storage.saveSession(
      userId: data['user']['id'],
      orgId:  orgId,
    );

    // Connecter le WebSocket
    final token  = data['accessToken'] as String;
    final userId = data['user']['id'] as String;
    await _ref.read(socketServiceProvider).connect(userId, orgId, token);

    // Initialiser les clés E2E Signal (non-bloquant)
    _ref.read(signalKeyManagerProvider).initialize().catchError((_) {});

    // Configurer le NetworkDetector si organisation connue
    if (orgId.isNotEmpty) {
      try {
        final apiData = await _ref.read(apiClientProvider)
            .get<Map<String, dynamic>>('/tenants/resolve/$orgId');
        final tenantUrl = apiData['tenantUrl'] as String? ?? '';
        await _ref.read(networkDetectorProvider).configure(
          tenantUrl: tenantUrl,
          relayUrl:  AppNetworkConfig.relayApiUrl,
        );
      } catch (_) { /* pas de tenant → relay only */ }
    }

    _ref.invalidate(authStateProvider);
  }

  /// Mise à jour de l'orgId après liaison organisation réussie.
  Future<void> updateOrgId(String orgId) async {
    final storage = _ref.read(secureStorageProvider);
    final userId  = await storage.getUserId() ?? '';
    await storage.saveSession(userId: userId, orgId: orgId);
    _ref.invalidate(authStateProvider);
  }

  Future<void> logout() async {
    try {
      await _ref.read(apiClientProvider).post('/auth/logout');
    } catch (_) {}
    await _ref.read(secureStorageProvider).clearSession();
    _ref.read(networkDetectorProvider).suspend();
    _ref.read(signalKeyManagerProvider).clearSessions();
    _ref.invalidate(authStateProvider);
  }
}

/// URL de configuration réseau (accès statique pour le NetworkDetector)
class AppNetworkConfig {
  static const String relayApiUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4001/api/v1',
  );
}
