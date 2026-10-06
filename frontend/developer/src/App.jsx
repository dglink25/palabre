import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PortalLayout from './components/PortalLayout.jsx';

// Pages publiques
const LandingPage       = React.lazy(() => import('./pages/LandingPage.jsx'));
const LoginPage         = React.lazy(() => import('./pages/LoginPage.jsx'));
const SignupPage        = React.lazy(() => import('./pages/SignupPage.jsx'));

// Pages protégées
const DashboardPage     = React.lazy(() => import('./pages/DashboardPage.jsx'));
const ProjectPage       = React.lazy(() => import('./pages/ProjectPage.jsx'));
const WebhooksPage      = React.lazy(() => import('./pages/WebhooksPage.jsx'));
const DocumentationPage = React.lazy(() => import('./pages/DocumentationPage.jsx'));

// Spinner minimal pendant le lazy-load
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', backgroundColor: '#F8F9FA',
    }} aria-label="Chargement…">
      <span role="status" style={{
        display: 'inline-block', width: 28, height: 28,
        border: '3px solid #E0E0E0', borderTopColor: '#1A73E8',
        borderRadius: '50%', animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Wrapper pour les pages publiques (pas de sidebar)
function PublicPage({ children }) {
  return (
    <React.Suspense fallback={<PageLoader />}>
      {children}
    </React.Suspense>
  );
}

// Wrapper pour les pages protégées (avec sidebar PortalLayout)
function ProtectedLayout({ children }) {
  return (
    <React.Suspense fallback={<PageLoader />}>
      <PortalLayout>{children}</PortalLayout>
    </React.Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ── Pages publiques - accessibles sans authentification ── */}
      <Route path="/" element={
        <PublicPage><LandingPage /></PublicPage>
      } />
      <Route path="/login" element={
        <PublicPage><LoginPage /></PublicPage>
      } />
      <Route path="/signup" element={
        <PublicPage><SignupPage /></PublicPage>
      } />

      {/* ── Pages protégées - avec sidebar Palabre ── */}
      <Route path="/dashboard" element={
        <ProtectedLayout><DashboardPage /></ProtectedLayout>
      } />
      <Route path="/projects/:id" element={
        <ProtectedLayout><ProjectPage /></ProtectedLayout>
      } />
      <Route path="/projects/:id/webhooks" element={
        <ProtectedLayout><WebhooksPage /></ProtectedLayout>
      } />
      <Route path="/docs" element={
        <ProtectedLayout><DocumentationPage /></ProtectedLayout>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
