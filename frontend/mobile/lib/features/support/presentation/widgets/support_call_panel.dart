import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/support_api.dart';
import 'support_queue_indicator.dart';

/// Panneau appel audio — intégré dans SupportPage (onglet Appel).
class SupportCallPanel extends ConsumerStatefulWidget {
  const SupportCallPanel({
    super.key,
    required this.session,
    required this.onSwitchToChat,
  });

  final Map<String, dynamic>? session;
  final VoidCallback onSwitchToChat;

  @override
  ConsumerState<SupportCallPanel> createState() => _SupportCallPanelState();
}

class _SupportCallPanelState extends ConsumerState<SupportCallPanel> {
  Map<String, dynamic>? _activeCall;
  Map<String, dynamic>? _status;
  int? _queuePosition;
  bool _loading = false;
  String? _error;
  StreamSubscription<Map<String, dynamic>>? _wsSub;
  final _holdAudio = AudioPlayer();

  @override
  void initState() {
    super.initState();
    _loadStatus();
    _subscribeWs();
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _holdAudio.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    try {
      final s = await ref.read(supportApiProvider).getStatus();
      if (mounted) setState(() => _status = s);
    } catch (_) {}
  }

  void _subscribeWs() {
    final ws = ref.read(supportWsProvider);
    _wsSub = ws.events.listen((msg) {
      switch (msg['type']) {
        case 'support:call:answered':
          setState(() { _activeCall = {...?_activeCall, 'status': 'active'}; });
          _stopHoldMusic();
          break;
        case 'support:call:hold':
          setState(() { _activeCall = {...?_activeCall, 'status': 'hold'}; });
          _playHoldMusic();
          break;
        case 'support:call:resumed':
          setState(() { _activeCall = {...?_activeCall, 'status': 'active'}; });
          _stopHoldMusic();
          break;
        case 'support:call:ended':
          setState(() { _activeCall = null; _queuePosition = null; });
          _stopHoldMusic();
          break;
        case 'support:queue:update':
          final p = msg['payload'] as Map<String, dynamic>?;
          if (p != null && _activeCall != null && p['callId'] == _activeCall!['id']) {
            setState(() => _queuePosition = p['position'] as int?);
          }
          break;
      }
    });
  }

  Future<void> _playHoldMusic() async {
    try {
      await _holdAudio.setAsset('assets/audio/hold-music.mp3');
      await _holdAudio.setVolume(0.3);
      _holdAudio.setLoopMode(LoopMode.one);
      await _holdAudio.play();
    } catch (_) {}
  }

  void _stopHoldMusic() {
    _holdAudio.stop();
  }

  Future<void> _initiateCall() async {
    if (widget.session == null) return;
    setState(() { _loading = true; _error = null; });
    try {
      final result = await ref.read(supportApiProvider).initiateCall();
      setState(() {
        _activeCall    = {'id': result['callId'], 'status': 'queued'};
        _queuePosition = result['position'] as int?;
      });
      _playHoldMusic(); // musique dès la mise en file
    } catch (e) {
      setState(() => _error = e.toString());
      widget.onSwitchToChat();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _hangup() async {
    if (_activeCall == null) return;
    setState(() => _loading = true);
    try {
      await ref.read(supportApiProvider).hangup(_activeCall!['id'] as String);
      setState(() { _activeCall = null; _queuePosition = null; });
      _stopHoldMusic();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final callStatus = _activeCall?['status'] as String?;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          // Statut du service
          if (_activeCall == null && _status != null && _status!['available'] == false)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              color: AppTheme.warningAmber.withOpacity(0.12),
              child: Row(children: [
                const Icon(Icons.info_outline, color: AppTheme.warningAmber, size: 16),
                const SizedBox(width: 8),
                Expanded(child: Text(
                  _status!['queueLength'] != null && (_status!['queueLength'] as int) > 0
                      ? '${_status!['queueLength']} personne(s) en attente'
                      : 'Service momentanément occupé',
                  style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                )),
              ]),
            ),

          // Indicateur de file / hold
          if (callStatus == 'queued' || callStatus == 'hold')
            SupportQueueIndicator(
              position: _queuePosition ?? 1,
              estimatedWaitMinutes: (_queuePosition ?? 1) * 5,
              status: callStatus!,
            ),

          // En communication
          if (callStatus == 'active') ...[
            const Icon(Icons.call, color: AppTheme.successGreen, size: 56),
            const SizedBox(height: 12),
            const Text(
              'En communication avec le support',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.successGreen),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
          ],

          // État initial
          if (_activeCall == null) ...[
            const Icon(Icons.headset_mic_outlined, color: AppTheme.textSecondary, size: 56),
            const SizedBox(height: 16),
            const Text(
              'Appelez directement un conseiller.',
              style: TextStyle(fontSize: 14, color: AppTheme.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
          ],

          // Erreur
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              color: AppTheme.alertRed.withOpacity(0.1),
              child: Text(_error!, style: const TextStyle(color: AppTheme.alertRed, fontSize: 13)),
            ),

          // Bouton appeler / raccrocher
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: _activeCall == null
                ? ElevatedButton.icon(
                    onPressed: _loading ? null : _initiateCall,
                    icon: const Icon(Icons.call),
                    label: Text(_loading ? 'Connexion…' : 'Appeler le support'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.successGreen,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 50),
                    ),
                  )
                : ElevatedButton.icon(
                    onPressed: _loading ? null : _hangup,
                    icon: const Icon(Icons.call_end),
                    label: const Text('Raccrocher'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.alertRed,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 50),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
