import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/storage/local_database.dart';
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';

class NewConversationPage extends ConsumerWidget {
  const NewConversationPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orgId  = ref.watch(authStateProvider).valueOrNull?.orgId ?? '';
    final stream = ref.watch(localDbProvider).watchContacts(orgId);

    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize:     0.5,
      maxChildSize:     0.95,
      expand:           false,
      builder: (context, scrollCtrl) {
        return Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppTheme.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Nouveau message', style: Theme.of(context).textTheme.titleLarge),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 0),
            Expanded(
              child: StreamBuilder<List<Contact>>(
                stream: stream,
                builder: (context, snapshot) {
                  final contacts = snapshot.data ?? [];
                  return ListView.builder(
                    controller: scrollCtrl,
                    itemCount:  contacts.length,
                    itemBuilder: (context, i) {
                      final c = contacts[i];
                      return ListTile(
                        leading: CircleAvatar(
                          radius: 20,
                          backgroundColor: AppTheme.primaryBlue.withOpacity(0.12),
                          child: Text(
                            c.fullName.substring(0, 1).toUpperCase(),
                            style: const TextStyle(color: AppTheme.primaryBlue),
                          ),
                        ),
                        title: Text(c.fullName),
                        subtitle: Text(c.isOnline ? 'En ligne' : 'Hors ligne',
                          style: TextStyle(
                            color: c.isOnline ? AppTheme.successGreen : AppTheme.textSecondary,
                          )),
                        onTap: () {
                          Navigator.of(context).pop();
                          context.push('/conversations/${c.userId}');
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
