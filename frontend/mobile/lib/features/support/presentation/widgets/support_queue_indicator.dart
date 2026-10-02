import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

/// Indicateur de position en file d'attente - affiché pendant un appel en attente.
class SupportQueueIndicator extends StatelessWidget {
  const SupportQueueIndicator({
    super.key,
    required this.position,
    this.estimatedWaitMinutes,
    this.status = 'queued',
  });

  final int    position;
  final int?   estimatedWaitMinutes;
  final String status;  // 'queued' | 'hold'

  @override
  Widget build(BuildContext context) {
    final isHold = status == 'hold';
    final color  = isHold ? AppTheme.warningAmber : AppTheme.primaryBlue;
    final label  = isHold ? 'Appel en attente' : 'En file d\'attente';
    final icon   = isHold ? Icons.pause_circle_outline : Icons.hourglass_top_outlined;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: color,
                  ),
                ),
                const SizedBox(height: 2),
                if (!isHold)
                  Text(
                    'Position : $position'
                    '${estimatedWaitMinutes != null ? ' - ~$estimatedWaitMinutes min' : ''}',
                    style: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                if (isHold)
                  const Text(
                    'Votre conseiller revient dans quelques instants…',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
