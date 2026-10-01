import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';

import '../storage/secure_storage.dart';

/// Modes de connexion possibles.
enum ConnectionMode { direct, relay, unavailable }


final networkDetectorProvider = Provider<NetworkDetector>((ref) {
  final detector = NetworkDetector(ref.read(secureStorageProvider));
  ref.onDispose(detector.dispose);
  return detector;
});

class NetworkDetector {
  NetworkDetector(this._storage);

  final SecureStorageService _storage;

  // Configuration
  static const Duration _probeTimeout   = Duration(seconds: 3);
  static const Duration _probeInterval  = Duration(seconds: 30);
  static const Duration _switchDelay    = Duration(seconds: 5);

  // État
  ConnectionMode _mode   = ConnectionMode.relay;
  String? _tenantUrl;   // https://{org}.palabre.com
  String  _relayUrl     = '';
  bool    _suspended    = false;
  Timer?  _probeTimer;

  // Listeners
  final _modeController = StreamController<ConnectionMode>.broadcast();

  /// Stream de changements de mode (pour l'UI).
  Stream<ConnectionMode> get modeStream => _modeController.stream;

  ConnectionMode get currentMode => _mode;
  bool get isTenantConfigured   => _tenantUrl != null && _tenantUrl!.isNotEmpty;

  // ── Configuration ─────────────────────────────────────────────────────────

  /// À appeler après la connexion de l'utilisateur, une fois l'orgId connu.
  Future<void> configure({required String tenantUrl, required String relayUrl}) async {
    _tenantUrl = tenantUrl.isNotEmpty ? tenantUrl : null;
    _relayUrl  = relayUrl;
    await probe();
  }

  /// Retourne l'URL de base active selon le mode courant.
  String getActiveBaseUrl() {
    if (_mode == ConnectionMode.direct && _tenantUrl != null) {
      return '$_tenantUrl/api/v1';
    }
    return _relayUrl;
  }

  // ── Probe ─────────────────────────────────────────────────────────────────

  /// Émet une probe vers le Tenant_Server.
  /// Le FQDN est résolu via le DNS local → IP LAN si sur le réseau interne.
  /// Timeout → basculement vers Relay_Mode.
  Future<void> probe() async {
    if (_suspended || _tenantUrl == null) {
      _setMode(ConnectionMode.relay);
      return;
    }

    final probeUrl = '$_tenantUrl/health';
    try {
      final dio = Dio(BaseOptions(
        connectTimeout: _probeTimeout,
        receiveTimeout: _probeTimeout,
      ));
      final response = await dio.get(probeUrl);
      if (response.statusCode == 200) {
        _setMode(ConnectionMode.direct);
        _stopProbeTimer();
      } else {
        await _switchToRelay();
      }
    } catch (_) {
      await _switchToRelay();
    }
  }

  Future<void> _switchToRelay() async {
    // Vérifier que le serveur central est joignable
    bool relayReachable = false;
    for (int i = 0; i < 3; i++) {
      try {
        final relayHealth = _relayUrl.replaceAll('/api/v1', '');
        final dio = Dio(BaseOptions(
          connectTimeout: _probeTimeout,
          receiveTimeout: _probeTimeout,
        ));
        final response = await dio.get('$relayHealth/health');
        if (response.statusCode == 200) {
          relayReachable = true;
          break;
        }
      } catch (_) { /* retry */ }
      if (i < 2) await Future.delayed(Duration(seconds: _switchDelay.inSeconds ~/ 3));
    }

    if (relayReachable) {
      _setMode(ConnectionMode.relay);
      _startProbeTimer(); // re-probe le tenant toutes les 30s
    } else {
      _setMode(ConnectionMode.unavailable);
      // Réessayer dans 60s
      Future.delayed(const Duration(seconds: 60), probe);
    }
  }

  // ── Timer ─────────────────────────────────────────────────────────────────

  void _startProbeTimer() {
    _stopProbeTimer();
    _probeTimer = Timer.periodic(_probeInterval, (_) {
      if (!_suspended) probe();
    });
  }

  void _stopProbeTimer() {
    _probeTimer?.cancel();
    _probeTimer = null;
  }

  // ── Arrière-plan ──────────────────────────────────────────────────────────

  void suspend() {
    _suspended = true;
    _stopProbeTimer();
  }

  void resume() {
    _suspended = false;
    probe();
    if (_mode == ConnectionMode.relay) _startProbeTimer();
  }

  // ── Mode ─────────────────────────────────────────────────────────────────

  void _setMode(ConnectionMode newMode) {
    if (newMode == _mode) return;
    _mode = newMode;
    _modeController.add(newMode);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  void dispose() {
    _stopProbeTimer();
    _modeController.close();
  }
}
