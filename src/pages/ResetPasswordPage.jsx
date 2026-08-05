import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';

/**
 * Landing page for the password-reset email link. Supabase auto-exchanges the
 * code in the URL (detectSessionInUrl: true), which gives us a short-lived
 * session that is allowed to call `supabase.auth.updateUser({ password })`.
 */
const ResetPasswordPage = () => {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  // If the user ends up here without a session (link expired/used), send
  // them back to the forgot-password flow.
  useEffect(() => {
    if (!loading && !user && !done) {
      setError('This reset link is invalid or has expired. Please request a new one.');
    }
  }, [loading, user, done]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message || 'Could not update password.');
      return;
    }

    setDone(true);
    setTimeout(() => navigate('/login', { replace: true }), 2500);
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[80vh] px-4">
      <Helmet>
        <title>Reset password - AGC Padel Academy</title>
      </Helmet>
      <Card className="w-full max-w-md bg-gray-900 border-gray-800 text-white">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-green-400">Reset password</CardTitle>
          <CardDescription className="text-gray-400">
            {done ? 'Your password has been updated.' : 'Choose a new password for your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-4" />
              <p className="text-gray-300 mb-2">Password updated successfully.</p>
              <p className="text-gray-400 text-sm">Redirecting you to login…</p>
              <Loader2 className="w-5 h-5 mx-auto animate-spin text-green-500 mt-4" />
            </div>
          ) : error && !user ? (
            <div className="text-center py-6">
              <AlertCircle className="w-12 h-12 mx-auto text-yellow-400 mb-4" />
              <p className="text-gray-300 mb-6">{error}</p>
              <Button
                onClick={() => navigate('/login', { replace: true })}
                className="bg-green-500 hover:bg-green-600 text-black font-bold"
              >
                Back to login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength="6"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength="6"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-600 text-black font-bold"
                disabled={submitting || loading}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
