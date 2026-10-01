import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';

import '../../../../core/providers/auth_provider.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/africa_timezones.dart';

// ── Provider profil ───────────────────────────────────────────────────────────
final profileProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(apiClientProvider).get<Map<String, dynamic>>('/me');
});

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  // ── Champs info personnelles ──────────────────────────────────────────────
  final _fullNameCtrl = TextEditingController();
  final _sectorCtrl   = TextEditingController();
  String _locale      = 'fr';
  String _timezone    = 'Africa/Porto-Novo';

  // ── Champs email ──────────────────────────────────────────────────────────
  final _emailCtrl    = TextEditingController();
  final _emailCodeCtrl = TextEditingController();
  String _emailStep   = 'idle'; // idle | code_sent

  // ── Préférences notif ─────────────────────────────────────────────────────
  bool _notifEmail = false;
  bool _notifPush  = true;

  // ── États de chargement ───────────────────────────────────────────────────
  bool _savingInfo    = false;
  bool _savingEmail   = false;
  bool _savingPrefs   = false;
  bool _uploadingPhoto = false;

  bool _initialized = false;

  @override
  void dispose() {
    _fullNameCtrl.dispose();
    _sectorCtrl.dispose();
    _emailCtrl.dispose();
    _emailCodeCtrl.dispose();
    super.dispose();
  }

  void _initFromProfile(Map<String, dynamic> p) {
    if (_initialized) return;
    _initialized = true;
    _fullNameCtrl.text = p['fullName'] as String? ?? '';
    _sectorCtrl.text   = p['sector']   as String? ?? '';
    _locale   = p['locale']   as String? ?? 'fr';
    final tz  = p['timezone'] as String? ?? 'Africa/Porto-Novo';
    _timezone = AfricaTimezones.all.any((e) => e['value'] == tz) ? tz : 'Africa/Porto-Novo';
    _emailCtrl.text = p['email'] as String? ?? '';
    final prefs = p['preferences'] as Map<String, dynamic>? ?? {};
    final notif = prefs['notifications'] as Map<String, dynamic>? ?? {};
    _notifEmail = notif['email'] as bool? ?? false;
    _notifPush  = notif['push']  as bool? ?? true;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  Future<void> _saveInfo() async {
    setState(() => _savingInfo = true);
    try {
      await ref.read(apiClientProvider).patch('/me', data: {
        'fullName': _fullNameCtrl.text.trim(),
        'sector':   _sectorCtrl.text.trim(),
        'locale':   _locale,
        'timezone': _timezone,
      });
      ref.invalidate(profileProvider);
      if (mounted) _showSuccess('Profil mis à jour.');
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _savingInfo = false);
    }
  }

  Future<void> _pickAndUploadPhoto() async {
    final picker = ImagePicker();
    final file   = await picker.pickImage(source: ImageSource.gallery, maxWidth: 800);
    if (file == null || !mounted) return;

    setState(() => _uploadingPhoto = true);
    try {
      final form = FormData.fromMap({
        'photo': await MultipartFile.fromFile(file.path,
            filename: file.path.split('/').last),
      });
      await ref.read(apiClientProvider).upload('/me/photo', form);
      ref.invalidate(profileProvider);
      if (mounted) _showSuccess('Photo mise à jour.');
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _requestEmailCode() async {
    setState(() => _savingEmail = true);
    try {
      await ref.read(apiClientProvider).post('/me/email/request-verification', data: {
        'email': _emailCtrl.text.trim(),
      });
      setState(() => _emailStep = 'code_sent');
      _showSuccess('Code envoyé par e-mail.');
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _savingEmail = false);
    }
  }

  Future<void> _confirmEmail() async {
    setState(() => _savingEmail = true);
    try {
      await ref.read(apiClientProvider).post('/me/email/confirm', data: {
        'email': _emailCtrl.text.trim(),
        'code':  _emailCodeCtrl.text.trim(),
      });
      setState(() { _emailStep = 'idle'; _emailCodeCtrl.clear(); });
      ref.invalidate(profileProvider);
      if (mounted) _showSuccess('Adresse e-mail vérifiée.');
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _savingEmail = false);
    }
  }

  Future<void> _savePrefs() async {
    setState(() => _savingPrefs = true);
    try {
      await ref.read(apiClientProvider).patch('/me/preferences', data: {
        'notifications': {'email': _notifEmail, 'push': _notifPush},
      });
      _showSuccess('Préférences enregistrées.');
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _savingPrefs = false);
    }
  }

  void _showSuccess(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppTheme.successGreen,
      behavior: SnackBarBehavior.floating,
    ));
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppTheme.alertRed,
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Mon profil')),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => Center(child: Text(e.toString(),
            style: const TextStyle(color: AppTheme.alertRed))),
        data: (profile) {
          _initFromProfile(profile);
          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── En-tête ─────────────────────────────────────────────
                _ProfileHeader(
                  profile:        profile,
                  uploading:      _uploadingPhoto,
                  onPickPhoto:    _pickAndUploadPhoto,
                ),
                const SizedBox(height: 20),

                // ── Informations personnelles ────────────────────────────
                _SectionCard(
                  title: 'Informations personnelles',
                  icon:  Icons.person_outline,
                  color: AppTheme.primaryBlue,
                  child: Column(
                    children: [
                      _Field(label: 'Nom complet', child: TextField(
                        controller: _fullNameCtrl,
                        decoration: const InputDecoration(hintText: 'Prénom Nom'),
                      )),
                      _Field(label: 'Secteur d\'activité', child: TextField(
                        controller: _sectorCtrl,
                        decoration: const InputDecoration(hintText: 'Ex. Finance, Santé…'),
                      )),
                      _Field(label: 'Langue', child: DropdownButtonFormField<String>(
                        value: _locale,
                        decoration: const InputDecoration(),
                        items: const [
                          DropdownMenuItem(value: 'fr', child: Text('Français')),
                          DropdownMenuItem(value: 'en', child: Text('English')),
                        ],
                        onChanged: (v) => setState(() => _locale = v ?? 'fr'),
                      )),
                      _Field(label: 'Fuseau horaire', child: _TimezoneSelector(
                        value:    _timezone,
                        onChanged: (v) => setState(() => _timezone = v),
                      )),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _savingInfo ? null : _saveInfo,
                          icon:  _savingInfo
                              ? const SizedBox(width: 16, height: 16,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : const Icon(Icons.check, size: 18),
                          label: const Text('Enregistrer'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primaryBlue,
                            minimumSize: const Size(double.infinity, 48),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // ── Adresse e-mail ───────────────────────────────────────
                _SectionCard(
                  title: 'Adresse e-mail',
                  icon:  Icons.email_outlined,
                  color: const Color(0xFF8B5CF6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // E-mail actuel + badge
                      Row(children: [
                        Expanded(child: Text(
                          'Actuelle : ${profile['email'] ?? 'aucune'}',
                          style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
                        )),
                        if (profile['emailVerified'] == true)
                          _Badge('Vérifiée', AppTheme.successGreen)
                        else if (profile['email'] != null)
                          _Badge('Non vérifiée', AppTheme.warningAmber),
                      ]),
                      const SizedBox(height: 12),

                      if (_emailStep == 'idle') ...[
                        _Field(label: 'Nouvelle adresse e-mail', child: TextField(
                          controller: _emailCtrl,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(hintText: 'adresse@exemple.com'),
                        )),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _savingEmail ? null : _requestEmailCode,
                            icon: _savingEmail
                                ? const SizedBox(width: 16, height: 16,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                : const Icon(Icons.send, size: 16),
                            label: const Text('Envoyer un code'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF8B5CF6),
                              minimumSize: const Size(double.infinity, 48),
                            ),
                          ),
                        ),
                      ] else ...[
                        _Field(label: 'Code reçu par e-mail', child: TextField(
                          controller: _emailCodeCtrl,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 22, letterSpacing: 8, fontWeight: FontWeight.w700),
                          maxLength: 6,
                          decoration: const InputDecoration(counterText: '', hintText: '• • • • • •'),
                        )),
                        const SizedBox(height: 8),
                        Row(children: [
                          Expanded(child: ElevatedButton(
                            onPressed: _savingEmail ? null : _confirmEmail,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF8B5CF6),
                              minimumSize: const Size(0, 48),
                            ),
                            child: _savingEmail
                                ? const SizedBox(width: 16, height: 16,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                : const Text('Confirmer'),
                          )),
                          const SizedBox(width: 10),
                          Expanded(child: OutlinedButton(
                            onPressed: () => setState(() { _emailStep = 'idle'; _emailCodeCtrl.clear(); }),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(0, 48),
                              side: const BorderSide(color: AppTheme.border),
                            ),
                            child: const Text('Annuler', style: TextStyle(color: AppTheme.textSecondary)),
                          )),
                        ]),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // ── Préférences de notification ──────────────────────────
                _SectionCard(
                  title: 'Notifications',
                  icon:  Icons.notifications_outlined,
                  color: const Color(0xFFF59E0B),
                  child: Column(
                    children: [
                      _NotifToggle(
                        title:    'Notifications par e-mail',
                        subtitle: 'Résumé et alertes importantes',
                        value:    _notifEmail,
                        onChanged: (v) => setState(() => _notifEmail = v),
                      ),
                      const Divider(height: 1),
                      _NotifToggle(
                        title:    'Notifications push',
                        subtitle: 'Alertes en temps réel sur cet appareil',
                        value:    _notifPush,
                        onChanged: (v) => setState(() => _notifPush = v),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _savingPrefs ? null : _savePrefs,
                          icon: _savingPrefs
                              ? const SizedBox(width: 16, height: 16,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : const Icon(Icons.check, size: 18),
                          label: const Text('Enregistrer les préférences'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFF59E0B),
                            foregroundColor: Colors.white,
                            minimumSize: const Size(double.infinity, 48),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // ── Sécurité & Sessions ──────────────────────────────────
                _SectionCard(
                  title: 'Sécurité',
                  icon:  Icons.security_outlined,
                  color: AppTheme.successGreen,
                  child: Column(
                    children: [
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.shield_outlined, color: AppTheme.textSecondary),
                        title: const Text('Sécurité et connexion'),
                        trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
                        onTap: () => context.push('/security'),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.devices_outlined, color: AppTheme.textSecondary),
                        title: const Text('Sessions et appareils'),
                        trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
                        onTap: () => context.push('/sessions'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // ── Déconnexion ──────────────────────────────────────────
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      await ref.read(authActionsProvider).logout();
                      if (context.mounted) context.go('/auth/login');
                    },
                    icon:  const Icon(Icons.logout, color: AppTheme.alertRed),
                    label: const Text('Se déconnecter',
                        style: TextStyle(color: AppTheme.alertRed)),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 50),
                      side: const BorderSide(color: AppTheme.alertRed),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Widgets helpers ────────────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.profile,
    required this.uploading,
    required this.onPickPhoto,
  });

  final Map<String, dynamic> profile;
  final bool        uploading;
  final VoidCallback onPickPhoto;

  @override
  Widget build(BuildContext context) {
    final name    = profile['fullName'] as String? ?? 'Utilisateur';
    final email   = profile['email']    as String? ?? '';
    final photoUrl = profile['photoUrl'] as String?;
    final isSuperAdmin = profile['isSuperAdmin'] as bool? ?? false;
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.white,
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: onPickPhoto,
            child: Stack(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: AppTheme.primaryBlue.withOpacity(0.12),
                  backgroundImage: photoUrl != null ? NetworkImage(photoUrl) : null,
                  child: uploading
                      ? const CircularProgressIndicator(strokeWidth: 2)
                      : photoUrl == null
                          ? Text(initial,
                              style: const TextStyle(fontSize: 24, color: AppTheme.primaryBlue, fontWeight: FontWeight.w700))
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
                    child: const Icon(Icons.camera_alt, color: Colors.white, size: 12),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                const SizedBox(height: 2),
                Text(email, style: const TextStyle(
                    fontSize: 13, color: AppTheme.textSecondary)),
                if (isSuperAdmin) ...[
                  const SizedBox(height: 4),
                  _Badge('Super-administrateur', AppTheme.alertRed),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.color,
    required this.child,
  });

  final String  title;
  final IconData icon;
  final Color   color;
  final Widget  child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.white,
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // En-tête de section
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppTheme.border)),
            ),
            child: Row(children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(
              fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textSecondary)),
          const SizedBox(height: 4),
          child,
        ],
      ),
    );
  }
}

class _NotifToggle extends StatelessWidget {
  const _NotifToggle({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final String title, subtitle;
  final bool   value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      title:    Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
      value:    value,
      onChanged: onChanged,
      activeColor: AppTheme.primaryBlue,
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.label, this.color);
  final String label;
  final Color  color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      color: color.withOpacity(0.12),
      child: Text(label,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

/// Sélecteur de fuseau horaire africain.
/// Ouvre un bottom sheet avec la liste groupée.
class _TimezoneSelector extends StatelessWidget {
  const _TimezoneSelector({required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showPicker(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.border),
          color: AppTheme.white,
        ),
        child: Row(children: [
          const Icon(Icons.schedule_outlined, size: 16, color: AppTheme.textSecondary),
          const SizedBox(width: 8),
          Expanded(child: Text(
            AfricaTimezones.labelFor(value),
            style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary),
          )),
          const Icon(Icons.arrow_drop_down, color: AppTheme.textSecondary),
        ]),
      ),
    );
  }

  void _showPicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TimezonePickerSheet(
        current:  value,
        onSelect: (v) { onChanged(v); Navigator.pop(context); },
      ),
    );
  }
}

class _TimezonePickerSheet extends StatefulWidget {
  const _TimezonePickerSheet({required this.current, required this.onSelect});
  final String current;
  final ValueChanged<String> onSelect;

  @override
  State<_TimezonePickerSheet> createState() => _TimezonePickerSheetState();
}

class _TimezonePickerSheetState extends State<_TimezonePickerSheet> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final filtered = AfricaTimezones.all.where((e) =>
        e['label']!.toLowerCase().contains(_search.toLowerCase()) ||
        e['value']!.toLowerCase().contains(_search.toLowerCase())).toList();

    // Grouper
    final Map<String, List<Map<String, String>>> grouped = {};
    for (final e in filtered) {
      grouped.putIfAbsent(e['group']!, () => []).add(e);
    }

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        children: [
          // Handle
          const SizedBox(height: 12),
          Center(child: Container(width: 40, height: 4,
              decoration: BoxDecoration(color: AppTheme.border, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 12),
          const Text('Fuseau horaire',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          // Recherche
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Rechercher une ville…',
                prefixIcon: const Icon(Icons.search, size: 18),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(0),
                  borderSide: const BorderSide(color: AppTheme.border),
                ),
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: ListView(
              children: grouped.entries.map((entry) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // En-tête de groupe
                    Container(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                      color: AppTheme.offWhite,
                      child: Text(entry.key,
                          style: const TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w700,
                              color: AppTheme.primaryBlue, letterSpacing: 0.5)),
                    ),
                    ...entry.value.map((tz) => ListTile(
                      dense: true,
                      title: Text(tz['label']!,
                          style: const TextStyle(fontSize: 14)),
                      trailing: widget.current == tz['value']
                          ? const Icon(Icons.check, color: AppTheme.primaryBlue, size: 18)
                          : null,
                      selected: widget.current == tz['value'],
                      selectedTileColor: AppTheme.primaryBlue.withOpacity(0.06),
                      onTap: () => widget.onSelect(tz['value']!),
                    )),
                  ],
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
