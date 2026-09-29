import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_theme.dart';

/// Shell principal — barre de navigation 5 onglets.
/// Accueil | Discussions | + (nouvelle conversation) | Appels | Profil
class ShellPage extends StatelessWidget {
  const ShellPage({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;

    // Index selon la route active (le + central n'a pas de route propre)
    int selectedIndex = 0;
    if (location.startsWith('/home'))          selectedIndex = 0;
    else if (location.startsWith('/conversations')) selectedIndex = 1;
    else if (location.startsWith('/calls'))    selectedIndex = 3;
    else if (location.startsWith('/profile'))  selectedIndex = 4;

    return Scaffold(
      body: child,
      bottomNavigationBar: _BottomBar(
        selectedIndex: selectedIndex,
        onTap: (i) {
          switch (i) {
            case 0: context.go('/home');           break;
            case 1: context.go('/conversations');  break;
            case 2: _showNewConversation(context); break;
            case 3: context.go('/calls');          break;
            case 4: context.go('/profile');        break;
          }
        },
      ),
    );
  }

  void _showNewConversation(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _NewConvSheet(),
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
              _NavBtn(icon: Icons.home_outlined,       activeIcon: Icons.home,            label: 'Accueil',    index: 0, selected: selectedIndex, onTap: onTap),
              _NavBtn(icon: Icons.chat_bubble_outline, activeIcon: Icons.chat_bubble,     label: 'Discussions',index: 1, selected: selectedIndex, onTap: onTap),
              _CenterBtn(onTap: () => onTap(2)),
              _NavBtn(icon: Icons.call_outlined,       activeIcon: Icons.call,            label: 'Appels',     index: 3, selected: selectedIndex, onTap: onTap),
              _NavBtn(icon: Icons.person_outline,      activeIcon: Icons.person,          label: 'Profil',     index: 4, selected: selectedIndex, onTap: onTap),
            ],
          ),
        ),
      ),
    );
  }
}

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
              size: 24),
            const SizedBox(height: 3),
            Text(label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w400,
                color: isActive ? AppTheme.primaryBlue : AppTheme.textSecondary,
              )),
          ],
        ),
      ),
    );
  }
}

/// Bouton central "+" — nouvelle conversation
class _CenterBtn extends StatelessWidget {
  const _CenterBtn({ required this.onTap });
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72,
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 44, height: 44,
              decoration: const BoxDecoration(
                color: AppTheme.primaryBlue,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.add, color: Colors.white, size: 24),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Sheet "Nouvelle conversation" ─────────────────────────────────────────────

class _NewConvSheet extends StatelessWidget {
  const _NewConvSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.symmetric(vertical: 10),
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: AppTheme.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Nouvelle conversation',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 0),
          _SheetAction(
            icon: Icons.person_add_outlined,
            label: 'Nouveau message',
            sub: 'Démarrer une conversation avec un contact',
            onTap: () { Navigator.pop(context); context.go('/conversations/new'); },
          ),
          _SheetAction(
            icon: Icons.group_add_outlined,
            label: 'Nouveau groupe',
            sub: 'Créer une conversation de groupe',
            onTap: () { Navigator.pop(context); context.go('/conversations/new-group'); },
          ),
          _SheetAction(
            icon: Icons.call_outlined,
            label: 'Nouvel appel',
            sub: 'Appel audio ou vidéo',
            onTap: () { Navigator.pop(context); context.go('/calls/new'); },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _SheetAction extends StatelessWidget {
  const _SheetAction({ required this.icon, required this.label, required this.sub, required this.onTap });
  final IconData     icon;
  final String       label, sub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 44, height: 44,
        decoration: BoxDecoration(
          color: AppTheme.primaryBlue.withOpacity(0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: AppTheme.primaryBlue, size: 22),
      ),
      title:    Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
      subtitle: Text(sub,   style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
      onTap:    onTap,
    );
  }
}
