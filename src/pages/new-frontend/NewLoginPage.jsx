import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import PasswordField from '@/components/auth/PasswordField';
import NewMasthead from './NewMasthead';
import { newAuthCallbackUrl, newResetUrl, safeNewPath } from './newPaths';

const phoneDigitCount = (value) => value.replace(/\D/g, '').length;

const NewLoginPage = () => {
  const [searchParams] = useSearchParams();
  const returnTo = safeNewPath(searchParams.get('return_to'), '/new');
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, resendConfirmation } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('login');
  const [mode, setMode] = useState('auth');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resendEmail, setResendEmail] = useState('');

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(loginEmail, loginPassword);
      if (!error) {
        toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
        navigate(returnTo);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (!acceptTerms) {
      toast({ title: 'Terms not accepted', description: 'You must accept the terms and privacy policy.', variant: 'destructive' });
      return;
    }
    const normalizedPhone = registerPhone.trim();
    if (phoneDigitCount(normalizedPhone) < 9) {
      toast({ title: 'Invalid phone number', description: 'Enter at least 9 digits (country code optional).', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error, needsConfirmation, duplicateAccount } = await signUp(
        registerEmail,
        registerPassword,
        registerName,
        normalizedPhone,
        newAuthCallbackUrl(),
      );
      if (error) throw error;
      if (duplicateAccount || needsConfirmation) {
        setLoginEmail(registerEmail);
        setTab('login');
        return;
      }
      navigate(returnTo);
    } catch (err) {
      toast({ title: 'Registration failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await resetPassword(resetEmail, newResetUrl());
      if (!error) setMode('auth');
    } finally {
      setLoading(false);
    }
  };

  const sendResend = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await resendConfirmation(resendEmail, newAuthCallbackUrl());
      if (!error) setMode('auth');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>AGC Padel Academy — Login</title>
      </Helmet>
      <NewMasthead title="Login" lead="Sign in or register to continue a booking or a camp registration." />
      <section className="nf-page">
        <div className="nf-card nf-form" style={{ maxWidth: 480, margin: '0 auto' }}>
          {mode === 'reset' && (
            <form onSubmit={sendReset}>
              <h3>Forgot password</h3>
              <p>Enter your account email and we will send you a link to reset your password.</p>
              <label htmlFor="nf-reset-email">Email</label>
              <input id="nf-reset-email" type="email" required value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} />
              <button type="submit" className="nf-pill border-0" disabled={loading}>Send reset link</button>
              <button type="button" className="nf-text-btn" onClick={() => setMode('auth')}>Back to sign in</button>
            </form>
          )}
          {mode === 'resend' && (
            <form onSubmit={sendResend}>
              <h3>Resend confirmation</h3>
              <p>Only for new accounts that have not confirmed their email yet.</p>
              <label htmlFor="nf-resend-email">Email</label>
              <input id="nf-resend-email" type="email" required value={resendEmail} onChange={(event) => setResendEmail(event.target.value)} />
              <button type="submit" className="nf-pill border-0" disabled={loading}>Resend email</button>
              <button type="button" className="nf-text-btn" onClick={() => { setResetEmail(resendEmail); setMode('reset'); }}>Forgot password</button>
              <button type="button" className="nf-text-btn" onClick={() => setMode('auth')}>Back to sign in</button>
            </form>
          )}
          {mode === 'auth' && (
            <>
              <div className="nf-filters" role="tablist">
                <button type="button" className={tab === 'login' ? 'is-on' : undefined} onClick={() => setTab('login')}>Sign in</button>
                <button type="button" className={tab === 'register' ? 'is-on' : undefined} onClick={() => setTab('register')}>Sign up</button>
              </div>
              {tab === 'login' ? (
                <form onSubmit={handleLogin}>
                  <label htmlFor="nf-login-email">Email</label>
                  <input id="nf-login-email" type="email" required value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
                  <PasswordField id="nf-login-password" label="Password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required />
                  <button type="submit" className="nf-pill border-0" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
                  <button type="button" className="nf-text-btn" onClick={() => { setResetEmail(loginEmail); setMode('reset'); }}>Forgot password?</button>
                  <button type="button" className="nf-text-btn" onClick={() => { setResendEmail(loginEmail); setMode('resend'); }}>Resend sign-up confirmation (new accounts only)</button>
                </form>
              ) : (
                <form onSubmit={handleRegister}>
                  <label htmlFor="nf-reg-name">Full name</label>
                  <input id="nf-reg-name" required value={registerName} onChange={(event) => setRegisterName(event.target.value)} />
                  <label htmlFor="nf-reg-email">Email</label>
                  <input id="nf-reg-email" type="email" required value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} />
                  <label htmlFor="nf-reg-phone">Phone</label>
                  <input id="nf-reg-phone" type="tel" required value={registerPhone} onChange={(event) => setRegisterPhone(event.target.value)} />
                  <PasswordField id="nf-reg-password" label="Password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} required />
                  <label className="nf-check">
                    <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
                    <span>I accept the <Link to="/new/terms">terms and privacy policy</Link>.</span>
                  </label>
                  <button type="submit" className="nf-pill border-0" disabled={loading}>{loading ? 'Creating account…' : 'Sign up'}</button>
                </form>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
};

export default NewLoginPage;
