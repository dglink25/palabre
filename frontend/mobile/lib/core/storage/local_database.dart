import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'local_database.g.dart';

// ── Tables ───────────────────────────────────────────────────────────────────

/// Messages persistés localement (ciphertext + métadonnées de statut)
class Messages extends Table {
  TextColumn get id          => text()();
  TextColumn get conversationId => text()();
  TextColumn get fromUserId  => text()();
  TextColumn get toUserId    => text().nullable()();
  TextColumn get toRoomId    => text().nullable()();
  TextColumn get ciphertext  => text()();   // blob chiffré Signal
  TextColumn get senderKeyId => text().nullable()();
  TextColumn get type        => textEnum<MessageType>()();
  TextColumn get status      => textEnum<MessageStatus>()();
  IntColumn  get clientTs    => integer()();
  IntColumn  get serverTs    => integer().nullable()();
  BoolColumn get isMine      => boolean().withDefault(const Constant(false))();
  // Contenu déchiffré mis en cache (null si pas encore déchiffré)
  TextColumn get decryptedText => text().nullable()();
  TextColumn get mediaUrl      => text().nullable()();
  TextColumn get mediaKey      => text().nullable()(); // clé AES chiffrée

  @override
  Set<Column> get primaryKey => {id};
}

/// Conversations (1:1 et groupes)
class Conversations extends Table {
  TextColumn get id            => text()();
  TextColumn get orgId         => text()();
  TextColumn get type          => textEnum<ConversationType>()();
  TextColumn get name          => text().nullable()();   // null pour 1:1
  TextColumn get avatarUrl     => text().nullable()();
  TextColumn get lastMessageId => text().nullable()();
  TextColumn get lastMessageText => text().nullable()();
  IntColumn  get lastMessageTs => integer().nullable()();
  IntColumn  get unreadCount   => integer().withDefault(const Constant(0))();
  BoolColumn get isMuted       => boolean().withDefault(const Constant(false))();
  IntColumn  get updatedAt     => integer()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Participants d'une conversation (pour les groupes et le cache 1:1)
class ConversationMembers extends Table {
  TextColumn get conversationId => text()();
  TextColumn get userId         => text()();
  TextColumn get role           => text().withDefault(const Constant('member'))();

  @override
  Set<Column> get primaryKey => {conversationId, userId};
}

/// Contacts de l'organisation
class Contacts extends Table {
  TextColumn get userId      => text()();
  TextColumn get orgId       => text()();
  TextColumn get fullName    => text()();
  TextColumn get phone       => text().nullable()();
  TextColumn get email       => text().nullable()();
  TextColumn get avatarUrl   => text().nullable()();
  TextColumn get status      => text().withDefault(const Constant('offline'))();
  IntColumn  get lastSeenAt  => integer().nullable()();
  BoolColumn get isOnline    => boolean().withDefault(const Constant(false))();

  @override
  Set<Column> get primaryKey => {userId};
}

/// Historique des appels
class CallHistory extends Table {
  TextColumn get id          => text()();
  TextColumn get callId      => text()();
  TextColumn get type        => textEnum<CallType>()();
  TextColumn get scope       => textEnum<CallScope>()();
  TextColumn get direction   => textEnum<CallDirection>()();
  TextColumn get peerId      => text()();   // userId ou roomId
  TextColumn get peerName    => text()();
  TextColumn get status      => textEnum<CallStatus>()();
  IntColumn  get startedAt   => integer()();
  IntColumn  get answeredAt  => integer().nullable()();
  IntColumn  get endedAt     => integer().nullable()();
  IntColumn  get duration    => integer().nullable()();  // secondes

  @override
  Set<Column> get primaryKey => {id};
}

// ── Enums ─────────────────────────────────────────────────────────────────────

enum MessageType   { text, mediaRef, callSignal, deliveryReceipt, readReceipt, system }
enum MessageStatus { sending, sent, delivered, read, failed }
enum ConversationType { direct, group }
enum CallType      { audio, video }
enum CallScope     { direct, group }
enum CallDirection { incoming, outgoing }
enum CallStatus    { missed, rejected, answered, ongoing }

// ── Database ──────────────────────────────────────────────────────────────────

@DriftDatabase(tables: [Messages, Conversations, ConversationMembers, Contacts, CallHistory])
class LocalDatabase extends _$LocalDatabase {
  LocalDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  // ── Messages ─────────────────────────────────────────────────────────────

  Stream<List<Message>> watchMessages(String conversationId) {
    return (select(messages)
      ..where((m) => m.conversationId.equals(conversationId))
      ..orderBy([(m) => OrderingTerm.asc(m.clientTs)]))
      .watch();
  }

  Future<void> insertMessage(MessagesCompanion msg) async {
    await into(messages).insertOnConflictUpdate(msg);
  }

  Future<void> updateMessageStatus(String id, MessageStatus status) async {
    await (update(messages)..where((m) => m.id.equals(id)))
        .write(MessagesCompanion(status: Value(status)));
  }

  Future<void> cacheDecryptedText(String id, String text) async {
    await (update(messages)..where((m) => m.id.equals(id)))
        .write(MessagesCompanion(decryptedText: Value(text)));
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  Stream<List<Conversation>> watchConversations(String orgId) {
    return (select(conversations)
      ..where((c) => c.orgId.equals(orgId))
      ..orderBy([(c) => OrderingTerm.desc(c.lastMessageTs)]))
      .watch();
  }

  Future<void> upsertConversation(ConversationsCompanion conv) async {
    await into(conversations).insertOnConflictUpdate(conv);
  }

  Future<void> incrementUnread(String conversationId) async {
    await customUpdate(
      'UPDATE conversations SET unread_count = unread_count + 1 WHERE id = ?',
      variables: [Variable(conversationId)],
      updates: {conversations},
    );
  }

  Future<void> clearUnread(String conversationId) async {
    await (update(conversations)..where((c) => c.id.equals(conversationId)))
        .write(const ConversationsCompanion(unreadCount: Value(0)));
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  Stream<List<Contact>> watchContacts(String orgId) {
    return (select(contacts)
      ..where((c) => c.orgId.equals(orgId))
      ..orderBy([(c) => OrderingTerm.asc(c.fullName)]))
      .watch();
  }

  Future<void> upsertContact(ContactsCompanion contact) async {
    await into(contacts).insertOnConflictUpdate(contact);
  }

  Future<void> updatePresence(String userId, bool online, int? lastSeenAt) async {
    await (update(contacts)..where((c) => c.userId.equals(userId)))
        .write(ContactsCompanion(
          isOnline:   Value(online),
          lastSeenAt: Value(lastSeenAt),
          status:     Value(online ? 'online' : 'offline'),
        ));
  }

  // ── Appels ────────────────────────────────────────────────────────────────

  Stream<List<CallHistoryData>> watchCallHistory() {
    return (select(callHistory)
      ..orderBy([(c) => OrderingTerm.desc(c.startedAt)]))
      .watch();
  }

  Future<void> insertCall(CallHistoryCompanion call) async {
    await into(callHistory).insertOnConflictUpdate(call);
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'palabre.db'));
    return NativeDatabase.createInBackground(file);
  });
}

final localDbProvider = Provider<LocalDatabase>((ref) {
  final db = LocalDatabase();
  ref.onDispose(db.close);
  return db;
});
