import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

import HomePage from '@/pages/HomePage';
import LessonsPage from '@/pages/LessonsPage';
import TripsPage from '@/pages/TripsPage';
import TournamentsPage from '@/pages/TournamentsPage';
import ContactPage from '@/pages/ContactPage';
import LoginPage from '@/pages/LoginPage';
import TermsPage from '@/pages/TermsPage';
import AdminDashboard from '@/pages/AdminDashboardPage';
import CoachRosterPage from '@/pages/CoachRosterPage';
import ProfileManagementPage from '@/pages/ProfileManagementPage';
import PaymentsPage from '@/pages/PaymentsPage';
import AuthCallbackPage from '@/pages/AuthCallbackPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';

const AppLayout = () => (
  <div className="min-h-screen bg-black text-white flex flex-col w-full">
    <Header />
    <main className="flex-grow flex flex-col w-full">
      <Outlet />
    </main>
    <Footer />
    <Toaster />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<AppLayout />}>

            <Route index element={<HomePage />} />
            <Route path="lessons" element={<LessonsPage />} />
            <Route path="trips" element={<TripsPage />} />
            <Route path="tournaments" element={<TournamentsPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />

            <Route path="profile" element={
              <ProtectedRoute>
                <ProfileManagementPage />
              </ProtectedRoute>
            } />

            <Route
              path="payments"
              element={
                <ProtectedRoute>
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />

            <Route path="admin" element={<Navigate to="/admin/payment-verification" replace />} />
            <Route
              path="admin/payment-verification"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="coach/roster"
              element={
                <ProtectedRoute allowedRoles={['coach']}>
                  <CoachRosterPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />

          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;