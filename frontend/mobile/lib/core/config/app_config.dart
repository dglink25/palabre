/// Configuration centralisée de l'application.
/// Les URLs sont injectées via --dart-define lors du build
/// (un APK par organisation = un APK préconfiguré avec les bonnes URLs).
class AppConfig {
  AppConfig._();

  // ── API Backend ──────────────────────────────────────────────────────────
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4001/api/v1', // 10.0.2.2 = localhost depuis l'émulateur Android
  );

  // ── Message Router (WebSocket) ───────────────────────────────────────────
  static const String messageRouterUrl = String.fromEnvironment(
    'MESSAGE_ROUTER_URL',
    defaultValue: 'ws://10.0.2.2:4020/socket/websocket',
  );

  // ── Call Signal (WebSocket) ──────────────────────────────────────────────
  static const String callSignalUrl = String.fromEnvironment(
    'CALL_SIGNAL_URL',
    defaultValue: 'ws://10.0.2.2:4040/signal/websocket',
  );

  // ── Support WebSocket (Central_Server uniquement) ────────────────────────
  static const String wsBaseUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'ws://10.0.2.2:4001',
  );

  // ── File Server ──────────────────────────────────────────────────────────
  static const String fileServerUrl = String.fromEnvironment(
    'FILE_SERVER_URL',
    defaultValue: 'http://10.0.2.2:4030',
  );

  // ── WebSocket ────────────────────────────────────────────────────────────
  // Intervalle heartbeat en ms
  static const int heartbeatIntervalMs = 30000;
  // Délais de reconnexion avec backoff exponentiel
  static const List<int> reconnectDelaysMs = [1000, 2000, 5000, 10000, 30000];
}
