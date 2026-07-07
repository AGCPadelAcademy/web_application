import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';

/**
 * Handles the redirect at the end of the email-confirmation and password-reset
 * flows. Supabase v2 (PKCE) puts a `code` in the URL; the supabase-js client
 * is configured with `detectSessionInUrl: true` so it auto-exchanges the code
 * for a session. We then react to the auth state change here and route the
 * user onward.
 */
const AuthCallbackPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loading) return;

    if (user) {
      // Session restored from the URL code — confirmation succeeded.
      const timer = setTimeout(() => navigate('/', { replace: true }), 1500);
      return () => clearTimeout(timer);
    }

    // If we land here with no session and no code in the URL, the link may
    // have been already used or expired. Let the user go to login manually.
    const hasCode =
      typeof window !== 'undefined' &&
      (window.location.hash.includes('code=') || window.location.search.includes('code='));

    if (!hasCode) {
      setError('This confirmation link is invalid or has already been used.');
    }
  }, [user, loading, navigate]);

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[80vh] px-4">
      <Helmet>
        <title>Confirming - AGC Padel Academy</title>
      </Helmet>
      <div className="max-w-md w-full text-center text-white">
        {error ? (
          <>
            <AlertCircle className="w-12 h-12 mx-auto text-yellow-400 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Confirmation link issue</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button onClick={() => navigate('/login', { replace: true })} className="bg-green-500 hover:bg-green-600 text-black font-bold">
              Go to login
            </Button>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Email confirmed!</h1>
            <p className="text-gray-400 mb-6">Redirecting you to the home page…</p>
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-green-500" />
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
