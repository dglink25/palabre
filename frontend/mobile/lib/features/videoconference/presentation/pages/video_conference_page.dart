import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';

/// Page de liste des vidéoconférences du tenant.
/// Équivalent mobile de VideoConferencePage.jsx
class VideoConferencePage extends ConsumerStatefulWidget {
  const VideoConferencePage({super.key});

  @override
  ConsumerState<VideoConferencePage> createState() => _VideoConferencePageState();
}

class _VideoConferencePageState extends ConsumerState<VideoConferencePage> {
  bool  _loading = true;
  List<Map<String, dynamic>> _rooms   = [];
  List<Map<String, dynamic>> _history = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ref.read(apiClientProvider)
          .get<Map<String, dynamic>>('/videoconference/rooms');
      setState(() {
        _rooms   = List<Map<String, dynamic>>.from(data['rooms'] as List? ?? []);
        _history = List<Map<String, dynamic>>.from(data['history'] as List? ?? []);
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createRoom({bool scheduled = false}) async {
    if (scheduled) {
      _showCreateRoomSheet(scheduled: true);
    } else {
      await _showCreateRoomSheet(scheduled: false);
    }
  }

  Future<void> _showCreateRoomSheet({required bool scheduled}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreateRoomSheet(
        scheduled: scheduled,
        onCreated: (room) {
          Navigator.pop(context);
          _load();
          if (room['status'] == 'active') {
            context.push('/videoconference/${room['id']}', extra: room);
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = ref.watch(authStateProvider).valueOrNull?.orgId != null;

    final active    = _rooms.where((r) => r['status'] == 'active').toList();
    final scheduled = _rooms.where((r) => r['status'] == 'scheduled').toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vidéoconférences'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
          PopupMenuButton<String>(
            icon: const Icon(Icons.add),
            onSelected: (v) {
              if (v == 'now')       _createRoom(scheduled: false);
              if (v == 'schedule')  _createRoom(scheduled: true);
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'now',      child: Text('Lancer maintenant')),
              const PopupMenuItem(value: 'schedule', child: Text('Planifier')),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // En cours
                      if (active.isNotEmpty) ...[
                        _SectionHeader(label: 'En cours', count: active.length, color: AppTheme.successGreen),
                        ...active.map((r) => _RoomCard(room: r, onTap: () => context.push('/videoconference/${r['id']}', extra: r))),
                        const SizedBox(height: 20),
                      ],

                      // Planifiées
                      if (scheduled.isNotEmpty) ...[
                        _SectionHeader(label: 'À venir', count: scheduled.length, color: AppTheme.primaryBlue),
                        ...scheduled.map((r) => _RoomCard(room: r, onTap: () => context.push('/videoconference/${r['id']}', extra: r))),
                        const SizedBox(height: 20),
                      ],

                      // Vide
                      if (active.isEmpty && scheduled.isEmpty)
                        _EmptyState(onTap: () => _createRoom(scheduled: false)),

                      // Historique (admin)
                      if (isAdmin && _history.isNotEmpty) ...[
                        _SectionHeader(label: 'Historique', count: _history.length, color: AppTheme.textSecondary),
                        ..._history.take(10).map((r) => _HistoryTile(room: r)),
                      ],
                    ],
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _createRoom(scheduled: false),
        icon: const Icon(Icons.videocam),
        label: const Text('Nouvelle réunion'),
        backgroundColor: AppTheme.primaryBlue,
      ),
    );
  }
}

// ── Widgets helpers ──────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label, required this.count, required this.color});
  final String label;
  final int    count;
  final Color  color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Container(width: 3, height: 16, color: color,
          margin: const EdgeInsets.only(right: 8)),
        Text(label.toUpperCase(),
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12,
              color: AppTheme.textSecondary, letterSpacing: 0.5)),
        const SizedBox(width: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
          decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
          child: Text('$count', style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w700)),
        ),
      ]),
    );
  }
}

class _RoomCard extends StatelessWidget {
  const _RoomCard({required this.room, required this.onTap});
  final Map<String, dynamic> room;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isActive = room['status'] == 'active';
    final color    = isActive ? AppTheme.successGreen : AppTheme.primaryBlue;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppTheme.border),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(Icons.videocam_outlined, color: color, size: 22),
        ),
        title: Text(room['title'] ?? 'Réunion',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
        subtitle: Text(
          isActive
            ? '${room['participantCount'] ?? 0} participants · En cours'
            : _formatScheduled(room['scheduledAt']),
          style: TextStyle(fontSize: 13, color: isActive ? AppTheme.successGreen : AppTheme.textSecondary),
        ),
        trailing: ElevatedButton(
          onPressed: onTap,
          style: ElevatedButton.styleFrom(
            backgroundColor: isActive ? AppTheme.successGreen : AppTheme.primaryBlue,
            minimumSize: const Size(90, 36),
            padding: const EdgeInsets.symmetric(horizontal: 12),
          ),
          child: Text(isActive ? 'Rejoindre' : 'Détails',
            style: const TextStyle(fontSize: 13)),
        ),
      ),
    );
  }

  String _formatScheduled(dynamic iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso.toString()).toLocal();
      return '${dt.day}/${dt.month} à ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) { return ''; }
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.room});
  final Map<String, dynamic> room;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: const Icon(Icons.history, color: AppTheme.textSecondary, size: 20),
      title: Text(room['title'] ?? 'Réunion',
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
      subtitle: Text(
        '${room['participantCount'] ?? 0} participants · ${room['durationMin'] ?? 0} min',
        style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
      trailing: room['recordingAvailable'] == true
        ? const Icon(Icons.fiber_manual_record, color: AppTheme.alertRed, size: 14)
        : null,
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 40),
          const Icon(Icons.videocam_off_outlined, size: 64, color: AppTheme.border),
          const SizedBox(height: 16),
          const Text('Aucune réunion en cours', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          const SizedBox(height: 8),
          const Text('Lancez ou planifiez une réunion.',
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: onTap,
            icon: const Icon(Icons.videocam),
            label: const Text('Nouvelle réunion'),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue),
          ),
        ],
      ),
    );
  }
}

// ── Sheet de création de réunion ─────────────────────────────────────────────

class _CreateRoomSheet extends ConsumerStatefulWidget {
  const _CreateRoomSheet({required this.scheduled, required this.onCreated});
  final bool scheduled;
  final void Function(Map<String, dynamic> room) onCreated;

  @override
  ConsumerState<_CreateRoomSheet> createState() => _CreateRoomSheetState();
}

class _CreateRoomSheetState extends ConsumerState<_CreateRoomSheet> {
  final _titleCtrl = TextEditingController();
  String  _policy  = 'closed';
  bool    _loading = false;
  String? _error;
  DateTime? _scheduledAt;
  int     _durationMin = 60;

  @override
  void dispose() {
    _titleCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_titleCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Le titre est obligatoire.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final body = {
        'title':        _titleCtrl.text.trim(),
        'accessPolicy': _policy,
        'immediate':    !widget.scheduled,
        if (widget.scheduled && _scheduledAt != null)
          'scheduledAt': _scheduledAt!.toUtc().toIso8601String(),
        if (widget.scheduled)
          'estimatedDurationMin': _durationMin,
      };
      final room = await ref.read(apiClientProvider)
          .post<Map<String, dynamic>>('/videoconference/rooms', data: body);
      widget.onCreated(room);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(child: Container(width: 40, height: 4,
            decoration: BoxDecoration(color: AppTheme.border, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),
          Text(widget.scheduled ? 'Planifier une réunion' : 'Nouvelle réunion',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),

          // Titre
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(labelText: 'Titre de la réunion *'),
          ),
          const SizedBox(height: 12),

          // Politique d'accès
          Row(children: [
            const Text('Accès :', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(width: 12),
            _PolicyBtn(value: 'closed', current: _policy, label: 'Fermé',
              onTap: () => setState(() => _policy = 'closed')),
            const SizedBox(width: 8),
            _PolicyBtn(value: 'open', current: _policy, label: 'Ouvert',
              onTap: () => setState(() => _policy = 'open')),
          ]),

          // Date/heure si planifié
          if (widget.scheduled) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              icon: const Icon(Icons.calendar_today, size: 18),
              label: Text(_scheduledAt == null
                ? 'Choisir date et heure'
                : '${_scheduledAt!.day}/${_scheduledAt!.month} ${_scheduledAt!.hour}:${_scheduledAt!.minute.toString().padLeft(2,'0')}'),
              onPressed: () async {
                final date = await showDatePicker(context: context,
                  initialDate: DateTime.now().add(const Duration(minutes: 10)),
                  firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                if (date == null || !mounted) return;
                final time = await showTimePicker(context: context, initialTime: TimeOfDay.now());
                if (time == null) return;
                setState(() => _scheduledAt = DateTime(date.year, date.month, date.day, time.hour, time.minute));
              },
            ),
          ],

          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: AppTheme.alertRed, fontSize: 13)),
          ],
          const SizedBox(height: 16),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryBlue,
                minimumSize: const Size(double.infinity, 50),
              ),
              child: _loading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text(widget.scheduled ? 'Planifier la réunion' : 'Lancer maintenant'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PolicyBtn extends StatelessWidget {
  const _PolicyBtn({required this.value, required this.current, required this.label, required this.onTap});
  final String value, current, label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isSelected = value == current;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryBlue.withOpacity(0.1) : Colors.transparent,
          border: Border.all(color: isSelected ? AppTheme.primaryBlue : AppTheme.border),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500,
            color: isSelected ? AppTheme.primaryBlue : AppTheme.textSecondary)),
      ),
    );
  }
}
