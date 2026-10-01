import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/network_detector.dart';
import '../theme/app_theme.dart';

/// Badge discret indiquant le mode de connexion actuel.
/// S'affiche uniquement si un tenant est configuré.
class NetworkModeIndicator extends ConsumerWidget {
  const NetworkModeIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detector = ref.watch(networkDetectorProvider);

    if (!detector.isTenantConfigured) return const SizedBox.shrink();

    return StreamBuilder<ConnectionMode>(
      stream: detector.modeStream,
      initialData: detector.currentMode,
      builder: (context, snapshot) {
        final mode = snapshot.data ?? ConnectionMode.relay;
        return _Badge(mode: mode);
      },
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.mode});
  final ConnectionMode mode;

  @override
  Widget build(BuildContext context) {
    final (color, label, icon) = switch (mode) {
      ConnectionMode.direct      => (AppTheme.successGreen, 'Réseau local',        Icons.wifi),
      ConnectionMode.relay       => (AppTheme.warningAmber, 'Via serveur central', Icons.cloud_outlined),
      ConnectionMode.unavailable => (AppTheme.alertRed,     'Hors ligne',          Icons.wifi_off),
    };

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Dot animé en mode relay
          if (mode == ConnectionMode.relay)
            _PulseDot(color: color)
          else
            Container(
              width: 6, height: 6,
              margin: const EdgeInsets.only(right: 6),
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
          const SizedBox(width: 4),
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(label,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }
}

class _PulseDot extends StatefulWidget {
  const _PulseDot({required this.color});
  final Color color;

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double>   _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _anim,
      child: Container(
        width: 6, height: 6,
        margin: const EdgeInsets.only(right: 6),
        decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
      ),
    );
  }
}
