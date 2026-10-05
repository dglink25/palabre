/// Main entry point for the Palabre Flutter SDK.
library;

import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;

import 'modules/call_module.dart';
import 'modules/chat_module.dart';
import 'modules/push_module.dart';
import 'modules/video_module.dart';
import 'utils/white_label_config.dart';

export 'modules/call_module.dart';
export 'modules/chat_module.dart';
export 'modules/push_module.dart';
export 'modules/video_module.dart';
export 'utils/webhook_utils.dart';
export 'utils/white_label_config.dart';

/// Default base URL for the Palabre developer API.
const String _kDefaultBaseUrl = 'https://api.palabre.app/api/v1/developer';

/// Exception thrown by the Palabre SDK when an error occurs.
///
/// Contains a [code] for programmatic handling and a human-readable [message].
class PalabreException implements Exception {
  /// Machine-readable error code (e.g. `INVALID_KEY`, `NETWORK_ERROR`).
  final String code;

  /// Human-readable error description.
  final String message;

  /// Creates a [PalabreException] with the given [code] and [message].
  const PalabreException({required this.code, required this.message});

  @override
  String toString() => 'PalabreException($code): $message';
}

/// The main SDK class for interacting with the Palabre platform.
///
/// Obtain an instance by calling [PalabreSDK.init] with a valid publishable key.
///
/// ```dart
/// final sdk = await PalabreSDK.init(publishableKey: 'pk_live_...');
/// await sdk.chat.send(userId: 'user_123', message: 'Hello!');
/// ```
class PalabreSDK {
  /// The publishable key used to authenticate SDK requests.
  final String publishableKey;

  /// The white-label configuration fetched during initialisation.
  final WhiteLabelConfig whiteLabelConfig;

  /// The base URL for all API requests.
  final String baseUrl;

  /// Chat module - send and receive messages.
  final ChatModule chat;

  /// Call module - initiate and manage audio/video calls.
  final CallModule call;

  /// Video module - join and manage video conference rooms.
  final VideoModule video;

  /// Push notifications module - register/unregister FCM tokens.
  final PushModule push;

  PalabreSDK._({
    required this.publishableKey,
    required this.whiteLabelConfig,
    required this.baseUrl,
    required this.chat,
    required this.call,
    required this.video,
    required this.push,
  });

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  /// Initialises the SDK with the given [publishableKey].
  ///
  /// 1. Validates that the key starts with `pk_live_` - throws a
  ///    [PalabreException] with code `INVALID_KEY` otherwise.
  /// 2. Fetches the White_Label_Config for the project from the API.
  /// 3. Instantiates the module objects ([chat], [call], [video], [push]).
  /// 4. Returns the fully-initialised [PalabreSDK] instance.
  ///
  /// [baseUrl] defaults to `https://api.palabre.app/api/v1/developer` and can
  /// be overridden in tests or staging environments.
  static Future<PalabreSDK> init({
    required String publishableKey,
    String baseUrl = _kDefaultBaseUrl,
  }) async {
    // 1. Validate the publishable key prefix.
    if (!publishableKey.startsWith('pk_live_')) {
      throw PalabreException(
        code: 'INVALID_KEY',
        message:
            'Invalid publishable key. Keys must start with "pk_live_". '
            'Check the key in your Palabre developer dashboard.',
      );
    }

    // 2. Fetch the White_Label_Config for this project.
    WhiteLabelConfig config;
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/projects/config'),
        headers: {
          'X-Palabre-Key': publishableKey,
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 401) {
        throw const PalabreException(
          code: 'INVALID_KEY',
          message:
              'Unauthorised: the publishable key was rejected by the server. '
              'Verify that the key is active in your developer dashboard.',
        );
      }

      if (response.statusCode != 200) {
        throw PalabreException(
          code: 'INIT_FAILED',
          message:
              'Failed to fetch project configuration (HTTP ${response.statusCode}).',
        );
      }

      final Map<String, dynamic> body =
          json.decode(response.body) as Map<String, dynamic>;
      config = WhiteLabelConfig.fromJson(body);
    } on PalabreException {
      rethrow;
    } catch (e) {
      throw PalabreException(
        code: 'NETWORK_ERROR',
        message: 'Could not reach the Palabre API: $e',
      );
    }

    // 3. Instantiate module objects.
    final chatModule = ChatModule();
    final callModule = CallModule();
    final videoModule = VideoModule();
    final pushModule = PushModule();

    // 4. Return the initialised SDK instance.
    final sdk = PalabreSDK._(
      publishableKey: publishableKey,
      whiteLabelConfig: config,
      baseUrl: baseUrl,
      chat: chatModule,
      call: callModule,
      video: videoModule,
      push: pushModule,
    );

    // 5. Inject the SDK instance into each module so they can make requests
    //    without creating a circular import (modules import PalabreSDK, but
    //    PalabreSDK also imports the modules - the late field breaks the cycle).
    chatModule.sdk = sdk;
    callModule.sdk = sdk;
    videoModule.sdk = sdk;
    pushModule.sdk = sdk;

    // 6. Initialise the chat module: load the persisted offline queue and start
    //    the background retry timer.
    await chatModule.init();

    return sdk;
  }

  // ---------------------------------------------------------------------------
  // HTTP wrapper
  // ---------------------------------------------------------------------------

  /// Sends an authenticated HTTP request to the Palabre API.
  ///
  /// [method] must be one of `GET`, `POST`, `PATCH`, `PUT`, `DELETE`.
  /// [path] is appended to [baseUrl] (e.g. `'/proxy/messages'`).
  /// [body] is an optional JSON-serialisable map sent as the request body.
  ///
  /// Returns the decoded JSON response body as a [Map], an empty [Map] for
  /// empty responses (e.g. HTTP 204), or `null` for other non-JSON responses.
  ///
  /// Throws [PalabreException] on HTTP 4xx/5xx responses or network errors.
  Future<dynamic> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      'X-Palabre-Key': publishableKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    http.Response response;
    try {
      switch (method.toUpperCase()) {
        case 'GET':
          response = await http.get(uri, headers: headers);
        case 'POST':
          response = await http.post(
            uri,
            headers: headers,
            body: body != null ? json.encode(body) : null,
          );
        case 'PATCH':
          response = await http.patch(
            uri,
            headers: headers,
            body: body != null ? json.encode(body) : null,
          );
        case 'PUT':
          response = await http.put(
            uri,
            headers: headers,
            body: body != null ? json.encode(body) : null,
          );
        case 'DELETE':
          response = await http.delete(uri, headers: headers);
        default:
          throw PalabreException(
            code: 'INVALID_METHOD',
            message: 'Unsupported HTTP method: $method',
          );
      }
    } on PalabreException {
      rethrow;
    } catch (e) {
      throw PalabreException(
        code: 'NETWORK_ERROR',
        message: 'Network error while calling $method $path: $e',
      );
    }

    if (response.statusCode == 401) {
      throw const PalabreException(
        code: 'INVALID_KEY',
        message: 'Unauthorised: invalid or revoked publishable key.',
      );
    }

    if (response.statusCode == 429) {
      throw const PalabreException(
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down and retry.',
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      String detail = '';
      try {
        final decoded = json.decode(response.body);
        if (decoded is Map && decoded.containsKey('message')) {
          detail = ': ${decoded['message']}';
        }
      } catch (_) {}
      throw PalabreException(
        code: 'API_ERROR',
        message: 'API error (HTTP ${response.statusCode})$detail',
      );
    }

    if (response.body.isEmpty) {
      return null;
    }

    try {
      return json.decode(response.body);
    } catch (e) {
      throw PalabreException(
        code: 'PARSE_ERROR',
        message: 'Failed to parse API response: $e',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Webhook signature verification
  // ---------------------------------------------------------------------------

  /// Returns `true` if [signature] is a valid HMAC-SHA256 signature of [body]
  /// computed with [secretKey].
  ///
  /// Uses a constant-time comparison to prevent timing attacks.
  ///
  /// ```dart
  /// final isValid = sdk.verifyWebhookSignature(
  ///   body: requestBody,
  ///   signature: request.headers['X-Palabre-Signature']!,
  ///   secretKey: 'sk_live_...',
  /// );
  /// ```
  bool verifyWebhookSignature({
    required String body,
    required String signature,
    required String secretKey,
  }) {
    final keyBytes = utf8.encode(secretKey);
    final bodyBytes = utf8.encode(body);

    final hmac = Hmac(sha256, keyBytes);
    final digest = hmac.convert(bodyBytes);
    final expected = digest.toString();

    // Normalise: strip an optional "sha256=" prefix the server may include.
    final normalised =
        signature.startsWith('sha256=') ? signature.substring(7) : signature;

    // Constant-time comparison to prevent timing attacks.
    if (expected.length != normalised.length) return false;
    var result = 0;
    for (var i = 0; i < expected.length; i++) {
      result |= expected.codeUnitAt(i) ^ normalised.codeUnitAt(i);
    }
    return result == 0;
  }
}
