import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext(undefined);

const AUTH_REDIRECT_URL =
  typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'https://agcpadelacademy.com/auth/callback';

/**
 * Single source of truth for keeping `public.profiles` in sync with the
 * Supabase auth user. Called on session restore, onAuthStateChange and from
 * `signUp`. Includes `email` (the previous version omitted it on session
 * sync) and never overwrites existing profile fields with null.
 */
const ensureProfile = async (user) => {
  if (!user) return;
  const metadata = user.user_metadata || {};
  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      full_name: metadata.full_name || user.email,
      phone: metadata.phone ?? null,
      updated_at: new Date(),
    },
    { onConflict: 'id' }
  );
  if (error) {
    // Log but never throw — auth state should not break because of a profile sync issue.
    console.error('ensureProfile: failed to upsert profile:', error);
  }
};

/**
 * Fetch the application role stored on `public.profiles`. Falls back to
 * `student` if the row is missing or the column does not exist yet (e.g.
 * before the roles migration has been applied).
 */
const fetchRole = async (userId) => {
  if (!userId) return 'student';
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    // Most likely the `role` column does not exist yet (migration not applied).
    console.warn('fetchRole: could not load role, defaulting to student:', error.message);
    return 'student';
  }
  return data?.role || 'student';
};

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(true);

  const handleSession = useCallback(async (session) => {
    setSession(session);
    const currentUser = session?.user ?? null;
    setUser(currentUser);
    setLoading(false);

    if (currentUser) {
      await ensureProfile(currentUser);
      const userRole = await fetchRole(currentUser.id);
      setRole(userRole);
      setProfile({ id: currentUser.id, email: currentUser.email, role: userRole });
    } else {
      setRole('student');
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await handleSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signUp = useCallback(async (email, password, fullName, phone) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: AUTH_REDIRECT_URL,
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign-up failed',
        description: error.message || 'Something went wrong.',
      });
      return { error };
    }

    // When email confirmation is required, no session exists yet. We still
    // create the profile row up-front so the user exists in `public.profiles`
    // once they confirm. If confirmation is disabled, onAuthStateChange will
    // also fire and ensureProfile will run again — that's fine (it's an upsert).
    if (data?.user) {
      await ensureProfile(data.user);
    }

    toast({
      title: 'Registration completed!',
      description: 'Check your email to confirm your account.',
    });

    return { error: null, data };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign-in failed',
        description: error.message || 'Something went wrong.',
      });
    }

    return { error };
  }, [toast]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign-out failed',
        description: error.message || 'Something went wrong.',
      });
    }

    return { error };
  }, [toast]);

  const resendConfirmation = useCallback(async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Could not resend email',
        description: error.message || 'Something went wrong.',
      });
      return { error };
    }

    toast({
      title: 'Confirmation email sent',
      description: 'Check your inbox (and spam folder) for the confirmation link.',
    });
    return { error: null };
  }, [toast]);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Could not send reset email',
        description: error.message || 'Something went wrong.',
      });
      return { error };
    }

    toast({
      title: 'Reset email sent',
      description: 'Check your inbox for a link to reset your password.',
    });
    return { error: null };
  }, [toast]);

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Could not update password',
        description: error.message || 'Something went wrong.',
      });
      return { error };
    }

    toast({
      title: 'Password updated',
      description: 'You can now sign in with your new password.',
    });
    return { error: null };
  }, [toast]);

  const signInWithOAuth = useCallback(async (provider, options = {}) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: options.redirectTo || `${window.location.origin}/auth/callback`,
        ...(options.queryParams ? { queryParams: options.queryParams } : {}),
      },
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: `${provider} sign-in failed`,
        description: error.message || 'Something went wrong.',
      });
    }

    return { data, error };
  }, [toast]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    role,
    loading,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    resendConfirmation,
    resetPassword,
    updatePassword,
  }), [user, session, profile, role, loading, signUp, signIn, signInWithOAuth, signOut, resendConfirmation, resetPassword, updatePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
