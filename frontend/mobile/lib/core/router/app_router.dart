import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/otp_page.dart';
import '../../features/auth/presentation/pages/activate_page.dart';
import '../../features/conversations/presentation/pages/conversations_page.dart';
import '../../features/conversations/presentation/pages/chat_page.dart';
import '../../features/calls/presentation/pages/calls_page.dart';
import '../../features/calls/presentation/pages/call_screen.dart';
import '../../features/contacts/presentation/pages/contacts_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/settings/presentation/pages/settings_page.dart';
import '../providers/auth_provider.dart';
import 'shell_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/conversations',
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull?.isAuthenticated ?? false;
      final isAuthRoute = state.matchedLocation.startsWith('/auth') ||
          state.matchedLocation.startsWith('/activate');

      if (!isLoggedIn && !isAuthRoute) return '/auth/login';
      if (isLoggedIn && isAuthRoute) return '/conversations';
      return null;
    },
    routes: [
      // ── Auth ────────────────────────────────────────────────────────────
      GoRoute(path: '/auth/login',    builder: (_, __) => const LoginPage()),
      GoRoute(path: '/auth/otp',      builder: (_, s)  => OtpPage(phone: s.extra as String)),
      GoRoute(path: '/activate',      builder: (_, __) => const ActivatePage()),

      // ── App principale (shell avec barre de navigation) ─────────────────
      ShellRoute(
        builder: (context, state, child) => ShellPage(child: child),
        routes: [
          GoRoute(
            path: '/conversations',
            builder: (_, __) => const ConversationsPage(),
            routes: [
              GoRoute(
                path: ':id',
                builder: (_, s) => ChatPage(conversationId: s.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(path: '/calls',    builder: (_, __) => const CallsPage()),
          GoRoute(path: '/contacts', builder: (_, __) => const ContactsPage()),
          GoRoute(path: '/profile',  builder: (_, __) => const ProfilePage()),
          GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
        ],
      ),

      // ── Écran d'appel (plein écran, hors shell) ─────────────────────────
      GoRoute(
        path: '/call/:callId',
        builder: (_, s) => CallScreen(
          callId: s.pathParameters['callId']!,
          extra: s.extra as Map<String, dynamic>?,
        ),
      ),
    ],
  );
});
