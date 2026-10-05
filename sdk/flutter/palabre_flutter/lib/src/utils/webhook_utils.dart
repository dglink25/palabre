/// Webhook utility functions for the Palabre Flutter SDK.
///
/// Provides HMAC-SHA256 signature verification to validate incoming webhooks
/// from the Palabre platform.
library;

import 'dart:convert';

import 'package:crypto/crypto.dart';

/// Verifies the HMAC-SHA256 signature of a webhook payload.
///
/// The Palabre platform signs every webhook POST body with HMAC-SHA256 and
/// includes the result in the `X-Palabre-Signature` header, prefixed with
/// `sha256=`.  Call this function to confirm that a received webhook genuinely
/// originates from Palabre.
///
/// [body]      – The raw (unparsed) request body string.
/// [signature] – The value of the `X-Palabre-Signature` header.
/// [secretKey] – The webhook secret configured in your developer dashboard.
///
/// Returns `true` if the signature is valid, `false` otherwise.
///
/// Uses a constant-time XOR loop to prevent timing attacks.
///
/// ```dart
/// final valid = verifyWebhookSignature(
///   body: request.body,
///   signature: request.headers['X-Palabre-Signature']!,
///   secretKey: 'your_webhook_secret',
/// );
/// if (!valid) throw Exception('Invalid webhook signature');
/// ```
bool verifyWebhookSignature({
  required String body,
  required String signature,
  required String secretKey,
}) {
  // Strip the optional "sha256=" prefix.
  final normalised =
      signature.startsWith('sha256=') ? signature.substring(7) : signature;

  // Compute the expected HMAC-SHA256 hex digest.
  final keyBytes = utf8.encode(secretKey);
  final bodyBytes = utf8.encode(body);
  final hmac = Hmac(sha256, keyBytes);
  final expected = hmac.convert(bodyBytes).toString();

  // Lengths must match before doing the constant-time comparison.
  if (expected.length != normalised.length) return false;

  // Constant-time XOR comparison to prevent timing-based side-channel attacks.
  var result = 0;
  for (var i = 0; i < expected.length; i++) {
    result |= expected.codeUnitAt(i) ^ normalised.codeUnitAt(i);
  }
  return result == 0;
}
