import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
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
import AdminDashboard from '@/pages/AdminDashboard';
import ProfileManagementPage from '@/pages/ProfileManagementPage';
import PaymentsPage from '@/pages/PaymentsPage';

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

            <Route
              path="admin/payment-verification"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;