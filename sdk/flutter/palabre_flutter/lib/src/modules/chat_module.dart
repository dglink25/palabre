/// Chat module for the Palabre Flutter SDK.
library;

import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../palabre_sdk.dart';

/// Key used to persist the offline message queue in SharedPreferences.
const String _kQueueKey = 'palabre_message_queue';

/// Interval for the background polling timer that retries queued messages.
const Duration _kRetryInterval = Duration(seconds: 5);

/// A message waiting to be sent, serialised to/from JSON for persistence.
class _QueuedMessage {
  final String userId;
  final String message;
  final String queuedAt;

  const _QueuedMessage({
    required this.userId,
    required this.message,
    required this.queuedAt,
  });

  factory _QueuedMessage.fromJson(Map<String, dynamic> json) {
    return _QueuedMessage(
      userId: json['userId'] as String,
      message: json['message'] as String,
      queuedAt: json['queuedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'message': message,
        'queuedAt': queuedAt,
      };
}

/// Handles sending and receiving messages via the Palabre messaging
/// infrastructure, with automatic offline queuing.
///
/// When a message cannot be sent due to a network error, it is added to a
/// persistent queue (backed by [SharedPreferences]). A background timer polls
/// every 5 seconds; when the network comes back and a send succeeds the
/// message is removed from the queue. All queued messages are sent in FIFO
/// order.
///
/// Obtain an instance from [PalabreSDK.chat].
///
/// ```dart
/// await sdk.chat.init();                        // load persisted queue
/// sdk.chat.onMessage = (msg) => print('Received: ${msg['content']}');
/// await sdk.chat.send(userId: 'user_123', message: 'Hello!');
/// ```
class ChatModule {
  /// The SDK instance used to make authenticated HTTP requests.
  ///
  /// Set by [PalabreSDK] immediately after instantiation to avoid circular
  /// imports (since [PalabreSDK] imports this module).
  late PalabreSDK sdk;

  /// Callback invoked when an incoming message is received.
  ///
  /// The [Map] passed to the callback contains at least:
  /// - `id`        - the message identifier
  /// - `senderId`  - the sender's user ID
  /// - `content`   - the message text
  /// - `timestamp` - ISO-8601 timestamp
  ///
  /// ```dart
  /// sdk.chat.onMessage = (msg) {
  ///   print('New message from ${msg['senderId']}: ${msg['content']}');
  /// };
  /// ```
  void Function(Map<String, dynamic> message)? onMessage;

  /// In-memory list of messages waiting to be delivered.
  final List<_QueuedMessage> _queue = [];

  /// Background timer that periodically attempts to flush the offline queue.
  Timer? _retryTimer;

  /// Whether a flush operation is currently in progress (prevents overlapping
  /// flushes triggered by the timer).
  bool _flushing = false;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /// Loads any previously persisted queue from [SharedPreferences] and starts
  /// the background retry timer.
  ///
  /// Call this once after the SDK is fully initialised (i.e. after
  /// `chatModule.sdk = sdk` has been set). [PalabreSDK.init] calls this
  /// automatically.
  Future<void> init() async {
    await _loadQueue();
    _startRetryTimer();
  }

  /// Cancels the background retry timer and persists the current queue.
  ///
  /// Call this when disposing the SDK (e.g. on app shutdown) to prevent memory
  /// leaks and ensure the queue is saved.
  Future<void> dispose() async {
    _retryTimer?.cancel();
    _retryTimer = null;
    await _persistQueue();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /// Sends [message] to the user identified by [userId].
  ///
  /// The message is transmitted via the Palabre end-to-end messaging
  /// infrastructure through `POST /proxy/messages`.
  ///
  /// If the request fails with a [PalabreException] whose code is
  /// `NETWORK_ERROR`, the message is silently added to the offline queue
  /// instead of re-throwing - it will be retried automatically when
  /// connectivity is restored.
  ///
  /// All other [PalabreException] codes (e.g. `INVALID_KEY`, `API_ERROR`) are
  /// still thrown to the caller.
  ///
  /// ```dart
  /// await sdk.chat.send(userId: 'user_456', message: 'Hey there!');
  /// ```
  Future<Map<String, dynamic>> send({
    required String userId,
    required String message,
  }) async {
    try {
      return await _doSend(userId: userId, message: message);
    } on PalabreException catch (e) {
      if (e.code == 'NETWORK_ERROR') {
        await _enqueue(userId: userId, message: message);
        // Return an empty map so the caller knows the operation was queued
        // rather than throwing. The message will be delivered later.
        return {};
      }
      rethrow;
    }
  }

  /// Returns a read-only view of the current offline queue.
  ///
  /// Exposed for debugging / UI display purposes.
  List<Map<String, dynamic>> get pendingMessages =>
      List.unmodifiable(_queue.map((m) => m.toJson()));

  /// Returns `true` if there are messages waiting to be sent.
  bool get hasQueuedMessages => _queue.isNotEmpty;

  // ---------------------------------------------------------------------------
  // Incoming messages
  // ---------------------------------------------------------------------------

  /// Triggers the [onMessage] callback with [message].
  ///
  /// Used internally to surface incoming messages delivered via push
  /// notifications or other real-time channels.
  void handleIncomingMessage(Map<String, dynamic> message) {
    onMessage?.call(message);
  }

  // ---------------------------------------------------------------------------
  // Internal - sending
  // ---------------------------------------------------------------------------

  /// Executes the actual HTTP call to send a message.
  Future<Map<String, dynamic>> _doSend({
    required String userId,
    required String message,
  }) async {
    final response = await sdk.request(
      'POST',
      '/proxy/messages',
      body: {
        'recipientId': userId,
        'content': message,
      },
    );

    final result = (response as Map<String, dynamic>?) ?? {};

    // Notify the onMessage callback with the sent message data so the
    // application can update its UI immediately (echo).
    onMessage?.call({
      'id': result['id'],
      'senderId': result['senderId'],
      'recipientId': userId,
      'content': message,
      'timestamp': result['timestamp'] ?? DateTime.now().toIso8601String(),
      ...result,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Internal - queue management
  // ---------------------------------------------------------------------------

  /// Adds a message to the tail of the in-memory queue and persists it.
  Future<void> _enqueue({
    required String userId,
    required String message,
  }) async {
    _queue.add(_QueuedMessage(
      userId: userId,
      message: message,
      queuedAt: DateTime.now().toIso8601String(),
    ));
    await _persistQueue();
  }

  /// Attempts to send all queued messages in FIFO order.
  ///
  /// On success each message is removed from the queue immediately. On any
  /// failure the method stops - remaining messages stay queued and will be
  /// retried on the next timer tick.
  Future<void> _flushQueue() async {
    if (_flushing || _queue.isEmpty) return;
    _flushing = true;

    try {
      while (_queue.isNotEmpty) {
        final pending = _queue.first;
        try {
          await _doSend(userId: pending.userId, message: pending.message);
          // Success - remove from queue and persist the updated state.
          _queue.removeAt(0);
          await _persistQueue();
        } on PalabreException catch (e) {
          // Any network error stops the flush; we'll retry on the next tick.
          if (e.code == 'NETWORK_ERROR') break;
          // Non-network errors (e.g. bad recipient) are unrecoverable for this
          // message - discard it to avoid blocking the queue forever.
          _queue.removeAt(0);
          await _persistQueue();
        }
      }
    } finally {
      _flushing = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal - persistence
  // ---------------------------------------------------------------------------

  /// Serialises the current in-memory queue to [SharedPreferences].
  Future<void> _persistQueue() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final encoded = json.encode(_queue.map((m) => m.toJson()).toList());
      await prefs.setString(_kQueueKey, encoded);
    } catch (_) {
      // Persistence failures are non-fatal; the queue lives in memory and will
      // be retried on the next write.
    }
  }

  /// Loads the persisted queue from [SharedPreferences] into [_queue].
  Future<void> _loadQueue() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kQueueKey);
      if (raw == null || raw.isEmpty) return;

      final decoded = json.decode(raw) as List<dynamic>;
      for (final item in decoded) {
        if (item is Map<String, dynamic>) {
          _queue.add(_QueuedMessage.fromJson(item));
        }
      }
    } catch (_) {
      // If the stored value is corrupt we start with an empty queue.
      _queue.clear();
    }
  }

  // ---------------------------------------------------------------------------
  // Internal - retry timer
  // ---------------------------------------------------------------------------

  /// Starts a periodic timer that tries to flush the queue every
  /// [_kRetryInterval] seconds.
  void _startRetryTimer() {
    _retryTimer?.cancel();
    _retryTimer = Timer.periodic(_kRetryInterval, (_) => _flushQueue());
  }
}
