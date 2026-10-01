import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_theme.dart';
import '../widgets/network_mode_indicator.dart';
import '../../features/support/presentation/widgets/support_widget.dart';

/// Shell principal — barre de navigation 6 onglets.
/// Accueil | Discussions | Vidéo | Appels | Contacts | Profil
class ShellPage extends StatelessWidget {
  const ShellPage({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
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
