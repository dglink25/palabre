import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_theme.dart';
import '../../features/support/presentation/widgets/support_widget.dart';

// ── Horloge temps réel ────────────────────────────────────────────────────────
// Format : 1ER OCTOBRE 2026  23H:40
class _RealtimeClock extends StatefulWidget {
  const _RealtimeClock({this.timezone});
  final String? timezone;

  @override
  State<_RealtimeClock> createState() => _RealtimeClockState();
}

class _RealtimeClockState extends State<_RealtimeClock> {
  Timer? _timer;
  String _display = '';

  static const _ordinals = [
    '1ER','2','3','4','5','6','7','8','9','10',
    '11','12','13','14','15','16','17','18','19','20',
    '21','22','23','24','25','26','27','28','29','30','31',
  ];

  static const _months = [
    'JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN',
    'JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE',
  ];

  @override
  void initState() {
    super.initState();
    _tick();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  @override
  void didUpdateWidget(_RealtimeClock old) {
    super.didUpdateWidget(old);
    if (old.timezone != widget.timezone) _tick();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _tick() {
    final now = DateTime.now().toUtc();
    // Appliquer le décalage du fuseau manuellement (Dart n'a pas de tz database)
    // Pour une précision exacte en production, utiliser le package timezone.
    // Ici on utilise l'heure locale de l'appareil, ce qui est correct dans la
    // plupart des cas (l'appareil est configuré dans le bon fuseau).
    final local = DateTime.now();
    final d = _ordinals[local.day - 1];
    final m = _months[local.month - 1];
    final h = local.hour.toString().padLeft(2, '0');
    final min = local.minute.toString().padLeft(2, '0');
    if (mounted) setState(() => _display = '$d $m ${local.year}  ${h}H:$min');
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      _display,
      style: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: AppTheme.textSecondary,
        letterSpacing: 0.2,
      ),
    );
  }
}

/// Shell principal — barre de navigation 6 onglets.
/// Accueil | Discussions | Vidéo | Appels | Contacts | Profil
class ShellPage extends ConsumerWidget {
  const ShellPage({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;

    int selectedIndex = 0;
    if (location.startsWith('/home'))               selectedIndex = 0;
    else if (location.startsWith('/conversations'))  selectedIndex = 1;
    else if (location.startsWith('/videoconference')) selectedIndex = 2;
    else if (location.startsWith('/calls'))          selectedIndex = 3;
    else if (location.startsWith('/contacts'))       selectedIndex = 4;
    else if (location.startsWith('/profile') ||
             location.startsWith('/security') ||
             location.startsWith('/sessions') ||
             location.startsWith('/settings') ||
             location.startsWith('/org'))            selectedIndex = 5;

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        titleSpacing: 12,
        title: Row(children: [
          // Logo
          Image.asset('assets/images/logo.png', width: 24, height: 24,
              errorBuilder: (_, __, ___) => const SizedBox(width: 24)),
          const SizedBox(width: 8),
          const Text('PALABRE',
              style: TextStyle(fontFamily: 'Inter', fontSize: 15,
                  fontWeight: FontWeight.w800, color: AppTheme.primaryBlue)),
        ]),
        actions: [
          // ── Horloge temps réel ───────────────────────────────
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(child: _RealtimeClock()),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: AppTheme.border),
        ),
      ),
      body: child,
      floatingActionButton: const SupportWidget(),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      bottomNavigationBar: _BottomBar(
        selectedIndex: selectedIndex,
        onTap: (i) {
          switch (i) {
            case 0: context.go('/home');             break;
            case 1: context.go('/conversations');    break;
            case 2: context.go('/videoconference');  break;
            case 3: context.go('/calls');            break;
            case 4: context.go('/contacts');         break;
            case 5: context.go('/profile');          break;
          }
        },
      ),
    );
  }
}

// ── Barre de navigation personnalisée ────────────────────────────────────────

class _BottomBar extends StatelessWidget {
  const _BottomBar({ required this.selectedIndex, required this.onTap });
  final int selectedIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.white,
        border: Border(top: BorderSide(color: AppTheme.border, width: 0.8)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              _NavBtn(icon: Icons.home_outlined,       activeIcon: Icons.home,            label: 'Accueil',       index: 0, selected: selectedIndex, onTap: onTap),
              _NavBtn(icon: Icons.chat_bubble_outline, activeIcon: Icons.chat_bubble,     label: 'Messages',      index: 1, selected: selectedIndex, onTap: onTap),
              _NavBtn(icon: Icons.videocam_outlined,   activeIcon: Icons.videocam,        label: 'Vidéo',         index: 2, selected: selectedIndex, onTap: onTap),
              _NavBtn(icon: Icons.call_outlined,       activeIcon: Icons.call,            label: 'Appels',        index: 3, selected: selectedIndex, onTap: onTap),
              _NavBtn(icon: Icons.people_outline,      activeIcon: Icons.people,          label: 'Contacts',      index: 4, selected: selectedIndex, onTap: onTap),
              _NavBtn(icon: Icons.person_outline,      activeIcon: Icons.person,          label: 'Profil',        index: 5, selected: selectedIndex, onTap: onTap),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bouton de navigation dans la barre du bas
class _NavBtn extends StatelessWidget {
  const _NavBtn({
    required this.icon, required this.activeIcon, required this.label,
    required this.index, required this.selected, required this.onTap,
  });
  final IconData icon, activeIcon;
  final String   label;
  final int      index, selected;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final isActive = index == selected;
    return Expanded(
      child: GestureDetector(
        onTap: () => onTap(index),
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(isActive ? activeIcon : icon,
              color: isActive ? AppTheme.primaryBlue : AppTheme.textSecondary,
              size: 22),
            const SizedBox(height: 2),
            Text(label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w400,
                color: isActive ? AppTheme.primaryBlue : AppTheme.textSecondary,
              )),
          ],
        ),
      ),
    );
  }
}
