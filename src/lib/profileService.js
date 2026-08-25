import { supabase } from '@/lib/customSupabaseClient';

// Editable billing fields — `email` is managed by Supabase Auth and never written here.
// F1.02: `role` is intentionally omitted; PostgREST also rejects role changes via trigger.
export const EDITABLE_PROFILE_FIELDS = ['full_name', 'phone', 'address', 'postal_code', 'city', 'country'];

export function profileToFormData(profile, user) {
  return {
    full_name: profile?.full_name || user?.user_metadata?.full_name || '',
    email: profile?.email || user?.email || '',
    phone: profile?.phone || '',
    address: profile?.address || '',
    postal_code: profile?.postal_code || '',
    city: profile?.city || '',
    country: profile?.country || '',
  };
}

// Read-only fetch. Returns null when the profile row does not exist yet.
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// Fetch-or-insert for users whose profile row was never created (legacy accounts).
export async function getOrCreateProfile(user) {
  const existing = await fetchProfile(user.id);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('profiles')
    .insert([{
      id: user.id,
      full_name: user.user_metadata?.full_name || '',
      email: user.email || '',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(userId, formData) {
  const payload = { updated_at: new Date().toISOString() };
  for (const field of EDITABLE_PROFILE_FIELDS) {
    payload[field] = formData[field];
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
