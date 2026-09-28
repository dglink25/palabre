import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/storage/local_database.dart';
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';

class ContactsPage extends ConsumerWidget {
  const ContactsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orgId   = ref.watch(authStateProvider).valueOrNull?.orgId ?? '';
    final stream  = ref.watch(localDbProvider).watchContacts(orgId);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Contacts'),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
        ],
      ),
      body: StreamBuilder<List<Contact>>(
        stream: stream,
        builder: (context, snapshot) {
          final contacts = snapshot.data ?? [];
          if (contacts.isEmpty) {
            return const Center(child: Text('Aucun contact pour le moment.'));
          }

          // Grouper par première lettre
          final grouped = <String, List<Contact>>{};
          for (final c in contacts) {
            final letter = c.fullName.substring(0, 1).toUpperCase();
            grouped.putIfAbsent(letter, () => []).add(c);
          }
          final letters = grouped.keys.toList()..sort();

          return ListView.builder(
            itemCount: letters.length,
            itemBuilder: (context, i) {
              final letter   = letters[i];
              final group    = grouped[letter]!;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    color: AppTheme.offWhite,
                    width: double.infinity,
                    child: Text(letter,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryBlue,
                      )),
                  ),
                  ...group.map((c) => _ContactTile(contact: c)),
                ],
              );
            },
          );
        },
      ),
    );
  }
}

class _ContactTile extends StatelessWidget {
  const _ContactTile({required this.contact});
  final Contact contact;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Stack(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: AppTheme.primaryBlue.withOpacity(0.12),
            backgroundImage: contact.avatarUrl != null
                ? NetworkImage(contact.avatarUrl!)
                : null,
            child: contact.avatarUrl == null
                ? Text(
                    contact.fullName.substring(0, 1).toUpperCase(),
                    style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.w700),
                  )
                : null,
          ),
          // Indicateur de présence
          Positioned(
            bottom: 0, right: 0,
            child: Container(
              width: 12, height: 12,
              decoration: BoxDecoration(
                color: contact.isOnline ? AppTheme.successGreen : AppTheme.border,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          ),
        ],
      ),
      title: Text(contact.fullName,
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
      subtitle: Text(
        contact.isOnline ? 'En ligne' : _lastSeen(contact.lastSeenAt),
        style: TextStyle(
          fontSize: 13,
          color: contact.isOnline ? AppTheme.successGreen : AppTheme.textSecondary,
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: const Icon(Icons.call_outlined, color: AppTheme.primaryBlue, size: 22),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline, color: AppTheme.primaryBlue, size: 22),
            onPressed: () {},
          ),
        ],
      ),
    );
  }

  String _lastSeen(int? ts) {
    if (ts == null) return 'Hors ligne';
    final diff = DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(ts));
    if (diff.inMinutes < 60) return 'Il y a ${diff.inMinutes} min';
    if (diff.inHours < 24)   return 'Il y a ${diff.inHours} h';
    return 'Il y a ${diff.inDays} j';
  }
}
