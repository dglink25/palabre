import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/storage/local_database.dart';

/// Page d'accueil — résumé de l'activité et raccourcis.
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState  = ref.watch(authStateProvider).valueOrNull;
    final userName   = 'Bienvenue';
    final now        = DateTime.now();
    final hour       = now.hour;
    final greeting   = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

    return Scaffold(
      backgroundColor: AppTheme.offWhite,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── En-tête ──────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF1557b0), AppTheme.primaryBlue],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('$greeting',
                      style: const TextStyle(color: Colors.white70, fontSize: 15)),
                    const SizedBox(height: 4),
                    const Text('Palabre',
                      style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(
                      authState?.orgId != null
                        ? 'Organisation connectée'
                        : 'Aucune organisation liée',
                      style: const TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),

            // ── Raccourcis rapides ────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Actions rapides',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    Row(children: [
                      _QuickAction(
                        icon: Icons.chat_bubble_outline,
                        label: 'Messages',
                        color: AppTheme.primaryBlue,
                        onTap: () => context.go('/conversations'),
                      ),
                      const SizedBox(width: 12),
                      _QuickAction(
                        icon: Icons.videocam_outlined,
                        label: 'Vidéo',
                        color: const Color(0xFF7c3aed),
                        onTap: () => context.go('/videoconference'),
                      ),
                      const SizedBox(width: 12),
                      _QuickAction(
                        icon: Icons.call_outlined,
                        label: 'Appels',
                        color: AppTheme.successGreen,
                        onTap: () => context.go('/calls'),
                      ),
                      const SizedBox(width: 12),
                      _QuickAction(
                        icon: Icons.people_outline,
                        label: 'Contacts',
                        color: AppTheme.warningAmber,
                        onTap: () => context.go('/contacts'),
                      ),
                    ]),
                  ],
                ),
              ),
            ),

            // ── Conversations récentes ────────────────────────────────────
            if (authState?.orgId != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Conversations récentes',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          TextButton(
                            onPressed: () => context.go('/conversations'),
                            child: const Text('Voir tout'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

            if (authState?.orgId == null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppTheme.white,
                      border: Border.all(color: AppTheme.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.business_outlined, size: 48, color: AppTheme.textSecondary),
                        const SizedBox(height: 12),
                        const Text('Aucune organisation liée',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        const SizedBox(height: 6),
                        const Text(
                          'Rejoignez votre organisation pour accéder à la messagerie et aux appels.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () => context.go('/org/join'),
                            child: const Text('Rejoindre une organisation'),
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: () => context.go('/org/link'),
                            style: OutlinedButton.styleFrom(shape: const RoundedRectangleBorder()),
                            child: const Text('Lier mon serveur (admin)'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({ required this.icon, required this.label, required this.color, required this.onTap });
  final IconData icon;
  final String   label;
  final Color    color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          children: [
            Container(
              width: 52, height: 52,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}
