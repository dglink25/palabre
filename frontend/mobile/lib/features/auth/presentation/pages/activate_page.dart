import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';

/// Page d'activation du compte administrateur d'organisation.
/// Permet de saisir manuellement l'ID org + code, OU de scanner le QR code.
class ActivatePage extends ConsumerStatefulWidget {
  const ActivatePage({super.key});

  @override
  ConsumerState<ActivatePage> createState() => _ActivatePageState();
}

class _ActivatePageState extends ConsumerState<ActivatePage> {
  final _orgIdCtrl = TextEditingController();
  final _codeCtrl  = TextEditingController();
  bool _loading    = false;
  bool _showScanner = false;
  String? _error;

  Future<void> _activate() async {
    final orgId = _orgIdCtrl.text.trim();
    final code  = _codeCtrl.text.trim();
    if (orgId.isEmpty || code.isEmpty) {
      setState(() => _error = 'Identifiant et code requis.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(authActionsProvider).activateOrg(orgId: orgId, code: code);
      if (mounted) context.go('/conversations');
    } catch (e) {
      setState(() => _error = 'Code invalide ou expiré. Vérifiez vos informations.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onQrDetected(BarcodeCapture capture) {
    final raw = capture.barcodes.firstOrNull?.rawValue ?? '';
    if (raw.isEmpty) return;
    // Format QR attendu : "palabre://activate?org=XXX&code=YYY"
    try {
      final uri = Uri.parse(raw);
      _orgIdCtrl.text = uri.queryParameters['org'] ?? '';
      _codeCtrl.text  = uri.queryParameters['code'] ?? '';
      setState(() => _showScanner = false);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_showScanner) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Scanner le QR code'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => setState(() => _showScanner = false),
          ),
        ),
        body: MobileScanner(onDetect: _onQrDetected),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Activer mon organisation')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Activation', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                'Saisissez l\'identifiant de votre organisation et le code d\'activation reçus par e-mail et WhatsApp.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 32),

              TextField(
                controller: _orgIdCtrl,
                decoration: const InputDecoration(
                  labelText: 'Identifiant organisation',
                  hintText:  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
                  prefixIcon: Icon(Icons.business_outlined),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _codeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Code d\'activation',
                  hintText:  'XXXXXXXX',
                  prefixIcon: Icon(Icons.key_outlined),
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.alertRed.withOpacity(0.08),
                    border: const Border(left: BorderSide(color: AppTheme.alertRed, width: 4)),
                  ),
                  child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed)),
                ),
              ],

              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loading ? null : _activate,
                child: _loading
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Activer'),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => setState(() => _showScanner = true),
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('Scanner le QR code'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48),
                  shape: const RoundedRectangleBorder(),
                ),
              ),
              const SizedBox(height: 24),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/auth/login'),
                  child: const Text('Déjà un compte ? Se connecter'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
