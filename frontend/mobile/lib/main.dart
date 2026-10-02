import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/services/notification_service.dart';
import 'core/services/socket_service.dart';
import 'core/network/network_detector.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase pour les notifications push (FCM/APNs) et l'auth sociale
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  runApp(
    const ProviderScope(child: PalabreApp()),
  );
}

class PalabreApp extends ConsumerStatefulWidget {
  const PalabreApp({super.key});

  @override
  ConsumerState<PalabreApp> createState() => _PalabreAppState();
}

class _PalabreAppState extends ConsumerState<PalabreApp>
    with WidgetsBindingObserver {

  DateTime? _backgroundSince;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initServices();
  }

  Future<void> _initServices() async {
    // Notifications locales + FCM
    await ref.read(notificationServiceProvider).initialize();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final socket   = ref.read(socketServiceProvider);
    final detector = ref.read(networkDetectorProvider);

    switch (state) {
      case AppLifecycleState.resumed:
        socket.reconnectIfNeeded();
        // Reprendre les probes réseau (suspendus en arrière-plan)
        final awayMs = _backgroundSince != null
            ? DateTime.now().difference(_backgroundSince!).inMilliseconds
            : 0;
        if (awayMs >= 30000) {
          detector.resume(); // re-probe immédiate si ≥30s en arrière-plan
        } else {
          detector.resume();
        }
        _backgroundSince = null;

      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
        _backgroundSince = DateTime.now();
        // Suspendre les probes périodiques pour économiser la batterie
        detector.suspend();
        // Ne PAS déconnecter le socket - "la ligne ne raccroche jamais"

      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        break;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Palabre',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(
              MediaQuery.of(context).textScaleFactor.clamp(0.85, 1.3),
            ),
          ),
          child: child!,
        );
      },
    );
  }
}
