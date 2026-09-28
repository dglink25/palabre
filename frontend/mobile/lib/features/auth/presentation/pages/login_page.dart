import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _phoneCtrl = TextEditingController();
  bool _loading    = false;
  String? _error;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      setState(() => _error = 'Entrez votre numéro de téléphone.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(authActionsProvider).loginWithPhone(phone);
      if (mounted) context.push('/auth/otp', extra: phone);
    } catch (e) {
      setState(() => _error = 'Erreur : $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 40),
              // Logo
              Center(
                child: Column(children: [
                  Container(
                    width: 72, height: 72,
                    color: AppTheme.primaryBlue,
                    child: const Icon(Icons.forum_rounded, color: Colors.white, size: 40),
                  ),
                  const SizedBox(height: 16),
                  const Text('PALABRE',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800,
                        color: AppTheme.primaryBlue, letterSpacing: 2)),
                ]),
              ),
              const SizedBox(height: 48),
              Text('Se connecter',
                style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text('Entrez votre numéro de téléphone pour recevoir un code de vérification.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textSecondary)),
              const SizedBox(height: 32),

              // Champ téléphone
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Numéro de téléphone',
                  hintText:  '+229 XX XX XX XX',
                  prefixIcon: Icon(Icons.phone_outlined),
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
                  child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed, fontSize: 14)),
                ),
              ],

              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Recevoir un code OTP'),
              ),

              const Spacer(),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/activate'),
                  child: const Text('Activer un compte organisation'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
