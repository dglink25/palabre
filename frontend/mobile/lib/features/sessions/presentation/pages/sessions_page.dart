import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';

/// Page Sessions et appareils connectés.
class SessionsPage extends ConsumerStatefulWidget {
  const SessionsPage({super.key});

  @override
  ConsumerState<SessionsPage> createState() => _SessionsPageState();
}

class _SessionsPageState extends ConsumerState<SessionsPage> {
  List<dynamic> _sessions = [];
  bool _loading = true;
  String? _error;
  String? _notice;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ref.read(apiClientProvider).get<List<dynamic>>('/sessions');
      setState(() { _sessions = data; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _revoke(String id) async {
    try {
      await ref.read(apiClientProvider).delete<void>('/sessions/$id');
      setState(() => _notice = 'Session deconnectee.');
      await _load();
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _revokeOthers() async {
    try {
      await ref.read(apiClientProvider).delete<void>('/sessions/others');
      setState(() => _notice = 'Tous les autres appareils ont ete deconnectes.');
      await _load();
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sessions & appareils'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: AppTheme.alertRed.withOpacity(0.08),
                      border: const Border(left: BorderSide(color: AppTheme.alertRed, width: 4)),
                    ),
                    child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed)),
                  ),
                if (_notice != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: AppTheme.successGreen.withOpacity(0.08),
                      border: const Border(left: BorderSide(color: AppTheme.successGreen, width: 4)),
                    ),
                    child: Text(_notice!, style: const TextStyle(color: AppTheme.successGreen)),
                  ),

                ..._sessions.map((s) => _SessionTile(
                  session:  s,
                  onRevoke: s['isCurrent'] == true ? null : () => _revoke(s['id']),
                )).toList(),

                if (_sessions.length > 1) ...[
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: _revokeOthers,
                    icon: const Icon(Icons.logout, size: 18),
                    label: const Text('Deconnecter tous les autres appareils'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.alertRed,
                      side: const BorderSide(color: AppTheme.alertRed),
                      minimumSize: const Size(double.infinity, 48),
                      shape: const RoundedRectangleBorder(),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

class _SessionTile extends StatelessWidget {
  const _SessionTile({ required this.session, this.onRevoke });
  final Map<String, dynamic> session;
  final VoidCallback? onRevoke;

  @override
  Widget build(BuildContext context) {
    final isCurrent = session['isCurrent'] == true;
    final isOnline  = session['isOnline']  == true;
    final platform  = session['platform']  as String? ?? 'Appareil';
    final model     = session['model']     as String?;
    final lastActive = session['last_active_at'] as String?;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.white,
        border: Border.all(
          color: isCurrent ? AppTheme.primaryBlue : AppTheme.border,
          width: isCurrent ? 1.5 : 1,
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: (isCurrent ? AppTheme.primaryBlue : AppTheme.textSecondary).withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              platform.toLowerCase().contains('android') ? Icons.android
                  : platform.toLowerCase().contains('ios') ? Icons.phone_iphone
                  : Icons.computer,
              color: isCurrent ? AppTheme.primaryBlue : AppTheme.textSecondary,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(
                  model != null ? '$platform - $model' : platform,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
                if (isCurrent) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryBlue,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text('Cet appareil',
                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                  ),
                ],
              ]),
              const SizedBox(height: 3),
              Row(children: [
                Container(
                  width: 7, height: 7,
                  decoration: BoxDecoration(
                    color: isOnline ? AppTheme.successGreen : AppTheme.border,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  isOnline ? 'En ligne' : 'Hors ligne',
                  style: TextStyle(
                    fontSize: 12,
                    color: isOnline ? AppTheme.successGreen : AppTheme.textSecondary,
                  ),
                ),
                if (lastActive != null && !isOnline) ...[
                  const Text(' · ', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                  Text(
                    _formatDate(lastActive),
                    style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                  ),
                ],
              ]),
            ]),
          ),
          if (onRevoke != null)
            TextButton(
              onPressed: onRevoke,
              style: TextButton.styleFrom(foregroundColor: AppTheme.alertRed),
              child: const Text('Deco', style: TextStyle(fontSize: 13)),
            ),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return DateFormat('dd/MM HH:mm').format(dt);
    } catch (_) { return ''; }
  }
}
