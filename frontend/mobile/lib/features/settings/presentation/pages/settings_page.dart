import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Paramètres')),
      body: ListView(
        children: [
          _SectionHeader('Notifications'),
          _SettingsTile(
            icon: Icons.notifications_outlined,
            title: 'Notifications de messages',
            trailing: Switch(value: true, onChanged: (_) {}),
          ),
          _SettingsTile(
            icon: Icons.call_outlined,
            title: 'Notifications d\'appels',
            trailing: Switch(value: true, onChanged: (_) {}),
          ),
          const Divider(height: 0),

          _SectionHeader('Confidentialité'),
          _SettingsTile(
            icon: Icons.visibility_outlined,
            title: 'Afficher ma présence',
            trailing: Switch(value: true, onChanged: (_) {}),
          ),
          _SettingsTile(
            icon: Icons.done_all,
            title: 'Accusés de lecture',
            trailing: Switch(value: true, onChanged: (_) {}),
          ),
          const Divider(height: 0),

          _SectionHeader('Stockage'),
          _SettingsTile(
            icon: Icons.storage_outlined,
            title: 'Téléchargement automatique',
            subtitle: 'Wi-Fi uniquement',
            onTap: () {},
          ),
          _SettingsTile(
            icon: Icons.delete_outline,
            title: 'Vider le cache',
            onTap: () {},
          ),
          const Divider(height: 0),

          _SectionHeader('Appels'),
          _SettingsTile(
            icon: Icons.volume_up_outlined,
            title: 'Haut-parleur par défaut',
            trailing: Switch(value: false, onChanged: (_) {}),
          ),
          _SettingsTile(
            icon: Icons.hd_outlined,
            title: 'Appels vidéo HD',
            subtitle: 'Consomme plus de données',
            trailing: Switch(value: true, onChanged: (_) {}),
          ),
          const Divider(height: 0),

          _SectionHeader('À propos'),
          _SettingsTile(
            icon: Icons.info_outline,
            title: 'Version',
            subtitle: '1.0.0',
          ),
          _SettingsTile(
            icon: Icons.security_outlined,
            title: 'Politique de confidentialité',
            onTap: () {},
          ),
          _SettingsTile(
            icon: Icons.description_outlined,
            title: 'Conditions d\'utilisation',
            onTap: () {},
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
      child: Text(title,
          style: const TextStyle(
              fontSize: 13, fontWeight: FontWeight.w700,
              color: AppTheme.primaryBlue, letterSpacing: 0.5)),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
  });

  final IconData  icon;
  final String    title;
  final String?   subtitle;
  final Widget?   trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      tileColor: AppTheme.white,
      leading: Icon(icon, color: AppTheme.textSecondary, size: 22),
      title:   Text(title, style: const TextStyle(fontSize: 15)),
      subtitle: subtitle != null
          ? Text(subtitle!, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13))
          : null,
      trailing: trailing ?? (onTap != null
          ? const Icon(Icons.chevron_right, color: AppTheme.textSecondary)
          : null),
      onTap: onTap,
    );
  }
}
