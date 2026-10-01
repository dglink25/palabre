import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/support_api.dart';

/// Widget flottant du service client.
/// Affiché dans le ShellPage comme floatingActionButton.
class SupportWidget extends ConsumerStatefulWidget {
  const SupportWidget({super.key});

  @override
  ConsumerState<SupportWidget> createState() => _SupportWidgetState();
}

class _SupportWidgetState extends ConsumerState<SupportWidget> {
  Map<String, dynamic>? _status;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _fetchStatus();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) => _fetchStatus());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchStatus() async {
    final authState = ref.read(authStateProvider).valueOrNull;
    if (authState == null || !authState.isAuthenticated) return;
    try {
      final s = await ref.read(supportApiProvider).getStatus();
      if (mounted) setState(() => _status = s);
    } catch (_) {}
  }

  void _onTap() {
    final authState = ref.read(authStateProvider).valueOrNull;
    if (authState == null || !authState.isAuthenticated) {
      context.go('/auth/login');
      return;
    }
    context.push('/support');
  }

  @override
  Widget build(BuildContext context) {
    final available = _status?['available'] as bool? ?? false;
    final dotColor  = available ? AppTheme.successGreen : AppTheme.warningAmber;

    return FloatingActionButton.extended(
      onPressed: _onTap,
      backgroundColor: AppTheme.primaryBlue,
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(Icons.headset_mic_outlined, color: Colors.white, size: 22),
          Positioned(
            top: -2,
            right: -2,
            child: Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 1.5),
              ),
            ),
          ),
        ],
      ),
      label: const Text(
        'Service client',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
    );
  }
}
