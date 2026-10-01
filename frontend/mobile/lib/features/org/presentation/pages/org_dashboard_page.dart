import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/network_mode_indicator.dart';

/// Dashboard administrateur de l'organisation.
/// Équivalent de OrgDashboardPage du web.
class OrgDashboardPage extends ConsumerStatefulWidget {
  const OrgDashboardPage({super.key});

  @override
  ConsumerState<OrgDashboardPage> createState() => _OrgDashboardPageState();
}

class _OrgDashboardPageState extends ConsumerState<OrgDashboardPage> {
  Map<String, dynamic>? _org;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ref.read(apiClientProvider).get<Map<String, dynamic>>('/org/me');
      if (mounted) setState(() => _org = data);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mon organisation'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(_error!, style: const TextStyle(color: AppTheme.alertRed)),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _load, child: const Text('Réessayer')),
                ]))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Indicateur réseau
                        const NetworkModeIndicator(),
                        const SizedBox(height: 16),

                        // Carte principale org
                        if (_org != null) _OrgCard(org: _org!),
                        const SizedBox(height: 20),

                        // Statut VPN/Tunnel
                        if (_org != null) _VpnStatusCard(org: _org!),
                        const SizedBox(height: 20),

                        // Actions admin
                        const Text('Administration', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 12),
                        _AdminActions(),
                      ],
                    ),
                  ),
                ),
    );
  }
}

class _OrgCard extends StatelessWidget {
  const _OrgCard({required this.org});
  final Map<String, dynamic> org;

  @override
  Widget build(BuildContext context) {
    final name    = org['name'] ?? 'Organisation';
    final status  = org['status'] ?? 'active';
    final sector  = org['sector'] ?? '';
    final city    = org['city'] ?? '';

    final statusColor = switch (status) {
      'active'    => AppTheme.successGreen,
      'suspended' => AppTheme.alertRed,
      'trial'     => AppTheme.warningAmber,
      _           => AppTheme.textSecondary,
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1557b0), AppTheme.primaryBlue],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          if (org['logoUrl'] != null)
            CircleAvatar(backgroundImage: NetworkImage(org['logoUrl']), radius: 24)
          else
            CircleAvatar(
              radius: 24,
              backgroundColor: Colors.white.withOpacity(0.2),
              child: Text(name.substring(0, 1), style: const TextStyle(fontSize: 20, color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
            if (sector.isNotEmpty) Text(sector, style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ])),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.2),
              border: Border.all(color: statusColor.withOpacity(0.5)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(status.toUpperCase(),
              style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
          ),
        ]),
        if (city.isNotEmpty) ...[
          const SizedBox(height: 12),
          Row(children: [
            const Icon(Icons.location_on_outlined, color: Colors.white54, size: 14),
            const SizedBox(width: 4),
            Text(city, style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ]),
        ],
      ]),
    );
  }
}

class _VpnStatusCard extends StatelessWidget {
  const _VpnStatusCard({required this.org});
  final Map<String, dynamic> org;

  @override
  Widget build(BuildContext context) {
    final vpn        = org['vpn'] as Map<String, dynamic>? ?? {};
    final vpnStatus  = vpn['status'] as String? ?? 'unknown';
    final secondsAgo = vpn['secondsAgo'] as int?;

    final (color, label, icon) = switch (vpnStatus) {
      'active'   => (AppTheme.successGreen, 'Serveur local connecté', Icons.wifi),
      'degraded' => (AppTheme.warningAmber, 'Signal dégradé',         Icons.wifi_find),
      'offline'  => (AppTheme.alertRed,     'Serveur hors ligne',     Icons.wifi_off),
      _          => (AppTheme.textSecondary, 'Statut inconnu',        Icons.help_outline),
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        border: Border.all(color: color.withOpacity(0.2)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Container(
          width: 42, height: 42,
          decoration: BoxDecoration(color: color.withOpacity(0.12), shape: BoxShape.circle),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: color)),
          if (secondsAgo != null)
            Text('Dernier signal il y a ${secondsAgo}s',
              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
        ])),
      ]),
    );
  }
}

class _AdminActions extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final actions = [
      (Icons.person_add_outlined,  'Inviter des membres',   '/org/invite',    AppTheme.primaryBlue),
      (Icons.vpn_key_outlined,     'Tunnel VPN',            '/org/vpn',       AppTheme.successGreen),
      (Icons.videocam_outlined,    'Vidéoconférences',      '/videoconference', const Color(0xFF7c3aed)),
      (Icons.settings_outlined,    'Paramètres',            '/settings',      AppTheme.textSecondary),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.8,
      children: actions.map((a) => _ActionCard(
        icon: a.$1 as IconData,
        label: a.$2 as String,
        route: a.$3 as String,
        color: a.$4 as Color,
      )).toList(),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.icon, required this.label, required this.route, required this.color});
  final IconData icon;
  final String   label, route;
  final Color    color;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push(route),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.white,
          border: Border.all(color: AppTheme.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: color, size: 24),
          const Spacer(),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        ]),
      ),
    );
  }
}
