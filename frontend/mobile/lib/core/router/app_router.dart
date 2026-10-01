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
import '../../features/calls/presentation/pages/incoming_call_screen.dart';
import '../../features/contacts/presentation/pages/contacts_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/settings/presentation/pages/settings_page.dart';
import '../../features/security/presentation/pages/security_page.dart';
import '../../features/sessions/presentation/pages/sessions_page.dart';
import '../../features/org/presentation/pages/org_join_page.dart';
import '../../features/org/presentation/pages/org_link_page.dart';
import '../../features/org/presentation/pages/org_invite_page.dart';
import '../../features/org/presentation/pages/org_dashboard_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/videoconference/presentation/pages/video_conference_page.dart';
import '../../features/videoconference/presentation/pages/video_room_page.dart';
import '../providers/auth_provider.dart';
import 'shell_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/home',
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull?.isAuthenticated ?? false;
      final orgId      = authState.valueOrNull?.orgId;
      final isAuthRoute = state.matchedLocation.startsWith('/auth') ||
          state.matchedLocation.startsWith('/activate');
      final isOrgRoute = state.matchedLocation.startsWith('/org/');

      if (!isLoggedIn && !isAuthRoute) return '/auth/login';
      if (isLoggedIn && isAuthRoute) return '/conversations';
      // Utilisateur connecté sans organisation → page de liaison
      if (isLoggedIn && orgId == null && !isOrgRoute) return '/org/join';
      return null;
    },
    routes: [
      // ── Auth ────────────────────────────────────────────────────────────
      GoRoute(path: '/auth/login',    builder: (_, __) => const LoginPage()),
      GoRoute(path: '/auth/otp',      builder: (_, s)  => OtpPage(phone: s.extra as String)),
      GoRoute(path: '/activate',      builder: (_, __) => const ActivatePage()),

      // ── Liaison organisation (accessible sans org préliée) ──────────────
      GoRoute(path: '/org/join',      builder: (_, __) => const OrgJoinPage()),
      GoRoute(path: '/org/link',      builder: (_, __) => const OrgLinkPage()),

      // ── App principale (shell avec barre de navigation) ─────────────────
      ShellRoute(
        builder: (context, state, child) => ShellPage(child: child),
        routes: [
          GoRoute(path: '/home',         builder: (_, __) => const HomePage()),
          GoRoute(
            path: '/conversations',
            builder: (_, __) => const ConversationsPage(),
            routes: [
              GoRoute(path: ':id', builder: (_, s) => ChatPage(conversationId: s.pathParameters['id']!)),
              GoRoute(path: 'new', builder: (_, __) => const ContactsPage()),
            ],
          ),
          GoRoute(path: '/calls',    builder: (_, __) => const CallsPage(),
            routes: [GoRoute(path: 'new', builder: (_, __) => const ContactsPage())]),
          GoRoute(path: '/contacts', builder: (_, __) => const ContactsPage()),
          GoRoute(
            path: '/videoconference',
            builder: (_, __) => const VideoConferencePage(),
          ),
          GoRoute(path: '/profile',  builder: (_, __) => const ProfilePage()),
          GoRoute(path: '/security', builder: (_, __) => const SecurityPage()),
          GoRoute(path: '/sessions', builder: (_, __) => const SessionsPage()),
          GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
          // Admin org
          GoRoute(path: '/org/dashboard', builder: (_, __) => const OrgDashboardPage()),
          GoRoute(path: '/org/invite',    builder: (_, __) => const OrgInvitePage()),
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

      // ── Appel entrant (plein écran, hors shell) ──────────────────────────
      GoRoute(
        path: '/incoming-call/:callId',
        builder: (_, s) => IncomingCallScreen(
          callId: s.pathParameters['callId']!,
          extra: s.extra as Map<String, dynamic>?,
        ),
      ),

      // ── Session vidéoconférence (plein écran, hors shell) ────────────────
      GoRoute(
        path: '/videoconference/:roomId',
        builder: (_, s) => VideoRoomPage(
          roomId: s.pathParameters['roomId']!,
          extra: s.extra as Map<String, dynamic>?,
        ),
      ),
    ],
  );
});
