import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="centered-page"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="centered-page"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isSuperAdmin) return <Navigate to="/profile" replace />;
  return children;
}

export function OrgAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="centered-page"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  // org_admin : a un orgId, pas super-admin, rôle org_admin
  if (!user.orgId || user.isSuperAdmin) return <Navigate to="/profile" replace />;
  if (user.role && user.role !== 'org_admin') return <Navigate to="/app" replace />;
  return children;
}

/**
 * MemberRoute — utilisateur connecté avec orgId, ni super-admin ni org-admin
 * Redirige vers /org/join si pas d'orgId
 */
export function MemberRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="centered-page"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isSuperAdmin) return <Navigate to="/admin" replace />;
  if (!user.orgId) return <Navigate to="/org/join" replace />;
  // org_admin redirigé vers /app (il a aussi accès aux communications)
  // Ne pas rediriger vers /org/dashboard depuis ici — laisser passer
  return children;
}

/**
 * OrgMemberOrAdminRoute — accepte tout utilisateur avec orgId
 * (membres ET org_admins). Utilisé pour les routes /app/*.
 */
export function OrgMemberOrAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="centered-page"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isSuperAdmin) return <Navigate to="/admin" replace />;
  if (!user.orgId) return <Navigate to="/org/join" replace />;
  return children;
}
