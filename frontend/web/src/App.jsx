import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import { ProtectedRoute, SuperAdminRoute } from './components/RouteGuards';
import StepUpConfirmModal from './components/StepUpConfirmModal';
import CookieBanner from './components/CookieBanner';

import HomePage from './pages/HomePage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import LoginPage from './pages/auth/LoginPage';
import TwoFactorChallengePage from './pages/auth/TwoFactorChallengePage';
import RecoveryPage from './pages/auth/RecoveryPage';
import OnboardingWizard from './pages/onboarding/OnboardingWizard';
import OnboardingStatusPage from './pages/onboarding/OnboardingStatusPage';
import AdminActivationPage from './pages/onboarding/AdminActivationPage';
import ProfilePage from './pages/profile/ProfilePage';
import SecurityPage from './pages/security/SecurityPage';
import SessionsPage from './pages/sessions/SessionsPage';
import RequestsListPage from './pages/admin/RequestsListPage';
import RequestDetailPage from './pages/admin/RequestDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StepUpConfirmModal />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Route>

          {/* Pages de type formulaire : mise en page AuthLayout gérée par chaque page elle-même. */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          <Route path="/two-factor" element={<TwoFactorChallengePage />} />
          <Route path="/onboarding/new" element={<OnboardingWizard />} />
          <Route path="/onboarding/status" element={<OnboardingStatusPage />} />
          <Route path="/activate" element={<AdminActivationPage />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
          </Route>

          <Route element={<SuperAdminRoute><Layout /></SuperAdminRoute>}>
            <Route path="/admin/onboarding" element={<RequestsListPage />} />
            <Route path="/admin/onboarding/:id" element={<RequestDetailPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CookieBanner />
      </AuthProvider>
    </BrowserRouter>
  );
}
