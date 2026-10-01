import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { __setNotifyFn } from './components/ui';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import { ProtectedRoute, SuperAdminRoute, OrgAdminRoute, OrgMemberOrAdminRoute } from './components/RouteGuards';
import StepUpConfirmModal from './components/StepUpConfirmModal';
import CookieBanner from './components/CookieBanner';
import ScrollButton from './components/ScrollButton';

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
import UserDashboardPage from './pages/app/UserDashboardPage';
import { ConversationsListPage, ChatPage } from './pages/app/ConversationsPage';
import NewConversationPage from './pages/app/NewConversationPage';
import CallsPage from './pages/app/CallsPage';
import ContactsPage from './pages/app/ContactsPage';
import VideoConferencePage from './pages/app/VideoConferencePage';
import VideoRoomPage from './pages/app/VideoRoomPage';
import PublicVideoConferencePage from './pages/videoconference/PublicVideoConferencePage';
import JoinByInvitationPage from './pages/videoconference/JoinByInvitationPage';
// ── Pont : branche la fonction notify sur le composant Alert legacy ───────────
function NotifyBridge() {
  const { notify } = useNotification();
  useEffect(() => {
    __setNotifyFn((type, msg) => {
      if (type === 'error')   return notify.error(msg);
      if (type === 'success') return notify.success(msg);
      if (type === 'warning') return notify.warning(msg);
      return notify.info(msg);
    });
  }, [notify]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <NotifyBridge />
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
              <Route path="/admin"                element={<DashboardPage />} />
              <Route path="/admin/onboarding"     element={<RequestsListPage />} />
              <Route path="/admin/onboarding/:id" element={<RequestDetailPage />} />
              <Route path="/admin/installation"   element={<InstallationGuidePage />} />
            </Route>

            {/* Administrateur d'organisation */}
            <Route element={<OrgAdminRoute><Layout /></OrgAdminRoute>}>
              <Route path="/org/dashboard" element={<OrgDashboardPage />} />
              <Route path="/org/vpn"       element={<OrgVpnPage />} />
              <Route path="/org/invite"    element={<OrgInvitePage />} />
              <Route path="/org/link"      element={<OrgLinkPage />} />
              <Route path="/org/guide"     element={<OrgInstallGuidePage />} />
            </Route>

            {/* Rejoindre une organisation */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/org/join" element={<OrgJoinPage />} />
            </Route>

            {/* Espace communication (membres + org_admins) */}
            <Route element={<OrgMemberOrAdminRoute><Layout /></OrgMemberOrAdminRoute>}>
              <Route path="/app"                   element={<UserDashboardPage />} />
              <Route path="/app/conversations"     element={<ConversationsListPage />} />
              <Route path="/app/conversations/new" element={<NewConversationPage />} />
              <Route path="/app/conversations/:id" element={<ChatPage />} />
              <Route path="/app/calls"             element={<CallsPage />} />
              <Route path="/app/call"              element={<CallsPage />} />
              <Route path="/app/contacts"          element={<ContactsPage />} />
              <Route path="/app/videoconference"          element={<VideoConferencePage />} />
              <Route path="/app/videoconference/:roomId"  element={<VideoRoomPage />} />
            </Route>

            {/* Vidéoconférence publique (tout utilisateur authentifié) */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/videoconference"              element={<PublicVideoConferencePage />} />
              <Route path="/videoconference/:roomId"      element={<VideoRoomPage />} />
              <Route path="/join/v/:token"                element={<JoinByInvitationPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <CookieBanner />
          <ScrollButton />
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}