/// Video conferencing module for the Palabre Flutter SDK.
library;

import '../palabre_sdk.dart';

/// Handles video conferencing sessions via the Palabre Jitsi infrastructure.
///
/// Obtain an instance from [PalabreSDK.video].
///
/// ```dart
/// final sessionToken = await sdk.video.join(roomId: 'room_abc123');
/// // Use sessionToken to authenticate the Jitsi client.
/// ```
class VideoModule {
  /// The SDK instance used to make authenticated HTTP requests.
  ///
  /// Set by [PalabreSDK] immediately after instantiation to avoid circular
  /// imports (since [PalabreSDK] imports this module).
  late PalabreSDK sdk;

  /// Joins the video conference room identified by [roomId].
  ///
  /// Sends `POST /proxy/video/rooms` to create or join the Jitsi room and
  /// returns a session token that the Jitsi client uses for authentication.
  ///
  /// Throws a [PalabreException] if the request fails.
  ///
  /// ```dart
  /// final token = await sdk.video.join(roomId: 'meeting-42');
  /// JitsiMeet.joinMeeting(JitsiMeetingOptions(room: 'meeting-42', token: token));
  /// ```
  Future<String> join({required String roomId}) async {
    final response = await sdk.request(
      'POST',
      '/proxy/video/rooms',
      body: {'roomId': roomId},
    );

    final data = response as Map<String, dynamic>?;
    final token = data?['sessionToken'] as String?;

    if (token == null || token.isEmpty) {
      throw const PalabreException(
        code: 'MISSING_SESSION_TOKEN',
        message:
            'The server did not return a session token for the video room. '
            'Verify that the roomId is valid.',
      );
    }

    return token;
  }
}
