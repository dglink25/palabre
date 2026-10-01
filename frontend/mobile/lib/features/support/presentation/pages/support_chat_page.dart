import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/support_api.dart';

class SupportChatPage extends ConsumerStatefulWidget {
  const SupportChatPage({super.key});

  @override
  ConsumerState<SupportChatPage> createState() => _SupportChatPageState();
}

class _SupportChatPageState extends ConsumerState<SupportChatPage> {
  final _scrollCtrl  = ScrollController();
  final _inputCtrl   = TextEditingController();
  final _focusNode   = FocusNode();

  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic>? _session;
  bool _loading = true;
  bool _sending = false;
  String? _error;
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
    _scrollCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ref.read(supportApiProvider).getMySession();
      setState(() {
        _session  = data['session'] as Map<String, dynamic>?;
        _messages = List<Map<String, dynamic>>.from(data['messages'] as List? ?? []);
      });
      _scrollToBottom();
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
        case 'support:message:new':
          final m = msg['payload'] as Map<String, dynamic>?;
          if (m != null && _session != null && m['session_id'] == _session!['id']) {
            setState(() => _messages.add(m));
            _scrollToBottom();
          }
          break;
        case 'support:video:invite':
          final m = msg['payload']?['message'] as Map<String, dynamic>?;
          if (m != null && _session != null && m['session_id'] == _session!['id']) {
            setState(() => _messages.add(m));
            _scrollToBottom();
          }
          break;
        case 'support:session:resolved':
          setState(() => _session = {...?_session, 'status': 'resolved'});
          break;
      }
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _inputCtrl.text.trim();
    if (text.isEmpty || _session == null) return;

    setState(() => _sending = true);
    final ciphertext = jsonEncode({'text': text});

    // Message optimiste
    final optimistic = {
      'id':          'local_${DateTime.now().millisecondsSinceEpoch}',
      'sender_type': 'user',
      'ciphertext':  ciphertext,
      'type':        'text',
      'status':      'sending',
      'client_ts':   DateTime.now().millisecondsSinceEpoch,
      '_local':      true,
    };
    setState(() { _messages.add(optimistic); _inputCtrl.clear(); });
    _scrollToBottom();

    ref.read(supportWsProvider).sendMessage(
      sessionId:  _session!['id'] as String,
      ciphertext: ciphertext,
      clientTs:   DateTime.now().millisecondsSinceEpoch,
    );
    setState(() => _sending = false);
  }

  String _decode(String ciphertext) {
    try {
      final obj = jsonDecode(ciphertext) as Map<String, dynamic>;
      return obj['text'] as String? ?? ciphertext;
    } catch (_) { return ciphertext; }
  }

  @override
  Widget build(BuildContext context) {
    final isResolved = _session?['status'] == 'resolved';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Service client'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(_error!, style: const TextStyle(color: AppTheme.alertRed)),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _load, child: const Text('Réessayer')),
                  ]),
                )
              : Column(
                  children: [
                    // Zone messages
                    Expanded(
                      child: _messages.isEmpty
                          ? const Center(
                              child: Text(
                                'Démarrez la conversation.',
                                style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                              ),
                            )
                          : ListView.builder(
                              controller: _scrollCtrl,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              itemCount: _messages.length,
                              itemBuilder: (ctx, i) => _buildMessage(_messages[i]),
                            ),
                    ),

                    // Bannière session résolue
                    if (isResolved)
                      Container(
                        padding: const EdgeInsets.all(12),
                        color: AppTheme.successGreen.withOpacity(0.1),
                        child: const Row(children: [
                          Icon(Icons.check_circle_outline, color: AppTheme.successGreen, size: 16),
                          SizedBox(width: 8),
                          Expanded(child: Text('Session résolue. Rouvrez l\'app pour une nouvelle session.', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary))),
                        ]),
                      ),

                    // Zone saisie
                    if (!isResolved)
                      Container(
                        decoration: const BoxDecoration(
                          border: Border(top: BorderSide(color: AppTheme.border)),
                          color: AppTheme.white,
                        ),
                        padding: EdgeInsets.only(
                          left: 12, right: 8, top: 8,
                          bottom: MediaQuery.of(context).viewInsets.bottom + 8,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _inputCtrl,
                                focusNode: _focusNode,
                                minLines: 1,
                                maxLines: 4,
                                textInputAction: TextInputAction.send,
                                onSubmitted: (_) => _sendMessage(),
                                decoration: const InputDecoration(
                                  hintText: 'Écrivez votre message…',
                                  border: InputBorder.none,
                                  contentPadding: EdgeInsets.symmetric(vertical: 8),
                                ),
                                style: const TextStyle(fontFamily: 'Inter', fontSize: 14),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.send, color: AppTheme.primaryBlue),
                              onPressed: _sending ? null : _sendMessage,
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
    );
  }

  Widget _buildMessage(Map<String, dynamic> msg) {
    final type = msg['type'] as String? ?? 'text';

    // Message système
    if (type == 'system') {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            color: AppTheme.offWhite,
            child: Text(
              _decode(msg['ciphertext'] as String? ?? ''),
              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
            ),
          ),
        ),
      );
    }

    // Invitation vidéo
    if (type == 'video_invite') {
      Map<String, dynamic> invite = {};
      try { invite = jsonDecode(msg['ciphertext'] as String) as Map<String, dynamic>; } catch (_) {}
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Center(
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.primaryBlue.withOpacity(0.08),
              border: Border.all(color: AppTheme.primaryBlue.withOpacity(0.3)),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.videocam, color: AppTheme.primaryBlue, size: 18),
                SizedBox(width: 6),
                Text('Invitation vidéoconférence', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primaryBlue, fontSize: 14)),
              ]),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: () {
                  final roomId = invite['roomId'] as String?;
                  if (roomId != null) context.push('/videoconference/$roomId');
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, minimumSize: const Size(180, 40)),
                child: const Text('Rejoindre la vidéoconférence'),
              ),
            ]),
          ),
        ),
      );
    }

    // Message texte
    final isMe = msg['sender_type'] == 'user';
    final isLocal = msg['_local'] == true;
    final status  = msg['status'] as String? ?? 'sent';

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Align(
        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.7),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          color: isMe ? AppTheme.primaryBlue : AppTheme.offWhite,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _decode(msg['ciphertext'] as String? ?? ''),
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  color: isMe ? Colors.white : AppTheme.textPrimary,
                ),
              ),
              if (isMe) ...[
                const SizedBox(height: 2),
                Text(
                  isLocal ? '…' : (status == 'read' ? '✓✓' : status == 'delivered' ? '✓✓' : '✓'),
                  style: TextStyle(
                    fontSize: 10,
                    color: status == 'read' && !isLocal
                        ? Colors.white
                        : Colors.white.withOpacity(0.6),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
