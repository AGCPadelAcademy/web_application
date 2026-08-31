import { supabase } from '@/lib/customSupabaseClient';
import { countryLabel, guessCountryCode } from '@/lib/countries';

function splitFullName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: '', last_name: parts[0] };
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts[parts.length - 1] };
}

// Editable billing fields — `email` is managed by Supabase Auth and never written here.
// F1.02: `role` is intentionally omitted; PostgREST also rejects role changes via trigger.
export const EDITABLE_PROFILE_FIELDS = [
  'first_name',
  'last_name',
  'full_name',
  'phone',
  'address',
  'postal_code',
  'city',
  'country',
  'country_code',
];

export function profileToFormData(profile, user) {
  const split = splitFullName(profile?.full_name || user?.user_metadata?.full_name || '');
  const countryCode = profile?.country_code || guessCountryCode(profile?.country) || '';
  return {
    first_name: profile?.first_name || split.first_name,
    last_name: profile?.last_name || split.last_name,
    full_name: profile?.full_name || user?.user_metadata?.full_name || '',
    email: profile?.email || user?.email || '',
    phone: profile?.phone || '',
    address: profile?.address || '',
    postal_code: profile?.postal_code || '',
    city: profile?.city || '',
    country: profile?.country || '',
    country_code: countryCode,
  };
}

export function formDataToProfilePayload(formData) {
  const first = (formData.first_name || '').trim();
  const last = (formData.last_name || '').trim();
  const countryCode = (formData.country_code || '').trim().toUpperCase();
  return {
    first_name: first,
    last_name: last,
    full_name: `${first} ${last}`.trim(),
    phone: formData.phone,
    address: formData.address,
    postal_code: formData.postal_code,
    city: formData.city,
    country_code: countryCode || null,
    country: countryCode ? countryLabel(countryCode, 'en') : (formData.country || ''),
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
  const payload = {
    updated_at: new Date().toISOString(),
    ...formDataToProfilePayload(formData),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
