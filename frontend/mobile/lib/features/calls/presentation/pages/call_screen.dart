import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/services/socket_service.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';

/// Écran d'appel plein écran - audio ou vidéo.
///
/// Flux WebRTC :
///   1. CallScreen reçoit le callId + type (audio/video)
///   2. Initialise getUserMedia (micro + caméra si vidéo)
///   3. Crée RTCPeerConnection avec STUN/TURN
///   4. Si initiateur : createOffer → signaling via socket
///   5. Si récepteur  : setRemoteDescription(offer) → createAnswer
///   6. Échange ICE candidates via socket
///   7. Appel établi en UDP/SRTP
class CallScreen extends ConsumerStatefulWidget {
  const CallScreen({super.key, required this.callId, this.extra});
  final String callId;
  final Map<String, dynamic>? extra;

  @override
  ConsumerState<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends ConsumerState<CallScreen> {
  RTCPeerConnection? _pc;
  MediaStream?       _localStream;
  MediaStream?       _remoteStream;

  final _localRenderer  = RTCVideoRenderer();
  final _remoteRenderer = RTCVideoRenderer();

  bool _isMuted    = false;
  bool _isSpeaker  = true;
  bool _isVideo    = false;
  bool _videoOff   = false;
  bool _isRinging  = true;
  bool _callActive = false;
  String _peerName = 'Appel...';
  String _status   = 'Connexion...';
  int _callDuration = 0;

  late final bool _isInitiator;
  late final String _peerId;

  @override
  void initState() {
    super.initState();
    _isInitiator = widget.extra?['initiator'] == true;
    _peerId      = widget.extra?['peer_id'] ?? '';
    _peerName    = widget.extra?['peer_name'] ?? 'Appel';
    _isVideo     = widget.extra?['call_type'] == 'video';

    _initialize();
  }

  Future<void> _initialize() async {
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();

    // Obtenir le flux local
    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': _isVideo ? {'facingMode': 'user'} : false,
    });

    if (mounted) {
      setState(() {
        _localRenderer.srcObject = _localStream;
      });
    }

    // Activer le haut-parleur immédiatement (audio sort par le haut-parleur par défaut)
    if (_isSpeaker) {
      await Helper.setSpeakerphoneOn(true);
    }

    // Récupérer les credentials TURN dynamiques depuis le backend
    List<Map<String, dynamic>> iceServers = [
      {'urls': 'stun:stun.l.google.com:19302'},
    ];
    try {
      final data = await ref.read(apiClientProvider)
          .get<Map<String, dynamic>>('/calls/turn-credentials');
      final servers = data['iceServers'] as List<dynamic>?;
      if (servers != null) {
        iceServers = servers.cast<Map<String, dynamic>>();
      }
    } catch (_) {
      // Fallback TURN local si le backend est inaccessible
      iceServers.add({
        'urls':       'turn:${widget.extra?['turn_url'] ?? 'localhost:3478'}',
        'username':   widget.extra?['turn_user'] ?? 'palabre',
        'credential': widget.extra?['turn_pass'] ?? 'palabre',
      });
    }

    // Créer la PeerConnection
    _pc = await createPeerConnection({
      'iceServers':        iceServers,
      'iceTransportPolicy': 'all',
    });

    _localStream!.getTracks().forEach((track) {
      _pc!.addTrack(track, _localStream!);
    });

    _pc!.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        setState(() {
          _remoteRenderer.srcObject = event.streams[0];
          _remoteStream = event.streams[0];
          _callActive   = true;
          _isRinging    = false;
          _status       = 'En cours';
          _startTimer();
        });
      }
    };

    _pc!.onIceCandidate = (candidate) {
      ref.read(socketServiceProvider).sendCallEvent('ice:candidate', {
        'call_id':   widget.callId,
        'candidate': candidate.toMap(),
      });
    };

    // Écouter les événements de signaling
    ref.read(socketServiceProvider).onCall(_onCallEvent);

    if (_isInitiator) {
      final offer = await _pc!.createOffer();
      await _pc!.setLocalDescription(offer);
      await ref.read(socketServiceProvider).sendCallEvent('sdp:offer', {
        'call_id': widget.callId,
        'sdp':     offer.toMap(),
      });
      setState(() => _status = 'En attente de réponse...');
    }
  }

  void _onCallEvent(Map<String, dynamic> payload) {
    final event = payload['event'] ?? payload['type'] ?? '';

    switch (event) {
      case 'sdp:offer':
        if (!_isInitiator) _handleOffer(payload);
      case 'sdp:answer':
        if (_isInitiator)  _handleAnswer(payload);
      case 'ice:candidate':
        _handleIceCandidate(payload);
      case 'call:ended':
      case 'call:rejected':
        _endCall(remote: true);
    }
  }

  Future<void> _handleOffer(Map<String, dynamic> payload) async {
    final sdp = payload['sdp'];
    if (sdp == null || _pc == null) return;
    await _pc!.setRemoteDescription(
      RTCSessionDescription(sdp['sdp'], sdp['type']));
    final answer = await _pc!.createAnswer();
    await _pc!.setLocalDescription(answer);
    await ref.read(socketServiceProvider).sendCallEvent('sdp:answer', {
      'call_id': widget.callId,
      'sdp':     answer.toMap(),
    });
    setState(() { _isRinging = false; _status = 'Connexion établie...'; });
  }

  Future<void> _handleAnswer(Map<String, dynamic> payload) async {
    final sdp = payload['sdp'];
    if (sdp == null || _pc == null) return;
    await _pc!.setRemoteDescription(
      RTCSessionDescription(sdp['sdp'], sdp['type']));
  }

  Future<void> _handleIceCandidate(Map<String, dynamic> payload) async {
    final c = payload['candidate'];
    if (c == null || _pc == null) return;
    await _pc!.addCandidate(
      RTCIceCandidate(c['candidate'], c['sdpMid'], c['sdpMLineIndex']));
  }

  void _startTimer() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted || !_callActive) return false;
      setState(() => _callDuration++);
      return true;
    });
  }

  Future<void> _endCall({bool remote = false}) async {
    if (!remote) {
      await ref.read(socketServiceProvider).sendCallEvent('call:end', {
        'call_id': widget.callId,
      });
    }
    _localStream?.getTracks().forEach((t) => t.stop());
    await _pc?.close();
    ref.read(socketServiceProvider).removeCallHandler(_onCallEvent);
    if (mounted) context.pop();
  }

  void _toggleMute() {
    final tracks = _localStream?.getAudioTracks() ?? [];
    for (final t in tracks) { t.enabled = _isMuted; }
    setState(() => _isMuted = !_isMuted);
  }

  void _toggleCamera() {
    if (!_isVideo) return;
    _localStream?.getVideoTracks().forEach((t) => Helper.switchCamera(t));
  }

  Future<void> _toggleSpeaker() async {
    final next = !_isSpeaker;
    await Helper.setSpeakerphoneOn(next);
    setState(() => _isSpeaker = next);
  }

  Future<void> _toggleVideoOff() async {
    if (!_isVideo) return;
    final tracks = _localStream?.getVideoTracks() ?? [];
    final next = !_videoOff;
    for (final t in tracks) { t.enabled = !next; }
    setState(() => _videoOff = next);
  }

  @override
  void dispose() {
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    _localStream?.dispose();
    super.dispose();
  }

  String _formatDuration(int s) {
    final m = s ~/ 60;
    final sec = s % 60;
    return '${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.nightBlue,
      body: Stack(
        children: [
          // Vidéo distante (fond)
          if (_isVideo && _callActive)
            RTCVideoView(_remoteRenderer,
                objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover)
          else
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircleAvatar(
                    radius: 60,
                    backgroundColor: AppTheme.primaryBlue.withOpacity(0.3),
                    child: Text(
                      _peerName.substring(0, 1).toUpperCase(),
                      style: const TextStyle(fontSize: 48, color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(_peerName, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Text(
                    _callActive ? _formatDuration(_callDuration) : _status,
                    style: TextStyle(
                      color: _callActive ? AppTheme.successGreen : Colors.white54,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),

          // Vidéo locale (miniature coin)
          if (_isVideo && _callActive)
            Positioned(
              top: MediaQuery.of(context).padding.top + 16,
              right: 16,
              child: SizedBox(
                width: 100, height: 140,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: RTCVideoView(_localRenderer, mirror: true,
                      objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover),
                ),
              ),
            ),

          // Contrôles
          Positioned(
            bottom: MediaQuery.of(context).padding.bottom + 40,
            left: 0, right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _ControlButton(
                  icon:  _isMuted ? Icons.mic_off : Icons.mic,
                  label: _isMuted ? 'Muet' : 'Micro',
                  color: _isMuted ? AppTheme.alertRed.withOpacity(0.8) : Colors.white24,
                  onTap: _toggleMute,
                ),
                if (_isVideo)
                  _ControlButton(
                    icon:  Icons.flip_camera_ios,
                    label: 'Caméra',
                    color: Colors.white24,
                    onTap: _toggleCamera,
                  ),
                _ControlButton(
                  icon:  Icons.call_end,
                  label: 'Raccrocher',
                  color: AppTheme.alertRed,
                  size:  72,
                  onTap: () => _endCall(),
                ),
                _ControlButton(
                  icon:  _isSpeaker ? Icons.volume_up : Icons.volume_off,
                  label: 'Haut-parleur',
                  color: _isSpeaker ? Colors.white24 : AppTheme.alertRed.withOpacity(0.8),
                  onTap: _toggleSpeaker,
                ),
                if (_isVideo)
                  _ControlButton(
                    icon:  _videoOff ? Icons.videocam_off : Icons.videocam,
                    label: _videoOff ? 'Vidéo off' : 'Vidéo',
                    color: _videoOff ? AppTheme.alertRed.withOpacity(0.8) : Colors.white24,
                    onTap: _toggleVideoOff,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  const _ControlButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.size = 56,
  });

  final IconData icon;
  final String   label;
  final Color    color;
  final VoidCallback onTap;
  final double   size;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: size, height: size,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            child: Icon(icon, color: Colors.white, size: size * 0.45),
          ),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        ],
      ),
    );
  }
}
