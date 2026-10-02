import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/providers/auth_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/storage/secure_storage.dart';
import '../widgets/waiting_room_panel.dart';

/// Écran de session vidéoconférence - plein écran.
/// Équivalent de VideoRoomPage.jsx
///
/// Architecture white-label :
///   1. POST /videoconference/rooms/:id/join → sessionToken
///   2. POST /videoconference/rooms/:id/session → { domain, roomToken }
///   3. WebView charge https://{domain} avec le token JWT opaque
///   4. Le nom de salle Jitsi n'apparaît jamais dans l'UI
class VideoRoomPage extends ConsumerStatefulWidget {
  const VideoRoomPage({super.key, required this.roomId, this.extra});
  final String roomId;
  final Map<String, dynamic>? extra;

  @override
  ConsumerState<VideoRoomPage> createState() => _VideoRoomPageState();
}

class _VideoRoomPageState extends ConsumerState<VideoRoomPage> {
  // État
  String  _state       = 'loading'; // loading | waiting | admitted | error
  String? _sessionToken;
  String? _errorMsg;
  String  _roomTitle   = 'Réunion';
  bool    _isHost      = false;
  bool    _recording   = false;
  bool    _sidePanel   = false;

  WebViewController? _webCtrl;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _roomTitle = widget.extra?['title'] ?? 'Réunion';
    _isHost    = widget.extra?['myRole'] == 'host' || widget.extra?['myRole'] == 'moderator';
    // Force landscape pour la vidéoconférence
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
      DeviceOrientation.portraitUp,
    ]);
    _joinRoom();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    // Remettre portrait
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    super.dispose();
  }

  // ── Rejoindre ────────────────────────────────────────────────────────────

  Future<void> _joinRoom() async {
    try {
      final result = await ref.read(apiClientProvider)
          .post<Map<String, dynamic>>('/videoconference/rooms/${widget.roomId}/join');

      if (result['status'] == 'admitted') {
        setState(() {
          _sessionToken = result['sessionToken'];
          _state        = 'admitted';
          _isHost       = result['isHost'] ?? _isHost;
        });
        await _initWebView();
      } else if (result['status'] == 'waiting') {
        setState(() => _state = 'waiting');
        _startAdmissionPolling();
      } else {
        setState(() { _state = 'error'; _errorMsg = 'Impossible de rejoindre.'; });
      }
    } catch (e) {
      setState(() { _state = 'error'; _errorMsg = e.toString(); });
    }
  }

  void _startAdmissionPolling() {
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      try {
        final result = await ref.read(apiClientProvider)
            .post<Map<String, dynamic>>('/videoconference/rooms/${widget.roomId}/join');
        if (result['status'] == 'admitted') {
          _pollingTimer?.cancel();
          setState(() {
            _sessionToken = result['sessionToken'];
            _state        = 'admitted';
          });
          await _initWebView();
        }
      } catch (_) { /* silencieux */ }
    });
  }

  // ── WebView Jitsi (white-label) ──────────────────────────────────────────

  Future<void> _initWebView() async {
    if (_sessionToken == null) return;

    try {
      // Résoudre la config Jitsi côté backend (domain + roomToken opaque)
      final config = await ref.read(apiClientProvider)
          .post<Map<String, dynamic>>(
            '/videoconference/rooms/${widget.roomId}/session',
            data: {'sessionToken': _sessionToken},
          );

      final domain    = config['domain']    as String? ?? '';
      final roomToken = config['roomToken'] as String? ?? '';
      final title     = config['displayName'] as String? ?? _roomTitle;

      setState(() {
        _roomTitle = title;
        _isHost    = config['isModerator'] == true || _isHost;
      });

      // Construire la page HTML qui charge Jitsi External API
      // Le domain et roomToken ne sont JAMAIS visibles dans l'UI - uniquement dans la WebView
      final html = _buildJitsiHtml(domain: domain, roomToken: roomToken, displayName: title);

      _webCtrl = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(NavigationDelegate(
          onWebResourceError: (e) => setState(() {
            _state    = 'error';
            _errorMsg = 'Erreur WebView : ${e.description}';
          }),
        ))
        ..loadHtmlString(html, baseUrl: 'https://$domain');
    } catch (e) {
      setState(() { _state = 'error'; _errorMsg = e.toString(); });
    }
  }

  String _buildJitsiHtml({
    required String domain,
    required String roomToken,
    required String displayName,
  }) {
    return '''
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Palabre</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0d1117; overflow: hidden; }
    #meet { width: 100vw; height: 100vh; }
  </style>
  <script src='https://$domain/external_api.js'></script>
</head>
<body>
  <div id="meet"></div>
  <script>
    var api = new JitsiMeetExternalAPI('$domain', {
      roomName: '$roomToken',
      jwt:      '$roomToken',
      parentNode: document.getElementById('meet'),
      width:  '100%',
      height: '100%',
      lang:   'fr',
      userInfo: { displayName: '$displayName' },
      configOverwrite: {
        disableDeepLinking:     true,
        enableWelcomePage:      false,
        enableClosePage:        false,
        disableInviteFunctions: true,
        startWithAudioMuted:    false,
        startWithVideoMuted:    false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK:         false,
        SHOW_WATERMARK_FOR_GUESTS:    false,
        SHOW_BRAND_WATERMARK:         false,
        BRAND_WATERMARK_LINK:         '',
        SHOW_POWERED_BY:              false,
        DISPLAY_WELCOME_FOOTER:       false,
        HIDE_INVITE_MORE_HEADER:      true,
        APP_NAME:                     'Palabre',
        NATIVE_APP_NAME:              'Palabre',
        PROVIDER_NAME:                'Palabre',
        TOOLBAR_ALWAYS_VISIBLE:       false,
      },
    });
    api.addEventListener('readyToClose', function() {
      window.flutter_inappwebview?.callHandler('onLeave');
    });
  </script>
</body>
</html>
''';
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  Future<void> _leave() async {
    try {
      await ref.read(apiClientProvider)
          .post<void>('/videoconference/rooms/${widget.roomId}/leave');
    } catch (_) {}
    if (mounted) context.pop();
  }

  Future<void> _endRoom() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Terminer la réunion'),
        content: const Text('Terminer la réunion pour tous les participants ?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          TextButton(onPressed: () => Navigator.pop(context, true),  child: const Text('Terminer', style: TextStyle(color: AppTheme.alertRed))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ref.read(apiClientProvider)
          .post<void>('/videoconference/rooms/${widget.roomId}/end');
    } catch (_) {}
    if (mounted) context.pop();
  }

  Future<void> _toggleRecording() async {
    try {
      final endpoint = _recording ? 'stop' : 'start';
      await ref.read(apiClientProvider)
          .post<void>('/videoconference/rooms/${widget.roomId}/recording/$endpoint');
      setState(() => _recording = !_recording);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      body: switch (_state) {
        'loading' => _buildLoading(),
        'waiting' => _buildWaiting(),
        'error'   => _buildError(),
        _         => _buildSession(),
      },
    );
  }

  Widget _buildLoading() => const Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      CircularProgressIndicator(color: Colors.white),
      SizedBox(height: 16),
      Text('Connexion à la réunion…', style: TextStyle(color: Colors.white70)),
    ]),
  );

  Widget _buildWaiting() => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.hourglass_empty, size: 64, color: Colors.white54),
      const SizedBox(height: 16),
      const Text('En salle d\'attente', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      const Text('L\'hôte doit vous admettre.', style: TextStyle(color: Colors.white54, fontSize: 14)),
      const SizedBox(height: 24),
      TextButton(
        onPressed: () => context.pop(),
        style: TextButton.styleFrom(foregroundColor: Colors.white54),
        child: const Text('Annuler'),
      ),
    ]),
  );

  Widget _buildError() => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.error_outline, size: 64, color: AppTheme.alertRed),
      const SizedBox(height: 16),
      const Text('Accès impossible', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Text(_errorMsg ?? 'Une erreur est survenue.', textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white54, fontSize: 14)),
      ),
      const SizedBox(height: 24),
      ElevatedButton(onPressed: () => context.pop(), child: const Text('Retour')),
    ]),
  );

  Widget _buildSession() {
    if (_webCtrl == null) return _buildLoading();

    return Stack(children: [
      // WebView Jitsi (plein écran)
      WebViewWidget(controller: _webCtrl!),

      // Barre de contrôle en haut
      Positioned(
        top: 0, left: 0, right: 0,
        child: SafeArea(
          bottom: false,
          child: Container(
            color: Colors.black.withOpacity(0.5),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(children: [
              // Logo Palabre
              const Icon(Icons.forum_rounded, color: Colors.white, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Text(_roomTitle,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                  overflow: TextOverflow.ellipsis),
              ),

              // Indicateur enregistrement
              if (_recording)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  margin: const EdgeInsets.only(right: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.alertRed.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.alertRed.withOpacity(0.5)),
                  ),
                  child: const Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.fiber_manual_record, size: 10, color: AppTheme.alertRed),
                    SizedBox(width: 4),
                    Text('REC', style: TextStyle(color: AppTheme.alertRed, fontSize: 11, fontWeight: FontWeight.w700)),
                  ]),
                ),

              // Participants
              if (_isHost)
                IconButton(
                  icon: Icon(_sidePanel ? Icons.people : Icons.people_outline, color: _sidePanel ? AppTheme.primaryBlue : Colors.white70, size: 22),
                  onPressed: () => setState(() => _sidePanel = !_sidePanel),
                  tooltip: 'Participants',
                ),

              // Enregistrement (host uniquement)
              if (_isHost)
                IconButton(
                  icon: Icon(_recording ? Icons.stop_circle : Icons.fiber_manual_record,
                    color: _recording ? AppTheme.alertRed : Colors.white70, size: 22),
                  onPressed: _toggleRecording,
                  tooltip: _recording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement',
                ),

              // Quitter
              TextButton.icon(
                icon: const Icon(Icons.call_end, size: 16, color: Colors.white),
                label: const Text('Quitter', style: TextStyle(color: Colors.white, fontSize: 13)),
                style: TextButton.styleFrom(
                  backgroundColor: AppTheme.alertRed,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: _leave,
              ),

              // Terminer pour tous (host)
              if (_isHost) ...[
                const SizedBox(width: 6),
                TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor: AppTheme.alertRed,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  ),
                  onPressed: _endRoom,
                  child: const Text('Terminer', style: TextStyle(fontSize: 12)),
                ),
              ],
            ]),
          ),
        ),
      ),

      // Panneau participants (host)
      if (_sidePanel && _isHost)
        Positioned(
          top: 0, right: 0, bottom: 0,
          child: SafeArea(
            child: Container(
              width: 260,
              color: const Color(0xF00d1117),
              child: WaitingRoomPanel(
                roomId: widget.roomId,
                onClose: () => setState(() => _sidePanel = false),
              ),
            ),
          ),
        ),
    ]);
  }
}
