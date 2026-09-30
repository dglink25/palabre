import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import { ProtectedRoute, SuperAdminRoute, OrgAdminRoute, MemberRoute, OrgMemberOrAdminRoute } from './components/RouteGuards';
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
import DashboardPage from './pages/admin/DashboardPage';
import InstallationGuidePage from './pages/admin/InstallationGuidePage';
import OrgDashboardPage from './pages/org/OrgDashboardPage';
import OrgVpnPage from './pages/org/OrgVpnPage';
import OrgInvitePage from './pages/org/OrgInvitePage';
import OrgLinkPage from './pages/org/OrgLinkPage';
import OrgJoinPage from './pages/org/OrgJoinPage';
import OrgInstallGuidePage from './pages/org/OrgInstallGuidePage';

// Espace membre (utilisateur standard avec org)
import UserDashboardPage from './pages/app/UserDashboardPage';
import { ConversationsListPage, ChatPage } from './pages/app/ConversationsPage';
import NewConversationPage from './pages/app/NewConversationPage';
import CallsPage from './pages/app/CallsPage';
import ContactsPage from './pages/app/ContactsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StepUpConfirmModal />
        <Routes>
          {/* Pages publiques */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Route>

          {/* Formulaires standalone */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recovery" element={<RecoveryPage />} />
          <Route path="/two-factor" element={<TwoFactorChallengePage />} />
          <Route path="/onboarding/new" element={<OnboardingWizard />} />
          <Route path="/onboarding/status" element={<OnboardingStatusPage />} />
          <Route path="/activate" element={<AdminActivationPage />} />

          {/* Espace connecté commun */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
          </Route>

          {/* Super-administrateur */}
          <Route element={<SuperAdminRoute><Layout /></SuperAdminRoute>}>
            <Route path="/admin"                    element={<DashboardPage />} />
            <Route path="/admin/onboarding"         element={<RequestsListPage />} />
            <Route path="/admin/onboarding/:id"     element={<RequestDetailPage />} />
            <Route path="/admin/installation"       element={<InstallationGuidePage />} />
          </Route>

          {/* Administrateur d'organisation — gestion org uniquement */}
          <Route element={<OrgAdminRoute><Layout /></OrgAdminRoute>}>
            <Route path="/org/dashboard" element={<OrgDashboardPage />} />
            <Route path="/org/vpn"       element={<OrgVpnPage />} />
            <Route path="/org/invite"    element={<OrgInvitePage />} />
            <Route path="/org/link"      element={<OrgLinkPage />} />
            <Route path="/org/guide"     element={<OrgInstallGuidePage />} />
          </Route>

          {/* Rejoindre une organisation — tout utilisateur connecté */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/org/join" element={<OrgJoinPage />} />
          </Route>

          {/* ── Espace communication (membres ET org_admins) ── */}
          <Route element={<OrgMemberOrAdminRoute><Layout /></OrgMemberOrAdminRoute>}>
            <Route path="/app"                            element={<UserDashboardPage />} />
            <Route path="/app/conversations"              element={<ConversationsListPage />} />
            <Route path="/app/conversations/new"          element={<NewConversationPage />} />
            <Route path="/app/conversations/:id"         element={<ChatPage />} />
            <Route path="/app/calls"                      element={<CallsPage />} />
            <Route path="/app/contacts"                   element={<ContactsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CookieBanner />
      </AuthProvider>
    </BrowserRouter>
  );
}
