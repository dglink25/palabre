import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';

/// Page de liaison admin - "Joindre mon serveur local"
///
/// L'administrateur scanne le QR code généré lors de l'approbation.
/// Le payload contient : tenantId, controlToken, vpnPrivateKey, heartbeatUrl.
/// Seuls tenantId et controlToken sont transmis au backend.
/// vpnPrivateKey reste sur l'appareil (clé privée, jamais transmise).
class OrgLinkPage extends ConsumerStatefulWidget {
  const OrgLinkPage({super.key});

  @override
  ConsumerState<OrgLinkPage> createState() => _OrgLinkPageState();
}

class _OrgLinkPageState extends ConsumerState<OrgLinkPage> {
  bool  _showScanner = false;
  bool  _loading     = false;
  Map<String, dynamic>? _parsed;
  String? _error;

  // ── QR scan ──────────────────────────────────────────────────────────────

  void _onQrDetected(BarcodeCapture capture) {
    final raw = capture.barcodes.firstOrNull?.rawValue ?? '';
    if (raw.isEmpty) return;
    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      if (data['tenantId'] == null || data['controlToken'] == null) {
        setState(() => _error = 'QR code invalide : tenantId et controlToken requis.');
        return;
      }
      setState(() {
        _parsed      = data;
        _showScanner = false;
        _error       = null;
      });
    } catch (_) {
      setState(() => _error = 'Format QR code invalide. Scannez le QR Palabre transmis lors de l\'approbation.');
    }
  }

  // ── Confirmer la liaison ──────────────────────────────────────────────────

  Future<void> _confirmLink() async {
    if (_parsed == null) return;
    setState(() { _loading = true; _error = null; });
    try {
      final result = await ref.read(apiClientProvider).post<Map<String, dynamic>>(
        '/org/link/admin',
        data: {
          'tenantId':     _parsed!['tenantId'],
          'controlToken': _parsed!['controlToken'],
        },
      );

      // Stocker la clé VPN privée localement (ne quitte jamais l'appareil)
      if (_parsed!['vpnPrivateKey'] != null) {
        await ref.read(secureStorageProvider).saveSignalKey('vpn_private_key', _parsed!['vpnPrivateKey']);
      }

      await ref.read(secureStorageProvider).saveSession(
        userId: result['user']['id'],
        orgId:  result['organization']['id'],
      );

      await ref.read(authActionsProvider).updateOrgId(result['organization']['id'] as String);
      if (mounted) context.go('/org/dashboard');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_showScanner) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Scanner le QR tenant'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => setState(() => _showScanner = false),
          ),
        ),
        body: MobileScanner(onDetect: _onQrDetected),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Lier mon organisation')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Connecter mon serveur local',
                style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                'Scannez le QR code transmis lors de l\'approbation de votre dossier '
                'pour lier votre application à votre organisation.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 32),

              // Bouton scan
              OutlinedButton.icon(
                onPressed: () => setState(() { _showScanner = true; _error = null; }),
                icon: const Icon(Icons.qr_code_scanner, size: 22),
                label: const Text('Scanner le QR code'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 52),
                  shape: const RoundedRectangleBorder(),
                  side: const BorderSide(color: AppTheme.primaryBlue),
                  foregroundColor: AppTheme.primaryBlue,
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.alertRed.withOpacity(0.08),
                    border: const Border(left: BorderSide(color: AppTheme.alertRed, width: 4)),
                  ),
                  child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed, fontSize: 14)),
                ),
              ],

              // Aperçu du payload scanné
              if (_parsed != null) ...[
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.successGreen.withOpacity(0.06),
                    border: Border.all(color: AppTheme.successGreen.withOpacity(0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        const Icon(Icons.check_circle, color: AppTheme.successGreen, size: 18),
                        const SizedBox(width: 8),
                        const Text('QR code detecte', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                      ]),
                      const SizedBox(height: 12),
                      _InfoRow(label: 'Tenant ID', value: _parsed!['tenantId'] as String),
                      _InfoRow(label: 'Heartbeat', value: _parsed!['heartbeatUrl'] as String? ?? 'Non specifie'),
                      _InfoRow(
                        label: 'Cle VPN',
                        value: _parsed!['vpnPrivateKey'] != null
                          ? 'Presente (stockee sur cet appareil uniquement)'
                          : 'Absente',
                        valueColor: _parsed!['vpnPrivateKey'] != null ? AppTheme.successGreen : AppTheme.alertRed,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.warningAmber.withOpacity(0.08),
                    border: const Border(left: BorderSide(color: AppTheme.warningAmber, width: 4)),
                  ),
                  child: const Text(
                    'Verifiez que ce QR code provient bien du super-administrateur Palabre avant de confirmer.',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _loading ? null : _confirmLink,
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.successGreen),
                  child: _loading
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Confirmer la liaison'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => setState(() { _parsed = null; _error = null; }),
                  child: const Text('Scanner un autre QR code'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({ required this.label, required this.value, this.valueColor });
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          width: 90,
          child: Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: valueColor),
            overflow: TextOverflow.ellipsis,
            maxLines: 2,
          ),
        ),
      ]),
    );
  }
}
