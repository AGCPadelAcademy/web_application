import { supabase } from '@/lib/customSupabaseClient';
import { countryLabel, guessCountryCode } from '@/lib/countries';

function splitFullName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: '', last_name: parts[0] };
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts[parts.length - 1] };
}

export const PROFILE_MESSAGES = {
  inactive: 'This client profile is inactive. Contact the academy.',
  protected: 'You are not allowed to change this field.',
  futureDob: 'Date of birth cannot be in the future.',
};

export function mapProfileError(error) {
  const detail = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (detail.includes('inactive')) return new Error(PROFILE_MESSAGES.inactive);
  if (detail.includes('date of birth') || detail.includes('22007')) {
    return new Error(PROFILE_MESSAGES.futureDob);
  }
  if (
    detail.includes('protected profile')
    || detail.includes('managed by authentication')
    || detail.includes('not permitted')
    || detail.includes('42501')
  ) {
    return new Error(PROFILE_MESSAGES.protected);
  }
  return error instanceof Error ? error : new Error(error?.message || 'Profile operation failed.');
}

// Owner forms can write only these client-controlled fields. Email comes from
// the signed Auth identity; role and activity are academy-controlled.
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
  'date_of_birth',
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
    date_of_birth: profile?.date_of_birth || '',
    role: profile?.role || 'student',
    is_active: profile?.is_active !== false,
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
    date_of_birth: formData.date_of_birth || null,
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
  if (existing) {
    if (user.email && existing.email !== user.email) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ email: user.email, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw mapProfileError(error);
      return data;
    }
    return existing;
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert([{
      id: user.id,
      full_name: user.user_metadata?.full_name || '',
      email: user.email || '',
    }])
    .select()
    .single();

  if (error) throw mapProfileError(error);
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

  if (error) throw mapProfileError(error);
  return data;
}
