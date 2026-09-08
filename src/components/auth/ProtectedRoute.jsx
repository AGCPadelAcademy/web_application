import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

function loginPathWithReturnTo(pathname, search) {
  const returnTo = `${pathname}${search || ''}`;
  const safe = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  if (safe === '/' || safe.startsWith('/login')) return '/login';
  return `/login?return_to=${encodeURIComponent(safe)}`;
}

/**
 * Client-side route guard. Authorization for actual data writes is enforced
 * by Supabase RLS (see `supabase/migrations/0001_add_roles_and_admin_rls.sql`).
 * This guard only prevents rendering the page for users who clearly should
 * not see it; it is not a security boundary on its own.
 *
 * `allowedRoles` lets a route accept more than one role (e.g. admin OR
 * accounting). When omitted, any authenticated user is allowed.
 */
const ProtectedRoute = ({ children, requireAdmin = false, allowedRoles = [] }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to={loginPathWithReturnTo(location.pathname, location.search)} replace />;
  }

  const isAdmin = role === 'admin';

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role) && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
