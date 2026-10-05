/// White-label configuration utilities for the Palabre Flutter SDK.
///
/// Provides functions to fetch, cache, and apply the White_Label_Config of a
/// Palabre developer project so that end-users see only the developer's brand.
library;

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// Default base URL for the Palabre developer API.
const String _kDefaultBaseUrl = 'https://api.palabre.app/api/v1/developer';

/// In-memory cache TTL: 5 minutes.
const Duration _kCacheTtl = Duration(minutes: 5);

// ---------------------------------------------------------------------------
// Data classes
// ---------------------------------------------------------------------------

/// Holds the white-label configuration for a Palabre developer project.
///
/// All fields are optional - a project may configure none, some, or all values.
class WhiteLabelConfig {
  /// URL of the project logo.  `null` if none is configured; the SDK should
  /// fall back to a neutral generic logo without any Palabre branding.
  final String? logoUrl;

  /// Primary colour in `#RRGGBB` hexadecimal format (e.g. `#3B82F6`).
  final String? colorPrimary;

  /// Secondary colour in `#RRGGBB` hexadecimal format (e.g. `#6366F1`).
  final String? colorSecondary;

  /// Display name that replaces every occurrence of "Palabre" in the UI.
  final String? displayName;

  /// Creates a [WhiteLabelConfig] instance.
  const WhiteLabelConfig({
    this.logoUrl,
    this.colorPrimary,
    this.colorSecondary,
    this.displayName,
  });

  /// Creates a [WhiteLabelConfig] from a JSON map returned by the API.
  ///
  /// Accepts both snake_case keys (API response) and camelCase keys
  /// (internal use).
  factory WhiteLabelConfig.fromJson(Map<String, dynamic> json) {
    // The API may nest the config under a 'config' key.
    final Map<String, dynamic> data =
        json.containsKey('config') && json['config'] is Map
            ? json['config'] as Map<String, dynamic>
            : json;

    return WhiteLabelConfig(
      logoUrl: (data['logo_url'] ?? data['logoUrl']) as String?,
      colorPrimary:
          (data['color_primary'] ?? data['colorPrimary']) as String?,
      colorSecondary:
          (data['color_secondary'] ?? data['colorSecondary']) as String?,
      displayName:
          (data['display_name'] ?? data['displayName']) as String?,
    );
  }

  /// Returns a copy of this config with the provided fields overridden.
  WhiteLabelConfig copyWith({
    String? logoUrl,
    String? colorPrimary,
    String? colorSecondary,
    String? displayName,
  }) {
    return WhiteLabelConfig(
      logoUrl: logoUrl ?? this.logoUrl,
      colorPrimary: colorPrimary ?? this.colorPrimary,
      colorSecondary: colorSecondary ?? this.colorSecondary,
      displayName: displayName ?? this.displayName,
    );
  }
}

/// The resolved values returned by [applyConfig], ready to be consumed by
/// Flutter widgets without any Palabre-specific logic.
class AppliedConfig {
  /// Resolved logo URL. Guaranteed non-null: falls back to [genericLogoUrl]
  /// if no logo was configured.
  final String logoUrl;

  /// Resolved primary colour as `#RRGGBB`.  Falls back to `#3B82F6`.
  final String colorPrimary;

  /// Resolved secondary colour as `#RRGGBB`.  Falls back to `#6366F1`.
  final String colorSecondary;

  /// Resolved display name.  Falls back to `'Palabre'`.
  final String displayName;

  /// Creates an [AppliedConfig] instance.
  const AppliedConfig({
    required this.logoUrl,
    required this.colorPrimary,
    required this.colorSecondary,
    required this.displayName,
  });
}

// ---------------------------------------------------------------------------
// Generic fallback logo
// ---------------------------------------------------------------------------

/// A neutral inline SVG data-URI used when no project logo is configured.
///
/// Contains no Palabre branding - just a simple speech-bubble icon.
const String genericLogoUrl =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E"
    "%3Ccircle cx='20' cy='20' r='18' fill='%23e5e7eb' stroke='%23d1d5db' stroke-width='1.5'/%3E"
    "%3Cpath d='M14 16h12M14 20h8M14 24h10' stroke='%239ca3af' stroke-width='2' stroke-linecap='round'/%3E"
    "%3C/svg%3E";

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

class _CacheEntry {
  final WhiteLabelConfig config;
  final DateTime fetchedAt;

  const _CacheEntry({required this.config, required this.fetchedAt});

  bool get isStale =>
      DateTime.now().difference(fetchedAt) >= _kCacheTtl;
}

final Map<String, _CacheEntry> _cache = {};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Fetches the [WhiteLabelConfig] for the project associated with [apiKey].
///
/// Results are cached in memory for 5 minutes.  Subsequent calls within the
/// TTL window return the cached value without making an HTTP request.
///
/// [apiKey]  – The project's Publishable Key (`pk_live_...`).
/// [baseUrl] – Override the default API base URL (useful in tests).
///
/// Throws an [Exception] if the request fails or the response cannot be
/// parsed.
///
/// ```dart
/// final config = await fetchConfig(apiKey: 'pk_live_abc123');
/// final applied = applyConfig(config);
/// ```
Future<WhiteLabelConfig> fetchConfig({
  required String apiKey,
  String baseUrl = _kDefaultBaseUrl,
}) async {
  final cacheKey = '$baseUrl::$apiKey';

  // Return cached value if still fresh.
  final cached = _cache[cacheKey];
  if (cached != null && !cached.isStale) {
    return cached.config;
  }

  // Fetch from the API.
  final response = await http.get(
    Uri.parse('$baseUrl/projects/config'),
    headers: {
      'X-Palabre-Key': apiKey,
      'Accept': 'application/json',
    },
  );

  if (response.statusCode != 200) {
    throw Exception(
      'Failed to fetch white-label config (HTTP ${response.statusCode})',
    );
  }

  final Map<String, dynamic> body =
      json.decode(response.body) as Map<String, dynamic>;
  final config = WhiteLabelConfig.fromJson(body);

  // Store in cache.
  _cache[cacheKey] = _CacheEntry(
    config: config,
    fetchedAt: DateTime.now(),
  );

  return config;
}

/// Invalidates the cached config for [apiKey] (or the entire cache when
/// [apiKey] is omitted).
void invalidateConfigCache({String? apiKey, String baseUrl = _kDefaultBaseUrl}) {
  if (apiKey != null) {
    _cache.remove('$baseUrl::$apiKey');
  } else {
    _cache.clear();
  }
}

/// Applies [config] and returns an [AppliedConfig] with resolved values that
/// Flutter widgets can consume directly.
///
/// - If no logo is configured, [AppliedConfig.logoUrl] is set to
///   [genericLogoUrl] - a neutral icon with no Palabre branding (req 11.4).
/// - [AppliedConfig.displayName] replaces "Palabre" in all UI text (req 11.3).
/// - Colour fields fall back to sensible defaults if not configured.
///
/// ```dart
/// final applied = applyConfig(config);
/// Text(applied.displayName);  // "MyApp" instead of "Palabre"
/// ```
AppliedConfig applyConfig(WhiteLabelConfig config) {
  return AppliedConfig(
    logoUrl: config.logoUrl ?? genericLogoUrl,
    colorPrimary: config.colorPrimary ?? '#3B82F6',
    colorSecondary: config.colorSecondary ?? '#6366F1',
    displayName: config.displayName ?? 'Palabre',
  );
}

/// Replaces all occurrences of "Palabre" (case-insensitive) in [text] with
/// [displayName].
///
/// Use this when you need to apply white-labelling to arbitrary text strings
/// inside your widgets.
///
/// ```dart
/// final label = replacePalabreText('Powered by Palabre', config.displayName!);
/// // → 'Powered by MyApp'
/// ```
String replacePalabreText(String text, String displayName) {
  return text.replaceAll(
    RegExp('Palabre', caseSensitive: false),
    displayName,
  );
}

// ---------------------------------------------------------------------------
// Polling - re-fetch toutes les 5 minutes (Requirement 11.5)
// ---------------------------------------------------------------------------

/// Handles de polling actifs par clé API.
final Map<String, Timer> _pollingHandles = {};

/// Démarre un polling toutes les 5 minutes pour re-fetcher la
/// [WhiteLabelConfig] et appeler [onUpdate] si la config a changé.
///
/// [apiKey]   – Publishable Key du projet
/// [onUpdate] – Callback appelé avec la nouvelle config
/// [baseUrl]  – URL de base optionnelle
void startConfigPolling({
  required String apiKey,
  required void Function(WhiteLabelConfig config) onUpdate,
  String baseUrl = _kDefaultBaseUrl,
}) {
  // Éviter les doublons
  stopConfigPolling(apiKey: apiKey, baseUrl: baseUrl);

  final handle = Timer.periodic(_kCacheTtl, (_) async {
    try {
      // Invalider le cache pour forcer un re-fetch
      invalidateConfigCache(apiKey: apiKey, baseUrl: baseUrl);
      final newConfig = await fetchConfig(apiKey: apiKey, baseUrl: baseUrl);
      onUpdate(newConfig);
    } catch (_) {
      // Erreur réseau transitoire - on réessaie au prochain tick
    }
  });

  _pollingHandles['$baseUrl::$apiKey'] = handle;
}

/// Arrête le polling pour une clé API donnée.
void stopConfigPolling({
  required String apiKey,
  String baseUrl = _kDefaultBaseUrl,
}) {
  final key = '$baseUrl::$apiKey';
  _pollingHandles[key]?.cancel();
  _pollingHandles.remove(key);
}
