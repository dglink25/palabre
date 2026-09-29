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
  // Les org admins ont un orgId défini et ne sont pas super-admin
  if (!user.orgId || user.isSuperAdmin) return <Navigate to="/profile" replace />;
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
  // org-admin a son propre espace
  if (user.orgId && user.role === 'org_admin') return <Navigate to="/org/dashboard" replace />;
  if (!user.orgId) return <Navigate to="/org/join" replace />;
  return children;
}
