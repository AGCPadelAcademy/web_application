import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import PasswordField from '@/components/auth/PasswordField';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import NewMasthead from './NewMasthead';

const NewResetPasswordPage = () => {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading && !user && !done) {
      setError('This reset link is invalid or has expired. Please request a new one.');
    }
  }, [loading, user, done]);

  const handleSubmit = async (event) => {
    event.preventDefault();
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
    setTimeout(() => navigate('/new/login', { replace: true }), 2500);
  };

  return (
    <>
      <Helmet>
        <title>AGC Padel Academy — Reset password</title>
      </Helmet>
      <NewMasthead title="Reset password" lead={done ? 'Your password has been updated.' : 'Choose a new password for your account.'} />
      <section className="nf-page">
        <div className="nf-card nf-form" style={{ maxWidth: 480, margin: '0 auto' }}>
          {done ? <p>Password updated successfully. Redirecting you to login…</p> : null}
          {!done && error && !user ? (
            <>
              <p className="nf-error">{error}</p>
              <button type="button" className="nf-pill border-0" onClick={() => navigate('/new/login', { replace: true })}>Back to login</button>
            </>
          ) : null}
          {!done && (user || loading) && (
            <form onSubmit={handleSubmit}>
              <PasswordField id="nf-new-password" label="New password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength="6" />
              <PasswordField id="nf-confirm-password" label="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength="6" />
              {error && <p className="nf-error">{error}</p>}
              <button type="submit" className="nf-pill border-0" disabled={submitting || loading}>Update password</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
};

export default NewResetPasswordPage;
