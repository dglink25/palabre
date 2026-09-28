import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/services/notification_service.dart';
import 'core/services/socket_service.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase pour les notifications push (FCM/APNs)
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  runApp(
    // ProviderScope = racine de Riverpod
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
    // Gérer la présence selon l'état de l'app
    final socket = ref.read(socketServiceProvider);
    switch (state) {
      case AppLifecycleState.resumed:
        socket.reconnectIfNeeded();
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        // On ne déconnecte PAS — la "ligne ne raccroche jamais"
        // Le socket reste actif en background tant que l'OS le permet
        break;
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
          // Respecter la taille de police système (accessibilité)
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
