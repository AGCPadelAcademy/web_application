
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Helmet } from 'react-helmet';
import OAuthButtons from '@/components/auth/OAuthButtons';

// Providers rendered on the login screen. Each must also be enabled in the
// Supabase dashboard → Authentication → Providers, otherwise Supabase will
// return an error when the button is clicked.
const OAUTH_PROVIDERS = ['google'];

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return_to') || '/';
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, resendConfirmation } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  // Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Forgot-password / resend-confirmation UI state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resendEmail, setResendEmail] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
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

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!acceptTerms) {
      toast({
        title: 'Terms not accepted',
        description: 'You must accept the terms and privacy policy.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(registerEmail, registerPassword, registerName, registerPhone);
      if (error) throw error;

      // Profile row is created inside signUp (single source of truth), so no
      // duplicate upsert here.
      if (returnTo && returnTo !== '/') {
        navigate(returnTo);
      } else {
        navigate('/');
      }
    } catch (err) {
      toast({ title: 'Registration Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await resetPassword(resetEmail);
      if (!error) setShowForgotPassword(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await resendConfirmation(resendEmail);
      if (!error) setShowResendConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  const renderForgotPassword = () => (
    <form onSubmit={handleForgotPassword} className="space-y-4 pt-4">
      <p className="text-sm text-gray-400">
        Enter your account email and we&apos;ll send you a link to reset your password.
      </p>
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder="you@email.com"
          value={resetEmail}
          onChange={(e) => setResetEmail(e.target.value)}
          required
          className="bg-gray-800 border-gray-700 text-white"
        />
      </div>
      <Button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-black font-bold" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send reset link'}
      </Button>
      <Button
        type="button"
        variant="link"
        className="w-full text-gray-400"
        onClick={() => setShowForgotPassword(false)}
      >
        Back to sign in
      </Button>
    </form>
  );

  const renderResendConfirmation = () => (
    <form onSubmit={handleResendConfirmation} className="space-y-4 pt-4">
      <p className="text-sm text-gray-400">
        Did not receive the confirmation email? Enter your address to resend it.
      </p>
      <div className="space-y-2">
        <Label htmlFor="resend-email">Email</Label>
        <Input
          id="resend-email"
          type="email"
          placeholder="you@email.com"
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
          required
          className="bg-gray-800 border-gray-700 text-white"
        />
      </div>
      <Button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-black font-bold" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Resend email'}
      </Button>
      <Button
        type="button"
        variant="link"
        className="w-full text-gray-400"
        onClick={() => setShowResendConfirmation(false)}
      >
        Back to sign in
      </Button>
    </form>
  );

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[80vh] px-4">
      <Helmet>
        <title>Login - AGC Padel Academy</title>
      </Helmet>
      <Card className="w-full max-w-md bg-gray-900 border-gray-800 text-white">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-green-400">Access</CardTitle>
          <CardDescription className="text-gray-400">Sign in or register to continue your booking.</CardDescription>
        </CardHeader>
        <CardContent>
          {showForgotPassword ? (
            renderForgotPassword()
          ) : showResendConfirmation ? (
            renderResendConfirmation()
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-black font-bold" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign In'}
                  </Button>
                  <div className="flex flex-col gap-1 pt-1 text-sm">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-green-400 text-left"
                      onClick={() => {
                        setResetEmail(loginEmail);
                        setShowForgotPassword(true);
                      }}
                    >
                      Forgot password?
                    </button>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-green-400 text-left"
                      onClick={() => {
                        setResendEmail(loginEmail);
                        setShowResendConfirmation(true);
                      }}
                    >
                      Resend confirmation email
                    </button>
                  </div>
                </form>
                {OAUTH_PROVIDERS.length > 0 && (
                  <div className="pt-4">
                    <div className="relative my-3">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-700" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-gray-900 px-2 text-gray-500">or</span>
                      </div>
                    </div>
                    <OAuthButtons enabledProviders={OAUTH_PROVIDERS} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Full Name</Label>
                    <Input id="reg-name" placeholder="John Doe" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required className="bg-gray-800 border-gray-700 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" type="email" placeholder="you@email.com" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required className="bg-gray-800 border-gray-700 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">Phone</Label>
                    <Input id="reg-phone" type="tel" placeholder="+1 555 000 000" value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} required minLength="9" className="bg-gray-800 border-gray-700 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-pass">Password</Label>
                    <Input id="reg-pass" type="password" placeholder="••••••••" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required className="bg-gray-800 border-gray-700 text-white" />
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox id="terms" checked={acceptTerms} onCheckedChange={setAcceptTerms} />
                    <Label htmlFor="terms" className="text-sm text-gray-400 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      I accept the terms and privacy policy.
                    </Label>
                  </div>
                  <Button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-black font-bold mt-2" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign Up'}
                  </Button>
                </form>
                {OAUTH_PROVIDERS.length > 0 && (
                  <div className="pt-4">
                    <div className="relative my-3">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-700" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-gray-900 px-2 text-gray-500">or</span>
                      </div>
                    </div>
                    <OAuthButtons enabledProviders={OAUTH_PROVIDERS} />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
