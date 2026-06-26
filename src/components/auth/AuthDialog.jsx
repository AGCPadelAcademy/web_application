
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

const AuthDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (!error) {
      toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
      setOpen(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!acceptTerms) {
        toast({ title: 'Terms not accepted', description: 'You must accept the terms and privacy policy.', variant: 'destructive' });
        return;
    }
    setLoading(true);
    const { data, error } = await signUp(registerEmail, registerPassword, registerName, registerPhone);
    setLoading(false);
    
    if (!error) {
      if (data?.user) {
        // Automatically insert into profiles table
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: registerName,
          email: registerEmail,
          phone: registerPhone
        });

        if (profileError) {
          console.error("Profile auto-creation error:", profileError);
        }
      }
      toast({ title: 'Registration completed!', description: 'Check your email to confirm your account.' });
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-gray-600 hover:bg-gray-800 text-white">Login</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-gray-900 border-gray-700 text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-green-400">Access</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 pt-4">
              <Input type="email" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className="bg-gray-800 border-gray-700 text-white" />
              <Input type="password" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="bg-gray-800 border-gray-700 text-white" />
              <Button type="submit" disabled={loading} className="w-full bg-green-500 hover:bg-green-600 text-black font-bold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Sign In
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4 pt-4">
              <Input placeholder="Full Name" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required className="bg-gray-800 border-gray-700 text-white" />
              <Input type="email" placeholder="Email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required className="bg-gray-800 border-gray-700 text-white" />
              <Input type="tel" placeholder="Phone" value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} required minLength="9" className="bg-gray-800 border-gray-700 text-white" />
              <Input type="password" placeholder="Password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required className="bg-gray-800 border-gray-700 text-white" />
              <div className="flex items-center space-x-2">
                <Checkbox id="dialog-terms" checked={acceptTerms} onCheckedChange={setAcceptTerms} className="border-gray-500" />
                <Label htmlFor="dialog-terms" className="text-sm text-gray-400">I accept the terms and privacy policy.</Label>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-green-500 hover:bg-green-600 text-black font-bold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Sign Up
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
