import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';

/// Page d'invitation de membres - admin organisation.
/// Génère un code d'invitation et un QR code à partager.
/// Équivalent de OrgInvitePage du web.
class OrgInvitePage extends ConsumerStatefulWidget {
  const OrgInvitePage({super.key});

  @override
  ConsumerState<OrgInvitePage> createState() => _OrgInvitePageState();
}

class _OrgInvitePageState extends ConsumerState<OrgInvitePage> {
  String? _joinCode;
  String? _orgId;
  bool    _loading   = false;
  bool    _generating = false;
  String? _error;
  bool    _copied    = false;

  @override
  void initState() {
    super.initState();
    _orgId = ref.read(authStateProvider).valueOrNull?.orgId;
    if (_orgId != null) _loadOrgInfo();
  }

  Future<void> _loadOrgInfo() async {
    setState(() => _loading = true);
    try {
      final data = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/org/me');
      // Si un joinCode existe déjà dans les données org, l'afficher
      // (le backend ne le retourne pas pour raison de sécurité - il faut le régénérer)
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _generateCode() async {
    setState(() { _generating = true; _error = null; _copied = false; });
    try {
      final data = await ref.read(apiClientProvider)
          .post<Map<String, dynamic>>('/org/join-code/generate');
      setState(() => _joinCode = data['joinCode'] as String?);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  void _copyCode() {
    if (_joinCode == null) return;
    Clipboard.setData(ClipboardData(text: _joinCode!));
    setState(() => _copied = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Inviter des membres')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // En-tête explicatif
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryBlue.withOpacity(0.06),
                      border: Border.all(color: AppTheme.primaryBlue.withOpacity(0.2)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Row(children: [
                        Icon(Icons.info_outline, color: AppTheme.primaryBlue, size: 18),
                        SizedBox(width: 8),
                        Text('Comment inviter', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                      ]),
                      const SizedBox(height: 8),
                      Text(
                        '1. Générez un code d\'invitation ci-dessous.\n'
                        '2. Partagez le code ou le QR avec vos collaborateurs.\n'
                        '3. Ils rejoignent l\'organisation depuis l\'app Palabre.',
                        style: TextStyle(fontSize: 13, color: AppTheme.textSecondary, height: 1.5),
                      ),
                    ]),
                  ),
                  const SizedBox(height: 24),

                  // Bouton générer
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _generating ? null : _generateCode,
                      icon: _generating
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.refresh),
                      label: Text(_joinCode == null ? 'Générer un code d\'invitation' : 'Régénérer le code'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryBlue,
                        minimumSize: const Size(double.infinity, 50),
                      ),
                    ),
                  ),

                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: AppTheme.alertRed, fontSize: 13)),
                  ],

                  // Affichage du code et QR
                  if (_joinCode != null) ...[
                    const SizedBox(height: 28),

                    // Code texte
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 20),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppTheme.border, width: 1.5),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(children: [
                          const Text('Code d\'invitation', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                          const SizedBox(height: 8),
                          Text(
                            _joinCode!,
                            style: const TextStyle(
                              fontSize: 32, fontWeight: FontWeight.w800,
                              letterSpacing: 6, color: AppTheme.primaryBlue,
                              fontFamily: 'monospace',
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextButton.icon(
                            icon: Icon(_copied ? Icons.check : Icons.copy, size: 16),
                            label: Text(_copied ? 'Copié !' : 'Copier'),
                            style: TextButton.styleFrom(foregroundColor: AppTheme.primaryBlue),
                            onPressed: _copyCode,
                          ),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // QR code
                    Center(
                      child: Column(children: [
                        const Text('QR Code', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                        const SizedBox(height: 4),
                        const Text('Scannez depuis l\'app Palabre → Rejoindre une organisation',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 16)],
                          ),
                          child: QrImageView(
                            data: '{"type":"org_join","orgId":"$_orgId","joinCode":"$_joinCode"}',
                            version: QrVersions.auto,
                            size: 200,
                            backgroundColor: Colors.white,
                            eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Color(0xFF1a73e8)),
                          ),
                        ),
                      ]),
                    ),
                    const SizedBox(height: 24),

                    // Avertissement
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.warningAmber.withOpacity(0.08),
                        border: Border(left: BorderSide(color: AppTheme.warningAmber, width: 4)),
                      ),
                      child: const Text(
                        'Ce code est à usage unique par collaborateur. Régénérez-le après chaque campagne d\'invitation.',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}
