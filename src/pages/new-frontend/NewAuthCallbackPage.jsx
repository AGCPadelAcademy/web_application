import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import NewMasthead from './NewMasthead';

const NewAuthCallbackPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loading) return undefined;
    if (user) {
      const timer = setTimeout(() => navigate('/new', { replace: true }), 1500);
      return () => clearTimeout(timer);
    }
    const hasCode = window.location.hash.includes('code=') || window.location.search.includes('code=');
    if (!hasCode) setError('This confirmation link is invalid or has already been used.');
    return undefined;
  }, [user, loading, navigate]);

  return (
    <>
      <Helmet>
        <title>AGC Padel Academy — Confirming</title>
      </Helmet>
      <NewMasthead title={error ? 'Confirmation link issue' : 'Email confirmed'} lead={error || 'Redirecting you to the home page…'} />
      <section className="nf-page">
        {error && (
          <button type="button" className="nf-pill border-0" onClick={() => navigate('/new/login', { replace: true })}>Go to login</button>
        )}
      </section>
    </>
  );
};

export default NewAuthCallbackPage;
