import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';

class OtpPage extends ConsumerStatefulWidget {
  const OtpPage({super.key, required this.phone});
  final String phone;

  @override
  ConsumerState<OtpPage> createState() => _OtpPageState();
}

class _OtpPageState extends ConsumerState<OtpPage> {
  final _codeCtrl = TextEditingController();
  bool _loading   = false;
  String? _error;

  Future<void> _verify() async {
    final code = _codeCtrl.text.trim();
    if (code.length < 6) {
      setState(() => _error = 'Code à 6 chiffres requis.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(authActionsProvider).verifyOtp(
        phoneE164: widget.phone,
        code:      code,
      );
      if (mounted) context.go('/conversations');
    } catch (e) {
      setState(() => _error = 'Code incorrect ou expiré.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Vérification')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Entrez le code', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text('Un code de 6 chiffres a été envoyé par WhatsApp au ${widget.phone}',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textSecondary)),
              const SizedBox(height: 32),

              TextField(
                controller: _codeCtrl,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: 12),
                decoration: const InputDecoration(
                  counterText: '',
                  hintText: '------',
                ),
                onChanged: (v) { if (v.length == 6) _verify(); },
              ),

              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppTheme.alertRed)),
              ],

              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loading ? null : _verify,
                child: _loading
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Valider'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
