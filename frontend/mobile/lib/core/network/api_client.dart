import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/secure_storage.dart';
import '../network/network_detector.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref);
});

class ApiClient {
  ApiClient(this._ref) {
    _dio = Dio(BaseOptions(
      // L'URL de base sera overridée dynamiquement par le NetworkDetector
      baseUrl:         AppConfig.apiBaseUrl,
      connectTimeout:  const Duration(seconds: 15),
      receiveTimeout:  const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest:  _onRequest,
      onResponse: _onResponse,
      onError:    _onError,
    ));
  }

  final Ref _ref;
  late final Dio _dio;

  // ── Interceptors ─────────────────────────────────────────────────────────

  Future<void> _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // URL dynamique via NetworkDetector (LAN direct ou relais central)
    try {
      final detector = _ref.read(networkDetectorProvider);
      final activeBase = detector.getActiveBaseUrl();
      // Remplacer le baseUrl uniquement si le path ne contient pas déjà une URL complète
      if (!options.path.startsWith('http')) {
        options.baseUrl = activeBase;
      }
    } catch (_) { /* pas encore initialisé → utiliser l'URL statique */ }

    final token = await _ref.read(secureStorageProvider).getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  void _onResponse(Response response, ResponseInterceptorHandler handler) {
    handler.next(response);
  }

  Future<void> _onError(DioException err, ErrorInterceptorHandler handler) async {
    // Refresh automatique du token si 401
    if (err.response?.statusCode == 401) {
      try {
        final refreshed = await _refreshToken();
        if (refreshed) {
          final opts  = err.requestOptions;
          final token = await _ref.read(secureStorageProvider).getAccessToken();
          opts.headers['Authorization'] = 'Bearer $token';
          final response = await _dio.fetch(opts);
          return handler.resolve(response);
        }
      } catch (_) {}
    }

    // Si l'erreur réseau est liée à l'URL du tenant, tenter le basculement
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.connectionError) {
      try {
        final detector = _ref.read(networkDetectorProvider);
        await detector.probe(); // déclenchera le basculement si nécessaire
      } catch (_) {}
    }

    handler.next(err);
  }

  Future<bool> _refreshToken() async {
    final refreshToken = await _ref.read(secureStorageProvider).getRefreshToken();
    if (refreshToken == null) return false;

    try {
      // Toujours utiliser le relais central pour le refresh token
      final response = await Dio().post(
        '${AppConfig.apiBaseUrl}/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = response.data as Map<String, dynamic>;
      await _ref.read(secureStorageProvider).saveTokens(
        access:  data['accessToken'],
        refresh: data['refreshToken'],
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Méthodes HTTP ─────────────────────────────────────────────────────────

  Future<T> get<T>(String path, {Map<String, dynamic>? params}) async {
    final r = await _dio.get(path, queryParameters: params);
    return r.data as T;
  }

  Future<T> post<T>(String path, {dynamic data}) async {
    final r = await _dio.post(path, data: data);
    return r.data as T;
  }

  Future<T> patch<T>(String path, {dynamic data}) async {
    final r = await _dio.patch(path, data: data);
    return r.data as T;
  }

  Future<T> delete<T>(String path) async {
    final r = await _dio.delete(path);
    return r.data as T;
  }

  Future<T> upload<T>(String path, FormData formData) async {
    final r = await _dio.post(path, data: formData);
    return r.data as T;
  }
}
