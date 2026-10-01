import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';

/// Connexion sociale (Google, GitHub, Facebook) via Firebase Auth.
/// Équivalent des connexions fédérées du web.
/// Peut être incluse dans LoginPage ou affichée en page séparée.
class SocialLoginButtons extends ConsumerStatefulWidget {
  const SocialLoginButtons({super.key});

  @override
  ConsumerState<SocialLoginButtons> createState() => _SocialLoginButtonsState();
}

class _SocialLoginButtonsState extends ConsumerState<SocialLoginButtons> {
  bool    _loading  = false;
  String? _provider;
  String? _error;

  // ── Google ────────────────────────────────────────────────────────────────

  Future<void> _loginWithGoogle() async {
    _setLoading('google');
    try {
      final googleUser  = await GoogleSignIn().signIn();
      if (googleUser == null) { _clearLoading(); return; }

      final googleAuth  = await googleUser.authentication;
      final credential  = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken:     googleAuth.idToken,
      );
      final userCred    = await FirebaseAuth.instance.signInWithCredential(credential);
      final idToken     = await userCred.user!.getIdToken();

      await ref.read(authActionsProvider).loginWithFederated(idToken: idToken!);
    } catch (e) {
      setState(() => _error = 'Erreur Google : $e');
    } finally {
      _clearLoading();
    }
  }

  // ── GitHub ────────────────────────────────────────────────────────────────

  Future<void> _loginWithGithub() async {
    _setLoading('github');
    try {
      final provider = GithubAuthProvider();
      final userCred = await FirebaseAuth.instance.signInWithProvider(provider);
      final idToken  = await userCred.user!.getIdToken();
      await ref.read(authActionsProvider).loginWithFederated(idToken: idToken!);
    } catch (e) {
      setState(() => _error = 'Erreur GitHub : $e');
    } finally {
      _clearLoading();
    }
  }

  // ── Facebook ──────────────────────────────────────────────────────────────

  Future<void> _loginWithFacebook() async {
    _setLoading('facebook');
    try {
      final provider = FacebookAuthProvider();
      final userCred = await FirebaseAuth.instance.signInWithProvider(provider);
      final idToken  = await userCred.user!.getIdToken();
      await ref.read(authActionsProvider).loginWithFederated(idToken: idToken!);
    } catch (e) {
      setState(() => _error = 'Erreur Facebook : $e');
    } finally {
      _clearLoading();
    }
  }

  void _setLoading(String provider) => setState(() { _loading = true; _provider = provider; _error = null; });
  void _clearLoading()               => setState(() { _loading = false; _provider = null; });

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // Divider
      Row(children: [
        const Expanded(child: Divider()),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text('ou continuer avec',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textSecondary)),
        ),
        const Expanded(child: Divider()),
      ]),
      const SizedBox(height: 16),

      // Boutons sociaux
      _SocialBtn(
        label:    'Continuer avec Google',
        icon:     Icons.g_mobiledata,
        color:    Colors.white,
        textColor: Colors.black87,
        border:   true,
        loading:  _loading && _provider == 'google',
        onTap:    _loading ? null : _loginWithGoogle,
      ),
      const SizedBox(height: 10),
      _SocialBtn(
        label:    'Continuer avec GitHub',
        icon:     Icons.code,
        color:    const Color(0xFF24292E),
        textColor: Colors.white,
        loading:  _loading && _provider == 'github',
        onTap:    _loading ? null : _loginWithGithub,
      ),
      const SizedBox(height: 10),
      _SocialBtn(
        label:    'Continuer avec Facebook',
        icon:     Icons.facebook,
        color:    const Color(0xFF1877F2),
        textColor: Colors.white,
        loading:  _loading && _provider == 'facebook',
        onTap:    _loading ? null : _loginWithFacebook,
      ),

      if (_error != null) ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppTheme.alertRed.withOpacity(0.08),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed, fontSize: 13)),
        ),
      ],
    ]);
  }
}

class _SocialBtn extends StatelessWidget {
  const _SocialBtn({
    required this.label, required this.icon, required this.color,
    required this.textColor, required this.onTap, required this.loading,
    this.border = false,
  });
  final String label;
  final IconData icon;
  final Color  color, textColor;
  final VoidCallback? onTap;
  final bool loading, border;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton.icon(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: border ? const BorderSide(color: AppTheme.border) : BorderSide.none,
          ),
        ),
        icon: loading
          ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: textColor))
          : Icon(icon, color: textColor, size: 20),
        label: Text(label, style: TextStyle(color: textColor, fontWeight: FontWeight.w500, fontSize: 14)),
      ),
    );
  }
}
