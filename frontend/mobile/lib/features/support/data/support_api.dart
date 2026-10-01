import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/config/app_config.dart';

final supportApiProvider = Provider<SupportApi>((ref) => SupportApi(ref));
final supportWsProvider  = Provider<SupportWebSocketClient>((ref) => SupportWebSocketClient(ref));

// ── REST API ──────────────────────────────────────────────────────────────────

class SupportApi {
  SupportApi(this._ref);
  final Ref _ref;

  ApiClient get _client => _ref.read(apiClientProvider);

  Future<Map<String, dynamic>> getStatus() =>
      _client.get<Map<String, dynamic>>('/support/status');

  Future<Map<String, dynamic>> getOrCreateSession() =>
      _client.post<Map<String, dynamic>>('/support/sessions');

  Future<Map<String, dynamic>> getMySession() =>
      _client.get<Map<String, dynamic>>('/support/sessions/me');

  Future<Map<String, dynamic>> getMessages({int? before, int limit = 50}) =>
      _client.get<Map<String, dynamic>>(
        '/support/sessions/me/messages',
        params: {
          'limit': limit.toString(),
          if (before != null) 'before': before.toString(),
        },
      );

  Future<Map<String, dynamic>> initiateCall() =>
      _client.post<Map<String, dynamic>>('/support/sessions/me/calls');

  Future<Map<String, dynamic>> hangup(String callId) =>
      _client.post<Map<String, dynamic>>('/support/sessions/me/calls/$callId/hangup');

  // ── Admin ───────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> adminGetSessions() =>
      _client.get<Map<String, dynamic>>('/support/admin/sessions');

  Future<Map<String, dynamic>> adminGetSession(String id) =>
      _client.get<Map<String, dynamic>>('/support/admin/sessions/$id');

  Future<Map<String, dynamic>> adminAnswerCall(String sessionId, String callId) =>
      _client.post<Map<String, dynamic>>('/support/admin/sessions/$sessionId/calls/$callId/answer');

  Future<Map<String, dynamic>> adminHoldCall(String sessionId, String callId) =>
      _client.post<Map<String, dynamic>>('/support/admin/sessions/$sessionId/calls/$callId/hold');

  Future<Map<String, dynamic>> adminResumeCall(String sessionId, String callId) =>
      _client.post<Map<String, dynamic>>('/support/admin/sessions/$sessionId/calls/$callId/resume');

  Future<Map<String, dynamic>> adminHangup(String sessionId, String callId) =>
      _client.post<Map<String, dynamic>>('/support/admin/sessions/$sessionId/calls/$callId/hangup');

  Future<Map<String, dynamic>> adminStartVideo(String sessionId) =>
      _client.post<Map<String, dynamic>>('/support/admin/sessions/$sessionId/videoconference');

  Future<Map<String, dynamic>> adminResolve(String sessionId) =>
      _client.post<Map<String, dynamic>>('/support/admin/sessions/$sessionId/resolve');

  Future<Map<String, dynamic>> adminGetHistory({
    String? userId,
    String? fromDate,
    String? toDate,
    String? channel,
    int limit = 50,
  }) {
    final params = <String, String>{'limit': limit.toString()};
    if (userId != null)   params['userId']   = userId;
    if (fromDate != null) params['fromDate'] = fromDate;
    if (toDate != null)   params['toDate']   = toDate;
    if (channel != null)  params['channel']  = channel;
    return _client.get<Map<String, dynamic>>('/support/admin/sessions/history', params: params);
  }
}

// ── WebSocket Client ──────────────────────────────────────────────────────────

class SupportWebSocketClient {
  SupportWebSocketClient(this._ref);
  final Ref _ref;

  WebSocketChannel? _channel;
  StreamController<Map<String, dynamic>>? _controller;
  Timer? _pingTimer;
  bool _shouldReconnect = false;

  Stream<Map<String, dynamic>> get events =>
      _controller?.stream ?? const Stream.empty();

  bool get isConnected => _channel != null;

  Future<void> connect() async {
    if (_channel != null) return;
    _shouldReconnect = true;
    _controller ??= StreamController<Map<String, dynamic>>.broadcast();

    final token = await _ref.read(secureStorageProvider).getAccessToken();
    if (token == null) return;

    final wsBase = AppConfig.wsBaseUrl;
    final uri    = Uri.parse('$wsBase/support/socket?token=${Uri.encodeComponent(token)}');

    try {
      _channel = WebSocketChannel.connect(uri);
      _channel!.stream.listen(
        (raw) {
          try {
            final msg = jsonDecode(raw as String) as Map<String, dynamic>;
            _controller?.add(msg);
          } catch (_) {}
        },
        onDone: _onClose,
        onError: (_) => _onClose(),
        cancelOnError: false,
      );

      _startPing();
    } catch (_) {
      _channel = null;
      if (_shouldReconnect) {
        Future.delayed(const Duration(seconds: 3), connect);
      }
    }
  }

  void disconnect() {
    _shouldReconnect = false;
    _stopPing();
    _channel?.sink.close();
    _channel = null;
  }

  void send(String type, [Map<String, dynamic> payload = const {}]) {
    _channel?.sink.add(jsonEncode({'type': type, 'payload': payload}));
  }

  void sendMessage({
    required String sessionId,
    required String ciphertext,
    String? senderKeyId,
    String type = 'text',
    int? clientTs,
  }) {
    send('support:message', {
      'sessionId':   sessionId,
      'ciphertext':  ciphertext,
      if (senderKeyId != null) 'senderKeyId': senderKeyId,
      'type':        type,
      'clientTs':    clientTs ?? DateTime.now().millisecondsSinceEpoch,
    });
  }

  void sendCallSignal(String callId, Map<String, dynamic> signal) {
    send('support:call:signal', {'callId': callId, 'signal': signal});
  }

  void sendReadAck(String sessionId, int upToServerTs) {
    send('support:read_ack', {'sessionId': sessionId, 'upToServerTs': upToServerTs});
  }

  void _onClose() {
    _channel = null;
    _stopPing();
    if (_shouldReconnect) {
      Future.delayed(const Duration(seconds: 3), connect);
    }
  }

  void _startPing() {
    _pingTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      send('ping');
      send('support:heartbeat');
    });
  }

  void _stopPing() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  void dispose() {
    disconnect();
    _controller?.close();
    _controller = null;
  }
}
