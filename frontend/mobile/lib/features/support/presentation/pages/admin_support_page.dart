import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/support_api.dart';

/// Dashboard service client pour le super-admin (route /admin/support).
class AdminSupportPage extends ConsumerStatefulWidget {
  const AdminSupportPage({super.key});

  @override
  ConsumerState<AdminSupportPage> createState() => _AdminSupportPageState();
}

class _AdminSupportPageState extends ConsumerState<AdminSupportPage> {
  List<Map<String, dynamic>> _sessions  = [];
  Map<String, dynamic>? _queueStatus;
  Map<String, dynamic>? _selected;
  List<Map<String, dynamic>> _messages  = [];
  Map<String, dynamic>? _activeCall;
  bool _loading = true;
  bool _actionLoading = false;
  String? _error;
  final _inputCtrl = TextEditingController();
  StreamSubscription<Map<String, dynamic>>? _wsSub;

  @override
  void initState() {
    super.initState();
    _load();
    _subscribeWs();
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _inputCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ref.read(supportApiProvider).adminGetSessions();
      setState(() {
        _sessions    = List<Map<String, dynamic>>.from(data['sessions'] as List? ?? []);
        _queueStatus = data['queueStatus'] as Map<String, dynamic>?;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _subscribeWs() {
    final ws = ref.read(supportWsProvider);
    ws.connect();
    _wsSub = ws.events.listen((msg) {
      switch (msg['type']) {
        case 'support:call:incoming':
        case 'support:queue:update':
          _load();
          break;
        case 'support:message:new':
          final m = msg['payload'] as Map<String, dynamic>?;
          if (m != null && _selected != null && m['session_id'] == _selected!['id']) {
            setState(() => _messages.add(m));
          }
          break;
        case 'support:call:answered':
          setState(() { _activeCall = {...?_activeCall, 'status': 'active'}; });
          break;
        case 'support:call:hold':
          setState(() { _activeCall = {...?_activeCall, 'status': 'hold'}; });
          _load();
          break;
        case 'support:call:ended':
          setState(() => _activeCall = null);
          _load();
          break;
      }
    });
  }

  Future<void> _selectSession(Map<String, dynamic> session) async {
    setState(() { _selected = session; _messages = []; _activeCall = null; });
    try {
      final data = await ref.read(supportApiProvider).adminGetSession(session['id'] as String);
      setState(() {
        _messages  = List<Map<String, dynamic>>.from(data['messages'] as List? ?? []);
        _activeCall = data['activeCall'] as Map<String, dynamic>?;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _callAction(String action) async {
    if (_selected == null || _activeCall == null) return;
    setState(() => _actionLoading = true);
    try {
      final sid = _selected!['id'] as String;
      final cid = _activeCall!['id'] as String;
      Map<String, dynamic> result;
      switch (action) {
        case 'answer': result = await ref.read(supportApiProvider).adminAnswerCall(sid, cid); break;
        case 'hold':   result = await ref.read(supportApiProvider).adminHoldCall(sid, cid);   break;
        case 'resume': result = await ref.read(supportApiProvider).adminResumeCall(sid, cid); break;
        case 'hangup':
          await ref.read(supportApiProvider).adminHangup(sid, cid);
          setState(() => _activeCall = null);
          return;
        default: return;
      }
      setState(() => _activeCall = {...?_activeCall, 'status': result['status']});
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  Future<void> _startVideo() async {
    if (_selected == null) return;
    setState(() => _actionLoading = true);
    try {
      final data = await ref.read(supportApiProvider).adminStartVideo(_selected!['id'] as String);
      final msg  = data['message'] as Map<String, dynamic>?;
      if (msg != null) setState(() => _messages.add(msg));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  Future<void> _resolve() async {
    if (_selected == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Résoudre la session'),
        content: const Text('Marquer cette session comme résolue ?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Confirmer')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _actionLoading = true);
    try {
      await ref.read(supportApiProvider).adminResolve(_selected!['id'] as String);
      setState(() { _selected = {...?_selected, 'status': 'resolved'}; });
      _load();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  void _sendMessage() {
    final text = _inputCtrl.text.trim();
    if (text.isEmpty || _selected == null) return;
    final ciphertext = jsonEncode({'text': text});
    ref.read(supportWsProvider).sendMessage(
      sessionId:  _selected!['id'] as String,
      ciphertext: ciphertext,
      clientTs:   DateTime.now().millisecondsSinceEpoch,
    );
    setState(() {
      _messages.add({
        'id': 'local_${DateTime.now().millisecondsSinceEpoch}',
        'sender_type': 'super_admin', 'ciphertext': ciphertext,
        'type': 'text', 'status': 'sending', '_local': true,
      });
      _inputCtrl.clear();
    });
  }

  String _decode(String c) {
    try { return (jsonDecode(c) as Map<String, dynamic>)['text'] as String? ?? c; }
    catch (_) { return c; }
  }

  String _elapsed(String? dt) {
    if (dt == null) return '';
    final diff = DateTime.now().difference(DateTime.parse(dt));
    if (diff.inMinutes < 60) return '${diff.inMinutes} min';
    return '${diff.inHours}h${(diff.inMinutes % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final callStatus = _activeCall?['status'] as String?;
    final isOpen = _selected?['status'] == 'open';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Service client — Admin'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _selected == null
              /* ── Liste des sessions ── */
              ? _buildSessionList()
              /* ── Détail session ── */
              : _buildSessionDetail(callStatus, isOpen),
    );
  }

  Widget _buildSessionList() {
    return Column(
      children: [
        if (_queueStatus != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: AppTheme.offWhite,
            child: Row(children: [
              Text('File : ${_queueStatus!['queueLength'] ?? 0}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(width: 16),
              Text(_queueStatus!['adminOnline'] == true ? '● En ligne' : '● Hors ligne',
                style: TextStyle(fontSize: 13, color: _queueStatus!['adminOnline'] == true ? AppTheme.successGreen : AppTheme.alertRed, fontWeight: FontWeight.w600)),
            ]),
          ),
        if (_error != null)
          Container(color: AppTheme.alertRed.withOpacity(0.1), padding: const EdgeInsets.all(8),
            child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed, fontSize: 12))),
        Expanded(
          child: _sessions.isEmpty
              ? const Center(child: Text('Aucune session active', style: TextStyle(color: AppTheme.textSecondary)))
              : ListView.separated(
                  itemCount: _sessions.length,
                  separatorBuilder: (_, __) => const Divider(height: 0),
                  itemBuilder: (_, i) {
                    final s = _sessions[i];
                    return ListTile(
                      leading: const CircleAvatar(backgroundColor: AppTheme.primaryBlue, child: Icon(Icons.person, color: Colors.white, size: 18)),
                      title: Text(s['user_name'] as String? ?? 'Utilisateur', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      subtitle: Text(
                        '${s['channel'] ?? 'chat'} · ${_elapsed(s['created_at'] as String?)}',
                        style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                      ),
                      trailing: s['call_status'] != null
                          ? _StatusChip(s['call_status'] as String)
                          : null,
                      onTap: () => _selectSession(s),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildSessionDetail(String? callStatus, bool isOpen) {
    return Column(
      children: [
        // En-tête session
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.border))),
          child: Row(
            children: [
              IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() { _selected = null; })),
              Expanded(child: Text(_selected?['user_name'] as String? ?? 'Session', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
              if (_error != null)
                Flexible(child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed, fontSize: 11))),
            ],
          ),
        ),

        // Barre d'actions appel
        if (isOpen)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            child: Row(children: [
              if (callStatus == 'queued')
                _ActionBtn('Décrocher', Icons.call, AppTheme.successGreen, () => _callAction('answer'), _actionLoading),
              if (callStatus == 'active')
                _ActionBtn('Attente', Icons.pause, AppTheme.warningAmber, () => _callAction('hold'), _actionLoading),
              if (callStatus == 'hold')
                _ActionBtn('Reprendre', Icons.play_arrow, AppTheme.primaryBlue, () => _callAction('resume'), _actionLoading),
              if (callStatus != null && ['active', 'hold'].contains(callStatus))
                _ActionBtn('Raccrocher', Icons.call_end, AppTheme.alertRed, () => _callAction('hangup'), _actionLoading),
              _ActionBtn('Vidéo', Icons.videocam, AppTheme.primaryBlue, _startVideo, _actionLoading),
              _ActionBtn('Résolu', Icons.check, AppTheme.successGreen, _resolve, _actionLoading),
            ]),
          ),

        // Messages
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            itemCount: _messages.length,
            itemBuilder: (ctx, i) {
              final msg = _messages[i];
              final type = msg['type'] as String? ?? 'text';
              if (type == 'system' || type == 'video_invite') {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      color: AppTheme.offWhite,
                      child: Text(
                        type == 'video_invite' ? '📹 Invitation vidéo envoyée' : _decode(msg['ciphertext'] as String? ?? ''),
                        style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                      ),
                    ),
                  ),
                );
              }
              final isAdmin = msg['sender_type'] == 'super_admin';
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Align(
                  alignment: isAdmin ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.7),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    color: isAdmin ? AppTheme.primaryBlue : AppTheme.offWhite,
                    child: Text(
                      _decode(msg['ciphertext'] as String? ?? ''),
                      style: TextStyle(fontSize: 13, color: isAdmin ? Colors.white : AppTheme.textPrimary),
                    ),
                  ),
                ),
              );
            },
          ),
        ),

        // Saisie
        if (isOpen)
          Container(
            padding: EdgeInsets.only(left: 12, right: 8, top: 8, bottom: MediaQuery.of(context).viewInsets.bottom + 8),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppTheme.border))),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _inputCtrl,
                  decoration: const InputDecoration(hintText: 'Répondre…', border: InputBorder.none),
                  style: const TextStyle(fontSize: 13, fontFamily: 'Inter'),
                ),
              ),
              IconButton(icon: const Icon(Icons.send, color: AppTheme.primaryBlue), onPressed: _sendMessage),
            ]),
          ),
      ],
    );
  }
}

// ── Widgets helpers ────────────────────────────────────────────────────────────

Widget _ActionBtn(String label, IconData icon, Color color, VoidCallback onTap, bool loading) {
  return Padding(
    padding: const EdgeInsets.only(right: 6),
    child: ElevatedButton.icon(
      onPressed: loading ? null : onTap,
      icon: Icon(icon, size: 14),
      label: Text(label, style: const TextStyle(fontSize: 12)),
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    ),
  );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.status);
  final String status;

  @override
  Widget build(BuildContext context) {
    final cfg = {
      'queued': (AppTheme.warningAmber, 'En file'),
      'active': (AppTheme.successGreen, 'Actif'),
      'hold':   (const Color(0xFFFF6D00), 'Attente'),
    }[status] ?? (AppTheme.textSecondary, status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      color: cfg.$1.withOpacity(0.12),
      child: Text(cfg.$2, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: cfg.$1)),
    );
  }
}
