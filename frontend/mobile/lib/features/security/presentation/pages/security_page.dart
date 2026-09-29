import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';

/// Page Sécurité — passkeys, 2FA, moyens de connexion.
class SecurityPage extends ConsumerStatefulWidget {
  const SecurityPage({super.key});

  @override
  ConsumerState<SecurityPage> createState() => _SecurityPageState();
}

class _SecurityPageState extends ConsumerState<SecurityPage> {
  List<dynamic> _methods = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ref.read(apiClientProvider).get<List<dynamic>>('/me/recovery-methods');
      setState(() { _methods = data; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Securite')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppTheme.alertRed.withOpacity(0.08),
                      border: const Border(left: BorderSide(color: AppTheme.alertRed, width: 4)),
                    ),
                    child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed)),
                  ),

                // Moyens de connexion
                const _SectionTitle('Moyens de connexion'),
                ..._methods.map((m) => _MethodTile(
                  type:      m['method_type'] as String,
                  reference: m['reference'] as String,
                  verified:  m['verified'] as bool,
                )).toList(),
                if (_methods.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Text('Aucun moyen de connexion enregistre.',
                      style: TextStyle(color: AppTheme.textSecondary)),
                  ),

                const SizedBox(height: 24),

                // Passkeys
                const _SectionTitle('Cles d\'acces (Passkeys)'),
                _ActionTile(
                  icon:    Icons.fingerprint,
                  title:   'Ajouter une cle d\'acces',
                  sub:     'Connexion biometrique sans mot de passe',
                  color:   AppTheme.primaryBlue,
                  onTap:   () {},
                ),

                const SizedBox(height: 24),

                // Double verification
                const _SectionTitle('Double verification'),
                _ActionTile(
                  icon:    Icons.security,
                  title:   'Verification en deux etapes',
                  sub:     'Proteger les actions sensibles',
                  color:   AppTheme.successGreen,
                  onTap:   () {},
                ),
              ],
            ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11, fontWeight: FontWeight.w700,
          color: AppTheme.primaryBlue, letterSpacing: 0.8,
        )),
    );
  }
}

class _MethodTile extends StatelessWidget {
  const _MethodTile({ required this.type, required this.reference, required this.verified });
  final String type, reference;
  final bool   verified;

  @override
  Widget build(BuildContext context) {
    final icon = type == 'phone' ? Icons.phone_outlined
        : type == 'google'      ? Icons.account_circle_outlined
        : Icons.email_outlined;

    final label = type == 'phone' ? 'Telephone' : type == 'google' ? 'Google' : 'E-mail';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.white,
        border: Border.all(color: AppTheme.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(children: [
        Icon(icon, color: AppTheme.primaryBlue, size: 20),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          Text(reference, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
        ])),
        if (verified)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppTheme.successGreen.withOpacity(0.12),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text('Verifie',
              style: TextStyle(color: AppTheme.successGreen, fontSize: 11, fontWeight: FontWeight.w700)),
          ),
      ]),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({ required this.icon, required this.title, required this.sub, required this.color, required this.onTap });
  final IconData icon;
  final String   title, sub;
  final Color    color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppTheme.white,
        border: Border.all(color: AppTheme.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: ListTile(
        leading: Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, color: color, size: 20),
        ),
        title:    Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text(sub,   style: const TextStyle(fontSize: 12)),
        trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
        onTap:    onTap,
      ),
    );
  }
}
