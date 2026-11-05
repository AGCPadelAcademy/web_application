import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FrontendSwitcher from '@/components/layout/FrontendSwitcher';

import HomePage from '@/pages/HomePage';
import NewLayout from '@/pages/new-frontend/NewLayout';
import NewHomePage from '@/pages/new-frontend/NewHomePage';
import NewLessonsPage from '@/pages/new-frontend/NewLessonsPage';
import NewCampsPage from '@/pages/new-frontend/NewCampsPage';
import NewTripsPage from '@/pages/new-frontend/NewTripsPage';
import NewContactPage from '@/pages/new-frontend/NewContactPage';
import NewTermsPage from '@/pages/new-frontend/NewTermsPage';
import NewLoginPage from '@/pages/new-frontend/NewLoginPage';
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
import CampsPage from '@/pages/CampsPage';
import CampDetailPage from '@/pages/CampDetailPage';
import ChildrenPage from '@/pages/ChildrenPage';
import ChildProfilePage from '@/pages/ChildProfilePage';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { TOURNAMENTS_ENABLED } from '@/lib/featureFlags';

const AppLayout = () => {
  const { pathname } = useLocation();
  const isNewFrontend = pathname === '/new' || pathname.startsWith('/new/');

  return (
    <div className="min-h-screen bg-background text-white flex flex-col w-full">
      <FrontendSwitcher />
      {!isNewFrontend && <Header />}
      <main className="flex-grow flex flex-col w-full">
        <Outlet />
      </main>
      {!isNewFrontend && <Footer />}
      <Toaster />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<AppLayout />}>

            <Route index element={<HomePage />} />
            <Route path="new" element={<NewLayout />}>
              <Route index element={<NewHomePage />} />
              <Route path="lessons" element={<NewLessonsPage />} />
              <Route path="camps" element={<NewCampsPage />} />
              <Route path="trips" element={<NewTripsPage />} />
              <Route path="contact" element={<NewContactPage />} />
              <Route path="terms" element={<NewTermsPage />} />
              <Route path="login" element={<NewLoginPage />} />
            </Route>
            <Route path="lessons" element={<LessonsPage />} />
            <Route path="trips" element={<TripsPage />} />
            <Route path="camps" element={<CampsPage />} />
            <Route path="camps/:slug" element={<CampDetailPage />} />
            <Route
              path="tournaments"
              element={TOURNAMENTS_ENABLED ? <TournamentsPage /> : <Navigate to="/" replace />}
            />
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
              path="children"
              element={
                <ProtectedRoute>
                  <ChildrenPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="children/:childId"
              element={
                <ProtectedRoute>
                  <ChildProfilePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="payments"
              element={
                <ProtectedRoute>
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />

            <Route path="admin" element={<Navigate to="/admin/integrations" replace />} />
            <Route path="admin/payment-verification" element={<Navigate to="/admin/integrations" replace />} />
            <Route
              path="admin/integrations"
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