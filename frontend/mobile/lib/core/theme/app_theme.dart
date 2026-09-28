import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Thème Palabre — reprend exactement la charte du web (theme.css)
class AppTheme {
  AppTheme._();

  // Couleurs de la charte
  static const Color primaryBlue    = Color(0xFF1A73E8);
  static const Color successGreen   = Color(0xFF34A853);
  static const Color warningAmber   = Color(0xFFFBBC05);
  static const Color alertRed       = Color(0xFFEA4335);
  static const Color white          = Color(0xFFFFFFFF);
  static const Color offWhite       = Color(0xFFF8F9FA);
  static const Color border         = Color(0xFFE0E0E0);
  static const Color textSecondary  = Color(0xFF5F6368);
  static const Color textPrimary    = Color(0xFF202124);
  static const Color nightBlue      = Color(0xFF0D1B2A);

  // ── Thème clair ───────────────────────────────────────────────────────────
  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryBlue,
        brightness: Brightness.light,
        primary: primaryBlue,
        error: alertRed,
        surface: white,
        background: offWhite,
      ),
      fontFamily: 'Inter',
      scaffoldBackgroundColor: offWhite,
      appBarTheme: const AppBarTheme(
        backgroundColor: white,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: textPrimary,
        ),
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
        ),
      ),
      cardTheme: CardTheme(
        color: white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(0),
          side: const BorderSide(color: border),
        ),
        margin: EdgeInsets.zero,
      ),
      dividerTheme: const DividerThemeData(
        color: border,
        thickness: 1,
        space: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(0),
          borderSide: const BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(0),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(0),
          borderSide: const BorderSide(color: primaryBlue, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(0),
          borderSide: const BorderSide(color: alertRed, width: 2),
        ),
        labelStyle: const TextStyle(color: textSecondary, fontFamily: 'Inter'),
        hintStyle: const TextStyle(color: textSecondary, fontFamily: 'Inter'),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryBlue,
          foregroundColor: white,
          elevation: 0,
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(0)),
          textStyle: const TextStyle(
            fontFamily: 'Inter',
            fontWeight: FontWeight.w700,
            fontSize: 15,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryBlue,
          textStyle: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w600),
        ),
      ),
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
      textTheme: const TextTheme(
        headlineLarge:  TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: textPrimary),
        headlineMedium: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: textPrimary),
        titleLarge:     TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: textPrimary),
        titleMedium:    TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary),
        bodyLarge:      TextStyle(fontSize: 16, fontWeight: FontWeight.w400, color: textPrimary),
        bodyMedium:     TextStyle(fontSize: 14, fontWeight: FontWeight.w400, color: textPrimary),
        bodySmall:      TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: textSecondary),
        labelLarge:     TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textPrimary),
      ),
    );
  }

  // ── Thème sombre ──────────────────────────────────────────────────────────
  static ThemeData get dark {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryBlue,
        brightness: Brightness.dark,
        primary: primaryBlue,
        error: alertRed,
        surface: const Color(0xFF1E2533),
        background: nightBlue,
      ),
      fontFamily: 'Inter',
      scaffoldBackgroundColor: nightBlue,
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF1E2533),
        foregroundColor: white,
        elevation: 0,
        titleTextStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: white,
        ),
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
        ),
      ),
    );
  }
}
