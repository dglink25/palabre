import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers/auth_provider.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  Map<String, dynamic>? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/me');
      if (mounted) setState(() { _profile = data; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mon profil'),
        actions: [
          IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () {}),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Column(
                children: [
                  // En-tête profil
                  Container(
                    color: AppTheme.white,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Stack(
                          children: [
                            CircleAvatar(
                              radius: 44,
                              backgroundColor: AppTheme.primaryBlue.withOpacity(0.12),
                              backgroundImage: _profile?['photoUrl'] != null
                                  ? NetworkImage(_profile!['photoUrl'])
                                  : null,
                              child: _profile?['photoUrl'] == null
                                  ? Text(
                                      (_profile?['fullName'] ?? '?').substring(0, 1).toUpperCase(),
                                      style: const TextStyle(
                                          fontSize: 32, color: AppTheme.primaryBlue,
                                          fontWeight: FontWeight.w700),
                                    )
                                  : null,
                            ),
                            Positioned(
                              bottom: 0, right: 0,
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: AppTheme.primaryBlue,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.camera_alt, color: Colors.white, size: 14),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _profile?['fullName'] ?? 'Utilisateur',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _profile?['phone'] ?? '',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Informations
                  _Section(title: 'Informations', items: [
                    _Item(icon: Icons.email_outlined, label: 'E-mail',
                        value: _profile?['email'] ?? 'Non renseigné'),
                    _Item(icon: Icons.business_outlined, label: 'Organisation',
                        value: _profile?['orgId'] ?? ''),
                  ]),
                  const SizedBox(height: 8),

                  // Sécurité
                  _Section(title: 'Securite', items: [
                    _Item(icon: Icons.security_outlined,    label: 'Securite et connexion',
                        onTap: () => context.push('/security')),
                    _Item(icon: Icons.devices_outlined,     label: 'Sessions et appareils',
                        onTap: () => context.push('/sessions')),
                  ]),
                  const SizedBox(height: 8),

                  // Déconnexion
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        await ref.read(authActionsProvider).logout();
                        if (context.mounted) context.go('/auth/login');
                      },
                      icon: const Icon(Icons.logout, color: AppTheme.alertRed),
                      label: const Text('Se déconnecter',
                          style: TextStyle(color: AppTheme.alertRed)),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 48),
                        side: const BorderSide(color: AppTheme.alertRed),
                        shape: const RoundedRectangleBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.items});
  final String       title;
  final List<_Item>  items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(title,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w700,
                  color: AppTheme.primaryBlue, letterSpacing: 0.5)),
        ),
        Container(
          color: AppTheme.white,
          child: Column(
            children: items.map((item) => _buildItem(context, item)).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildItem(BuildContext context, _Item item) {
    return Column(
      children: [
        ListTile(
          leading: Icon(item.icon, color: AppTheme.textSecondary, size: 22),
          title:   Text(item.label),
          subtitle: item.value != null
              ? Text(item.value!, style: const TextStyle(color: AppTheme.textSecondary))
              : null,
          trailing: item.onTap != null
              ? const Icon(Icons.chevron_right, color: AppTheme.textSecondary)
              : null,
          onTap: item.onTap,
        ),
        const Divider(height: 0, indent: 56),
      ],
    );
  }
}

class _Item {
  const _Item({required this.icon, required this.label, this.value, this.onTap});
  final IconData    icon;
  final String      label;
  final String?     value;
  final VoidCallback? onTap;
}
