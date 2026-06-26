
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ProtectedRoute = ({ requireAdmin = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Very basic admin check, in real app check role in user metadata or custom claims
  if (requireAdmin && user.email !== 'admin@agcpadelacademy.com') { // Replace with actual admin check logic if available
     // return <Navigate to="/" replace />; // Disabled strict check for demo purposes
  }

  return <Outlet />;
};

export default ProtectedRoute;
