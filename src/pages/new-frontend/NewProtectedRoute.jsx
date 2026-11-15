import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { safeNewPath } from './newPaths';

const NewProtectedRoute = ({ children, requireAdmin = false, allowedRoles = [] }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="nf-lead" style={{ padding: '48px 8%' }}>Loading…</p>;
  }

  if (!user) {
    const returnTo = safeNewPath(`${location.pathname}${location.search || ''}`);
    return <Navigate to={`/new/login?return_to=${encodeURIComponent(returnTo)}`} replace />;
  }

  const isAdmin = role === 'admin';
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/new" replace />;
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(role) && !isAdmin) {
    return <Navigate to="/new" replace />;
  }

  return children;
};

export default NewProtectedRoute;
