import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/secure_storage.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref);
});

class ApiClient {
  ApiClient(this._ref) {
    _dio = Dio(BaseOptions(
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
          // Relancer la requête avec le nouveau token
          final opts = err.requestOptions;
          final token = await _ref.read(secureStorageProvider).getAccessToken();
          opts.headers['Authorization'] = 'Bearer $token';
          final response = await _dio.fetch(opts);
          return handler.resolve(response);
        }
      } catch (_) {}
    }
    handler.next(err);
  }

  Future<bool> _refreshToken() async {
    final refreshToken = await _ref.read(secureStorageProvider).getRefreshToken();
    if (refreshToken == null) return false;

    try {
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
