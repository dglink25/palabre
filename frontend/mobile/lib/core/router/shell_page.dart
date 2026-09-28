import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_theme.dart';

/// Shell avec barre de navigation inférieure — structure principale de l'app.
class ShellPage extends StatelessWidget {
  const ShellPage({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    _TabItem(path: '/conversations', icon: Icons.chat_bubble_outline, activeIcon: Icons.chat_bubble, label: 'Messages'),
    _TabItem(path: '/calls',         icon: Icons.call_outlined,        activeIcon: Icons.call,        label: 'Appels'),
    _TabItem(path: '/contacts',      icon: Icons.people_outline,       activeIcon: Icons.people,      label: 'Contacts'),
    _TabItem(path: '/profile',       icon: Icons.person_outline,       activeIcon: Icons.person,      label: 'Profil'),
  ];

  int _selectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final idx = _tabs.indexWhere((t) => location.startsWith(t.path));
    return idx < 0 ? 0 : idx;
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _selectedIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        backgroundColor: AppTheme.white,
        indicatorColor: AppTheme.primaryBlue.withOpacity(0.12),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: _tabs.map((t) => NavigationDestination(
          icon:           Icon(t.icon),
          selectedIcon:   Icon(t.activeIcon, color: AppTheme.primaryBlue),
          label:          t.label,
        )).toList(),
      ),
    );
  }
}

class _TabItem {
  const _TabItem({required this.path, required this.icon, required this.activeIcon, required this.label});
  final String  path;
  final IconData icon;
  final IconData activeIcon;
  final String  label;
}
