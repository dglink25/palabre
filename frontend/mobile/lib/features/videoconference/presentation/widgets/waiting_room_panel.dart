import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';

/// Panneau de la salle d'attente - affiché pour l'hôte pendant une session.
/// Équivalent de WaitingRoomPanel.jsx
class WaitingRoomPanel extends ConsumerStatefulWidget {
  const WaitingRoomPanel({super.key, required this.roomId, required this.onClose});
  final String roomId;
  final VoidCallback onClose;

  @override
  ConsumerState<WaitingRoomPanel> createState() => _WaitingRoomPanelState();
}

class _WaitingRoomPanelState extends ConsumerState<WaitingRoomPanel> {
  List<Map<String, dynamic>> _participants = [];
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await ref.read(apiClientProvider)
          .get<List<dynamic>>('/videoconference/rooms/${widget.roomId}/participants');
      if (mounted) {
        setState(() => _participants = list.cast<Map<String, dynamic>>());
      }
    } catch (_) {}
  }

  Future<void> _admit(String userId) async {
    try {
      await ref.read(apiClientProvider)
          .post<void>('/videoconference/rooms/${widget.roomId}/admit/$userId');
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _kick(String userId) async {
    try {
      await ref.read(apiClientProvider)
          .post<void>('/videoconference/rooms/${widget.roomId}/kick/$userId');
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final active  = _participants.where((p) => p['status'] == 'active').toList();
    final waiting = _participants.where((p) => p['status'] == 'waiting').toList();

    return Column(children: [
      // En-tête
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 48, 8, 8),
        child: Row(children: [
          const Text('Participants', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
          const Spacer(),
          IconButton(icon: const Icon(Icons.close, color: Colors.white54, size: 20), onPressed: widget.onClose),
        ]),
      ),
      const Divider(color: Colors.white12, height: 0),

      Expanded(child: ListView(children: [
        // Actifs
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Text('ACTIFS (${active.length})',
            style: const TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
        ),
        ...active.map((p) => _ParticipantTile(
          participant: p,
          onKick: (uid) => _kick(uid),
          showAdmit: false,
        )),

        // En attente
        if (waiting.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(children: [
              Text('EN ATTENTE',
                style: TextStyle(color: AppTheme.warningAmber.withOpacity(0.8),
                  fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: AppTheme.warningAmber.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('${waiting.length}',
                  style: TextStyle(color: AppTheme.warningAmber, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
            ]),
          ),
          ...waiting.map((p) => _ParticipantTile(
            participant: p,
            onAdmit: (uid) => _admit(uid),
            onKick:  (uid) => _kick(uid),
            showAdmit: true,
          )),
        ],
      ])),
    ]);
  }
}

class _ParticipantTile extends StatelessWidget {
  const _ParticipantTile({
    required this.participant,
    required this.onKick,
    this.onAdmit,
    required this.showAdmit,
  });
  final Map<String, dynamic> participant;
  final void Function(String uid) onKick;
  final void Function(String uid)? onAdmit;
  final bool showAdmit;

  @override
  Widget build(BuildContext context) {
    final uid  = participant['userId'] as String? ?? '';
    final name = participant['fullName'] as String? ?? '?';
    final role = participant['role'] as String? ?? 'participant';
    final isWaiting = participant['status'] == 'waiting';

    return ListTile(
      dense: true,
      leading: CircleAvatar(
        radius: 16,
        backgroundColor: isWaiting
            ? AppTheme.warningAmber.withOpacity(0.2)
            : AppTheme.primaryBlue.withOpacity(0.2),
        child: Text(
          name.substring(0, 1).toUpperCase(),
          style: TextStyle(
            color: isWaiting ? AppTheme.warningAmber : AppTheme.primaryBlue,
            fontWeight: FontWeight.w700, fontSize: 13),
        ),
      ),
      title: Text(name,
        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500)),
      subtitle: Text(
        role == 'host' ? 'Hôte' : role == 'moderator' ? 'Modérateur' : 'Participant',
        style: const TextStyle(color: Colors.white38, fontSize: 11)),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        if (showAdmit && onAdmit != null)
          GestureDetector(
            onTap: () => onAdmit!(uid),
            child: Container(
              width: 28, height: 28,
              margin: const EdgeInsets.only(right: 4),
              decoration: BoxDecoration(color: AppTheme.successGreen, shape: BoxShape.circle),
              child: const Icon(Icons.check, color: Colors.white, size: 16),
            ),
          ),
        if (role != 'host')
          GestureDetector(
            onTap: () => onKick(uid),
            child: Container(
              width: 28, height: 28,
              decoration: BoxDecoration(color: AppTheme.alertRed.withOpacity(0.8), shape: BoxShape.circle),
              child: const Icon(Icons.close, color: Colors.white, size: 16),
            ),
          ),
      ]),
    );
  }
}
