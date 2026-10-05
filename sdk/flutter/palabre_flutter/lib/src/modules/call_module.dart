/// Call module for the Palabre Flutter SDK.
library;

import '../palabre_sdk.dart';

/// Handles audio/video calls via the Palabre WebRTC infrastructure.
///
/// Obtain an instance from [PalabreSDK.call].
///
/// ```dart
/// final callInfo = await sdk.call.start(userId: 'user_123');
/// // ... later ...
/// await sdk.call.end(callId: callInfo['callId']);
/// ```
class CallModule {
  /// The SDK instance used to make authenticated HTTP requests.
  ///
  /// Set by [PalabreSDK] immediately after instantiation to avoid circular
  /// imports (since [PalabreSDK] imports this module).
  late PalabreSDK sdk;

  /// Initiates a call to the user identified by [userId].
  ///
  /// Sends `POST /proxy/calls` with `action: 'start'` and returns the API
  /// response which includes:
  /// - `callId`       - unique call identifier
  /// - `turnCredentials` - TURN server credentials for WebRTC negotiation
  /// - `signalingToken`  - token for the signaling channel
  ///
  /// Throws a [PalabreException] if the request fails.
  Future<Map<String, dynamic>> start({required String userId}) async {
    final response = await sdk.request(
      'POST',
      '/proxy/calls',
      body: {
        'action': 'start',
        'recipientId': userId,
      },
    );
    return (response as Map<String, dynamic>?) ?? {};
  }

  /// Accepts the incoming call identified by [callId].
  ///
  /// Sends `POST /proxy/calls` with `action: 'accept'` and returns the TURN
  /// credentials and signaling token needed to complete the WebRTC handshake.
  ///
  /// Throws a [PalabreException] if the request fails.
  Future<Map<String, dynamic>> accept({required String callId}) async {
    final response = await sdk.request(
      'POST',
      '/proxy/calls',
      body: {
        'action': 'accept',
        'callId': callId,
      },
    );
    return (response as Map<String, dynamic>?) ?? {};
  }

  /// Rejects the incoming call identified by [callId].
  ///
  /// Sends `POST /proxy/calls` with `action: 'reject'`.
  ///
  /// Throws a [PalabreException] if the request fails.
  Future<void> reject({required String callId}) async {
    await sdk.request(
      'POST',
      '/proxy/calls',
      body: {
        'action': 'reject',
        'callId': callId,
      },
    );
  }

  /// Ends the ongoing call identified by [callId].
  ///
  /// Sends `POST /proxy/calls` with `action: 'end'`.
  ///
  /// Throws a [PalabreException] if the request fails.
  Future<void> end({required String callId}) async {
    await sdk.request(
      'POST',
      '/proxy/calls',
      body: {
        'action': 'end',
        'callId': callId,
      },
    );
  }
}
