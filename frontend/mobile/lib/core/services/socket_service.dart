import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phoenix_socket/phoenix_socket.dart';

import '../config/app_config.dart';
import '../storage/secure_storage.dart';

/// Service WebSocket Phoenix - connexion permanente au Message Router.
///
/// La connexion NE RACCROCHE JAMAIS côté client :
/// - Heartbeat toutes les 30s pour maintenir la connexion
/// - Reconnexion automatique avec backoff exponentiel si coupure
/// - Les messages en attente sont livrés dès reconnexion
final socketServiceProvider = Provider<SocketService>((ref) {
  final service = SocketService(ref);
  ref.onDispose(service.dispose);
  return service;
});

class SocketService {
  SocketService(this._ref);

  final Ref _ref;
  PhoenixSocket? _socket;
  PhoenixChannel? _userChannel;
  PhoenixChannel? _presenceChannel;

  // Callbacks enregistrés par les features
  final _messageHandlers    = <String, Function(Map<String, dynamic>)>{};
  final _presenceHandlers   = <Function(Map<String, dynamic>)>[];
  final _callHandlers       = <Function(Map<String, dynamic>)>[];

  bool _isConnected = false;
  int  _reconnectAttempt = 0;

  // ── Connexion ────────────────────────────────────────────────────────────

  Future<void> connect(String userId, String orgId, String token) async {
    if (_isConnected) return;

    final deviceId = await _ref.read(secureStorageProvider).getDeviceId();

    _socket = PhoenixSocket(
      AppConfig.messageRouterUrl,
      socketOptions: PhoenixSocketOptions(
        params: {
          'token':     token,
          'device_id': deviceId,
          'platform':  'flutter',
        },
        heartbeatInterval: const Duration(milliseconds: AppConfig.heartbeatIntervalMs),
        reconnectDelays: AppConfig.reconnectDelaysMs
            .map((ms) => Duration(milliseconds: ms))
            .toList(),
      ),
    );

    _socket!.onOpen(() {
      _isConnected = true;
      _reconnectAttempt = 0;
      _joinChannels(userId, orgId);
    });

    _socket!.onClose((_) {
      _isConnected = false;
      _reconnectAttempt++;
    });

    _socket!.onError((error) {
      // Log - la reconnexion est gérée automatiquement par phoenix_socket
    });

    await _socket!.connect();
  }

  void _joinChannels(String userId, String orgId) {
    // Channel personnel
    _userChannel = _socket!.addChannel(topic: 'user:$userId');
    _userChannel!
      ..on('msg:receive',   _onMessageReceive)
      ..on('msg:sent_ack',  _onSentAck)
      ..on('msg:delivered', _onDelivered)
      ..on('msg:read',      _onRead)
      ..on('call:incoming', _onCallIncoming)
      ..on('call:accepted', _onCallEvent)
      ..on('call:rejected', _onCallEvent)
      ..on('call:ended',    _onCallEvent)
      ..on('call:missed',   _onCallEvent)
      ..on('call:busy',     _onCallEvent)
      ..on('sdp:offer',     _onCallEvent)
      ..on('sdp:answer',    _onCallEvent)
      ..on('ice:candidate', _onCallEvent);

    _userChannel!.join();

    // Channel de présence
    _presenceChannel = _socket!.addChannel(topic: 'presence:$orgId');
    _presenceChannel!
      ..on('presence:state',  _onPresenceState)
      ..on('presence:update', _onPresenceUpdate);
    _presenceChannel!.join();
  }

  // ── Envoi de message ─────────────────────────────────────────────────────

  Future<void> sendMessage(Map<String, dynamic> payload) async {
    if (_userChannel == null) throw Exception('Socket non connecté');
    await _userChannel!.push('msg:send', payload).future;
  }

  Future<void> sendReadAck(String msgId, String fromUserId) async {
    await _userChannel?.push('msg:ack_read', {
      'msg_id': msgId,
      'from':   fromUserId,
    }).future;
  }

  // ── Signaling appels ─────────────────────────────────────────────────────

  Future<void> sendCallEvent(String event, Map<String, dynamic> payload) async {
    await _userChannel?.push(event, payload).future;
  }

  // ── Handlers internes ────────────────────────────────────────────────────

  void _onMessageReceive(Map<String, dynamic> payload, _ref, __) {
    final handler = _messageHandlers['receive'];
    handler?.call(payload);
  }

  void _onSentAck(Map<String, dynamic> payload, _, __) {
    _messageHandlers['sent_ack']?.call(payload);
  }

  void _onDelivered(Map<String, dynamic> payload, _, __) {
    _messageHandlers['delivered']?.call(payload);
  }

  void _onRead(Map<String, dynamic> payload, _, __) {
    _messageHandlers['read']?.call(payload);
  }

  void _onPresenceState(Map<String, dynamic> payload, _, __) {
    for (final h in _presenceHandlers) { h(payload); }
  }

  void _onPresenceUpdate(Map<String, dynamic> payload, _, __) {
    for (final h in _presenceHandlers) { h(payload); }
  }

  void _onCallIncoming(Map<String, dynamic> payload, _, __) {
    for (final h in _callHandlers) { h({'event': 'call:incoming', ...payload}); }
  }

  void _onCallEvent(Map<String, dynamic> payload, _, __) {
    for (final h in _callHandlers) { h(payload); }
  }

  // ── Inscription aux events ───────────────────────────────────────────────

  void onMessage(String event, Function(Map<String, dynamic>) handler) {
    _messageHandlers[event] = handler;
  }

  void onPresence(Function(Map<String, dynamic>) handler) {
    _presenceHandlers.add(handler);
  }

  void onCall(Function(Map<String, dynamic>) handler) {
    _callHandlers.add(handler);
  }

  void removeCallHandler(Function(Map<String, dynamic>) handler) {
    _callHandlers.remove(handler);
  }

  // ── Reconnexion ──────────────────────────────────────────────────────────

  void reconnectIfNeeded() {
    if (!_isConnected && _socket != null) {
      _socket!.connect();
    }
  }

  bool get isConnected => _isConnected;

  void dispose() {
    _socket?.dispose();
  }
}
