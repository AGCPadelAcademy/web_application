import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ADMIN_EMAIL_FALLBACK = 'josep.barbera.reverte.1999@gmail.com';

/**
 * Client-side route guard. Authorization for actual data writes is enforced
 * by Supabase RLS (see `supabase/migrations/0001_add_roles_and_admin_rls.sql`).
 * This guard only prevents rendering the page for users who clearly should
 * not see it; it is not a security boundary on its own.
 *
 * `allowedRoles` lets a route accept more than one role (e.g. admin OR
 * accounting). When omitted, any authenticated user is allowed.
 *
 * For backward compatibility, until the profiles.role migration is applied,
 * the legacy admin email is still treated as an admin.
 */
const ProtectedRoute = ({ children, requireAdmin = false, allowedRoles = [] }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = role === 'admin' || user.email === ADMIN_EMAIL_FALLBACK;

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role) && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
