import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';

/// Page "Rejoindre une organisation" - utilisateur standard.
///
/// Deux méthodes :
/// 1. Saisie manuelle : orgId + code d'invitation
/// 2. Scan QR code (contient { orgId, joinCode })
class OrgJoinPage extends ConsumerStatefulWidget {
  const OrgJoinPage({super.key});

  @override
  ConsumerState<OrgJoinPage> createState() => _OrgJoinPageState();
}

class _OrgJoinPageState extends ConsumerState<OrgJoinPage> {
  final _orgIdCtrl   = TextEditingController();
  final _codeCtrl    = TextEditingController();
  bool  _showScanner = false;
  bool  _loading     = false;
  Map<String, dynamic>? _preview;
  String? _error;

  @override
  void dispose() {
    _orgIdCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  // ── QR scan ──────────────────────────────────────────────────────────────

  void _onQrDetected(BarcodeCapture capture) {
    final raw = capture.barcodes.firstOrNull?.rawValue ?? '';
    if (raw.isEmpty) return;
    try {
      // Format : { "orgId": "...", "joinCode": "..." }
      final uri = Uri.tryParse(raw);
      if (uri != null && uri.queryParameters.containsKey('orgId')) {
        _orgIdCtrl.text   = uri.queryParameters['orgId'] ?? '';
        _codeCtrl.text    = uri.queryParameters['joinCode'] ?? '';
      } else {
        // Essayer JSON
        import('dart:convert').then((_) {}).catchError((_) {});
        final parts = raw.replaceAll('{', '').replaceAll('}', '').replaceAll('"', '').split(',');
        for (final p in parts) {
          final kv = p.trim().split(':');
          if (kv.length == 2) {
            if (kv[0].trim() == 'orgId')    _orgIdCtrl.text = kv[1].trim();
            if (kv[0].trim() == 'joinCode') _codeCtrl.text  = kv[1].trim();
          }
        }
      }
      setState(() => _showScanner = false);
      _loadPreview();
    } catch (_) {}
  }

  // ── Prévisualisation ──────────────────────────────────────────────────────

  Future<void> _loadPreview() async {
    final orgId = _orgIdCtrl.text.trim();
    if (orgId.isEmpty) return;
    setState(() { _loading = true; _error = null; _preview = null; });
    try {
      final data = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/org/join-info/$orgId');
      setState(() => _preview = data);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Confirmer la liaison ──────────────────────────────────────────────────

  Future<void> _join() async {
    final orgId    = _orgIdCtrl.text.trim();
    final joinCode = _codeCtrl.text.trim();
    if (orgId.isEmpty || joinCode.isEmpty) {
      setState(() => _error = 'Identifiant et code d\'invitation requis.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final result = await ref.read(apiClientProvider).post<Map<String, dynamic>>(
        '/org/join', data: { 'orgId': orgId, 'joinCode': joinCode },
      );
      await ref.read(secureStorageProvider).saveSession(
        userId: result['user']['id'],
        orgId:  result['organization']['id'],
      );
      await ref.read(authActionsProvider).updateOrgId(result['organization']['id'] as String);
      if (mounted) context.go('/conversations');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_showScanner) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Scanner le QR code'),
          leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => _showScanner = false)),
        ),
        body: MobileScanner(onDetect: _onQrDetected),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Rejoindre une organisation')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Rejoindre mon organisation',
                style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                'Saisissez l\'identifiant et le code fournis par votre administrateur, ou scannez le QR code.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 24),

              // Champs
              TextField(
                controller: _orgIdCtrl,
                decoration: const InputDecoration(labelText: 'Identifiant de l\'organisation'),
                onSubmitted: (_) => _loadPreview(),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _codeCtrl,
                decoration: const InputDecoration(labelText: 'Code d\'invitation'),
              ),

              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.alertRed.withOpacity(0.08),
                    border: const Border(left: BorderSide(color: AppTheme.alertRed, width: 4)),
                  ),
                  child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed, fontSize: 14)),
                ),
              ],

              // Prévisualisation organisation
              if (_preview != null) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.offWhite,
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: Row(children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(color: AppTheme.primaryBlue.withOpacity(0.12)),
                      child: Center(child: Text(
                        (_preview!['name'] as String).substring(0, 1).toUpperCase(),
                        style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.w700, fontSize: 18),
                      )),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_preview!['name'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                      if (_preview!['city'] != null)
                        Text(_preview!['city'] as String, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                    ])),
                  ]),
                ),
              ],

              const SizedBox(height: 24),

              // Boutons
              ElevatedButton(
                onPressed: _loading ? null : _join,
                child: _loading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Rejoindre l\'organisation'),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => setState(() => _showScanner = true),
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('Scanner le QR code'),
                style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 48), shape: const RoundedRectangleBorder()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
