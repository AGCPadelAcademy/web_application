import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getOrCreateProfile, PROFILE_MESSAGES, updateProfile } from '@/lib/profileService';

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProfile(await getOrCreateProfile(user));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) refresh();
  }, [authLoading, refresh]);

  const saveProfile = useCallback(async (formData) => {
    if (profile?.is_active === false) {
      throw new Error(PROFILE_MESSAGES.inactive);
    }
    const updated = await updateProfile(user.id, formData);
    setProfile(updated);
    return updated;
  }, [profile, user]);

  return {
    profile,
    isActive: profile?.is_active !== false,
    loading: authLoading || loading,
    error,
    refresh,
    saveProfile,
  };
}
