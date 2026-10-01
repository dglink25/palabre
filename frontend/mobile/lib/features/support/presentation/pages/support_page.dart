import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../pages/support_chat_page.dart';
import '../widgets/support_call_panel.dart';
import '../../data/support_api.dart';

/// Page principale du service client (route /support).
/// Tabs : Messagerie | Appel audio
class SupportPage extends ConsumerStatefulWidget {
  const SupportPage({super.key});

  @override
  ConsumerState<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends ConsumerState<SupportPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  Map<String, dynamic>? _session;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _loadSession();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSession() async {
    setState(() => _loading = true);
    try {
      final data = await ref.read(supportApiProvider).getMySession();
      if (mounted) setState(() => _session = data['session'] as Map<String, dynamic>?);
    } catch (_) {
      // session sera null → SupportChatPage gère le cas
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Service client'),
        bottom: TabBar(
          controller: _tabCtrl,
          labelStyle: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 14),
          unselectedLabelStyle: const TextStyle(fontFamily: 'Inter', fontSize: 14),
          labelColor: AppTheme.primaryBlue,
          unselectedLabelColor: AppTheme.textSecondary,
          indicatorColor: AppTheme.primaryBlue,
          tabs: const [
            Tab(text: 'Messagerie'),
            Tab(text: 'Appel audio'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabCtrl,
              children: [
                const SupportChatPage(),
                SupportCallPanel(
                  session: _session,
                  onSwitchToChat: () => _tabCtrl.animateTo(0),
                ),
              ],
            ),
    );
  }
}
