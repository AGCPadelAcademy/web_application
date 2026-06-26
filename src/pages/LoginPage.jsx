
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Helmet } from 'react-helmet';

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return_to') || '/';
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  // Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

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
        toast({ title: 'Terms not accepted', description: 'You must accept the terms and privacy policy.', variant: 'destructive' });
        return;
    }
    setLoading(true);
    try {
      const { data, error } = await signUp(registerEmail, registerPassword, registerName, registerPhone);
      if (error) throw error;

      if (data?.user) {
        // Task 5: Automatically create a profiles record when user registers.
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: registerName,
          email: registerEmail,
          phone: registerPhone
        });

        if (profileError) {
          console.error("Profile creation error:", profileError);
          toast({ title: 'Profile Warning', description: 'Account created but profile details failed to save.', variant: 'destructive' });
        } else {
          toast({ title: 'Registration completed!', description: 'Check your email to confirm your account.' });
        }
      }

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
              </form>
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
