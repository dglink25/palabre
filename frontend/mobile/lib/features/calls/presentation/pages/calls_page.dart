import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/storage/local_database.dart';
import '../../../../core/theme/app_theme.dart';

class CallsPage extends ConsumerWidget {
  const CallsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stream = ref.watch(localDbProvider).watchCallHistory();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Appels'),
        actions: [
          IconButton(icon: const Icon(Icons.call_outlined), onPressed: () {}),
        ],
      ),
      body: StreamBuilder<List<CallHistoryData>>(
        stream: stream,
        builder: (context, snapshot) {
          final calls = snapshot.data ?? [];
          if (calls.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.call_outlined, size: 64,
                      color: AppTheme.textSecondary.withOpacity(0.4)),
                  const SizedBox(height: 16),
                  Text('Aucun appel récent',
                      style: Theme.of(context).textTheme.titleMedium
                          ?.copyWith(color: AppTheme.textSecondary)),
                ],
              ),
            );
          }

          return ListView.separated(
            itemCount: calls.length,
            separatorBuilder: (_, __) => const Divider(height: 0, indent: 72),
            itemBuilder: (context, i) => _CallTile(call: calls[i]),
          );
        },
      ),
    );
  }
}

class _CallTile extends StatelessWidget {
  const _CallTile({required this.call});
  final CallHistoryData call;

  @override
  Widget build(BuildContext context) {
    final isMissed  = call.status == CallStatus.missed;
    final isIncoming = call.direction == CallDirection.incoming;
    final isVideo    = call.type == CallType.video;

    return ListTile(
      leading: CircleAvatar(
        radius: 22,
        backgroundColor: AppTheme.primaryBlue.withOpacity(0.12),
        child: Text(
          call.peerName.substring(0, 1).toUpperCase(),
          style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.w700),
        ),
      ),
      title: Text(call.peerName,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: isMissed ? AppTheme.alertRed : AppTheme.textPrimary,
          )),
      subtitle: Row(
        children: [
          Icon(
            isIncoming ? Icons.call_received : Icons.call_made,
            size: 14,
            color: isMissed ? AppTheme.alertRed : AppTheme.successGreen,
          ),
          const SizedBox(width: 4),
          Text(
            isMissed ? 'Manqué' : _duration(call.duration),
            style: TextStyle(
              fontSize: 13,
              color: isMissed ? AppTheme.alertRed : AppTheme.textSecondary,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            _formatDate(call.startedAt),
            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
          ),
        ],
      ),
      trailing: IconButton(
        icon: Icon(
          isVideo ? Icons.videocam_outlined : Icons.call_outlined,
          color: AppTheme.primaryBlue,
        ),
        onPressed: () {},
      ),
    );
  }

  String _duration(int? seconds) {
    if (seconds == null || seconds == 0) return '0:00';
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  String _formatDate(int ts) {
    final dt   = DateTime.fromMillisecondsSinceEpoch(ts);
    final now  = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inDays == 0) return DateFormat('HH:mm').format(dt);
    if (diff.inDays == 1) return 'Hier';
    return DateFormat('dd/MM').format(dt);
  }
}
