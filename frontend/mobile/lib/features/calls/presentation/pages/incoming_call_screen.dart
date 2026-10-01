import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/services/socket_service.dart';
import '../../../../core/theme/app_theme.dart';

/// Écran de sonnerie pour appel entrant.
/// S'affiche en plein écran quand un appel arrive en avant-plan.
/// Pour les appels en arrière-plan, la notification système (FCM/APNs) gère l'affichage.
class IncomingCallScreen extends ConsumerStatefulWidget {
  const IncomingCallScreen({super.key, required this.callId, required this.extra});
  final String callId;
  final Map<String, dynamic>? extra;

  @override
  ConsumerState<IncomingCallScreen> createState() => _IncomingCallScreenState();
}

class _IncomingCallScreenState extends ConsumerState<IncomingCallScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  late final Animation<double>   _pulse;

  String get _callerName => widget.extra?['peer_name'] ?? widget.extra?['caller_name'] ?? 'Appel entrant';
  String get _callType   => widget.extra?['call_type'] ?? 'audio';
  bool   get _isVideo    => _callType == 'video';

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _pulse = CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  void _accept() {
    context.pushReplacement('/call/${widget.callId}', extra: {
      ...widget.extra ?? {},
      'initiator': false,
    });
  }

  Future<void> _reject() async {
    try {
      await ref.read(socketServiceProvider).sendCallEvent('call:reject', {
        'call_id': widget.callId,
      });
    } catch (_) {}
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.nightBlue,
      body: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // En-tête
            Padding(
              padding: const EdgeInsets.only(top: 40),
              child: Column(children: [
                Text(
                  _isVideo ? 'Appel vidéo entrant' : 'Appel audio entrant',
                  style: const TextStyle(color: Colors.white54, fontSize: 16),
                ),
                const SizedBox(height: 8),
                const Text('Palabre',
                  style: TextStyle(color: Colors.white24, fontSize: 13)),
              ]),
            ),

            // Avatar + nom avec animation pulse
            Column(children: [
              AnimatedBuilder(
                animation: _pulse,
                builder: (_, child) => Container(
                  width: 140 + (_pulse.value * 20),
                  height: 140 + (_pulse.value * 20),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppTheme.primaryBlue.withOpacity(0.3 + _pulse.value * 0.2),
                      width: 2,
                    ),
                  ),
                  child: child,
                ),
                child: CircleAvatar(
                  radius: 60,
                  backgroundColor: AppTheme.primaryBlue.withOpacity(0.3),
                  child: Text(
                    _callerName.substring(0, 1).toUpperCase(),
                    style: const TextStyle(fontSize: 52, color: Colors.white, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(_callerName,
                style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(_isVideo ? Icons.videocam_outlined : Icons.call_outlined,
                  size: 16, color: Colors.white54),
                const SizedBox(width: 6),
                Text(_isVideo ? 'Appel vidéo' : 'Appel audio',
                  style: const TextStyle(color: Colors.white54, fontSize: 15)),
              ]),
            ]),

            // Boutons Refuser / Accepter
            Padding(
              padding: const EdgeInsets.only(bottom: 60),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Refuser
                  _CallBtn(
                    icon: Icons.call_end,
                    color: AppTheme.alertRed,
                    label: 'Refuser',
                    size: 72,
                    onTap: _reject,
                  ),
                  // Accepter
                  _CallBtn(
                    icon: _isVideo ? Icons.videocam : Icons.call,
                    color: AppTheme.successGreen,
                    label: 'Accepter',
                    size: 72,
                    onTap: _accept,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CallBtn extends StatelessWidget {
  const _CallBtn({
    required this.icon, required this.color, required this.label,
    required this.onTap, required this.size,
  });
  final IconData icon;
  final Color    color;
  final String   label;
  final double   size;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: size, height: size,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          child: Icon(icon, color: Colors.white, size: size * 0.45),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 14)),
      ]),
    );
  }
}
