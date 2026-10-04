import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/storage/local_database.dart';
import '../../../../core/services/socket_service.dart';
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../widgets/message_bubble.dart';
import '../widgets/message_input.dart';

class ChatPage extends ConsumerStatefulWidget {
  const ChatPage({super.key, required this.conversationId});
  final String conversationId;

  @override
  ConsumerState<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends ConsumerState<ChatPage> {
  final _scrollCtrl = ScrollController();
  String? _peerName;
  String? _peerId;

  @override
  void initState() {
    super.initState();
    // Vider les non-lus à l'ouverture
    ref.read(localDbProvider).clearUnread(widget.conversationId);
    // S'abonner aux messages entrants
    ref.read(socketServiceProvider).onMessage('receive', _onMessageReceived);
    // Charger les infos de la conversation
    _loadConversationInfo();
  }

  Future<void> _loadConversationInfo() async {
    try {
      final data = await ref.read(apiClientProvider)
          .get<Map<String, dynamic>>('/conversations/${widget.conversationId}');
      if (mounted) {
        setState(() {
          _peerName = data['name'] as String?;
          _peerId   = data['peerId'] as String?;
        });
      }
    } catch (_) {
      // Fallback : afficher un nom générique
    }
  }

  Future<void> _startCall(BuildContext context, String callType) async {
    if (_peerId == null) return;
    try {
      final data = await ref.read(apiClientProvider).post<Map<String, dynamic>>(
        '/calls',
        data: {'calleeId': _peerId, 'callType': callType},
      );
      final callId = data['callId'] as String;
      if (context.mounted) {
        context.push('/call/$callId', extra: {
          'initiator': true,
          'peer_id':   _peerId,
          'peer_name': _peerName ?? 'Contact',
          'call_type': callType,
        });
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Impossible de démarrer l\'appel : $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onMessageReceived(Map<String, dynamic> payload) {
    // Filtrer pour cette conversation seulement
    final convId = payload['conversation_id'] ?? payload['to'];
    if (convId != widget.conversationId) return;

    final db = ref.read(localDbProvider);
    db.insertMessage(MessagesCompanion.insert(
      id:             payload['id'],
      conversationId: widget.conversationId,
      fromUserId:     payload['from'],
      ciphertext:     payload['ciphertext'],
      type:           const Value(MessageType.text),
      status:         const Value(MessageStatus.delivered),
      clientTs:       payload['timestamp'] ?? DateTime.now().millisecondsSinceEpoch,
      isMine:         const Value(false),
    ));
    _scrollToBottom();
  }

  Future<void> _sendMessage(String text) async {
    final authState = ref.read(authStateProvider).valueOrNull;
    if (authState == null) return;

    final msgId  = const Uuid().v7();
    final now    = DateTime.now().millisecondsSinceEpoch;
    final db     = ref.read(localDbProvider);

    // Insérer en local immédiatement (optimistic UI)
    await db.insertMessage(MessagesCompanion.insert(
      id:             msgId,
      conversationId: widget.conversationId,
      fromUserId:     authState.userId!,
      ciphertext:     text, // en prod : chiffrer avec Signal avant insertion
      type:           const Value(MessageType.text),
      status:         const Value(MessageStatus.sending),
      clientTs:       now,
      isMine:         const Value(true),
      decryptedText:  Value(text),
    ));
    _scrollToBottom();

    // Envoyer via WebSocket
    try {
      await ref.read(socketServiceProvider).sendMessage({
        'id':         msgId,
        'to':         widget.conversationId,
        'ciphertext': text, // en prod : ciphertext Signal
        'type':       'text',
        'timestamp':  now,
      });
    } catch (e) {
      await db.updateMessageStatus(msgId, MessageStatus.failed);
    }
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

  @override
  Widget build(BuildContext context) {
    final db           = ref.watch(localDbProvider);
    final messagesStream = db.watchMessages(widget.conversationId);
    final authState    = ref.watch(authStateProvider).valueOrNull;
    final myUserId     = authState?.userId ?? '';

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Row(children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppTheme.primaryBlue.withOpacity(0.12),
            child: Text(
              (_peerName ?? '?').substring(0, 1).toUpperCase(),
              style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w600,
                color: AppTheme.primaryBlue,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              _peerName ?? 'Conversation',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const Text('En ligne', style: TextStyle(fontSize: 12, color: AppTheme.successGreen)),
          ]),
        ]),
        actions: [
          if (_peerId != null) ...[
            IconButton(
              icon: const Icon(Icons.videocam_outlined),
              onPressed: () => _startCall(context, 'video'),
            ),
            IconButton(
              icon: const Icon(Icons.call_outlined),
              onPressed: () => _startCall(context, 'audio'),
            ),
          ],
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: StreamBuilder<List<Message>>(
              stream: messagesStream,
              builder: (context, snapshot) {
                final messages = snapshot.data ?? [];
                return ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: messages.length,
                  itemBuilder: (context, i) {
                    final msg   = messages[i];
                    final isMine = msg.fromUserId == myUserId;
                    return MessageBubble(message: msg, isMine: isMine);
                  },
                );
              },
            ),
          ),
          MessageInput(onSend: _sendMessage),
        ],
      ),
    );
  }
}
