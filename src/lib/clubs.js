import { supabase } from '@/lib/customSupabaseClient';

export const CLUB_LIST_FIELDS = 'id,name,location,phone,email,is_active,updated_at';
export const CLUB_NEW_USE_FIELDS = 'id,name,location';

const MESSAGES = {
  nameRequired: 'A club name is required.',
  duplicateName: 'A club with this name already exists.',
  notAllowed: 'You are not allowed to manage clubs.',
  generic: 'Club operation failed.',
};

function emptyToNull(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

export function mapClubError(error) {
  const detail = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (detail.includes('23505') || detail.includes('duplicate') || detail.includes('clubs_name_lower')) {
    return new Error(MESSAGES.duplicateName);
  }
  if (
    detail.includes('club name is required')
    || (detail.includes('name') && (detail.includes('23514') || detail.includes('null value') || detail.includes('not-null')))
  ) {
    return new Error(MESSAGES.nameRequired);
  }
  if (
    detail.includes('42501')
    || detail.includes('row-level security')
    || detail.includes('permission denied')
    || detail.includes('not allowed')
  ) {
    return new Error(MESSAGES.notAllowed);
  }
  if (error instanceof Error && error.message) return error;
  return new Error(error?.message || MESSAGES.generic);
}

function clubDetailsPayload(input) {
  const name = String(input?.name ?? '').trim();
  if (!name) throw new Error(MESSAGES.nameRequired);
  return {
    name,
    location: emptyToNull(input?.location),
    phone: emptyToNull(input?.phone),
    email: emptyToNull(input?.email),
  };
}

export async function listClubs() {
  const { data, error } = await supabase
    .from('clubs')
    .select(CLUB_LIST_FIELDS)
    .order('name', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw mapClubError(error);
  return data ?? [];
}

export async function listClubsForNewUse() {
  const { data, error } = await supabase
    .from('clubs_for_new_use')
    .select(CLUB_NEW_USE_FIELDS)
    .order('name', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw mapClubError(error);
  return data ?? [];
}

export async function createClub(input) {
  const payload = clubDetailsPayload(input);
  const { data, error } = await supabase
    .from('clubs')
    .insert(payload)
    .select(CLUB_LIST_FIELDS)
    .single();
  if (error) throw mapClubError(error);
  return data;
}

export async function updateClub(clubId, input) {
  const payload = clubDetailsPayload(input);
  const { data, error } = await supabase
    .from('clubs')
    .update(payload)
    .eq('id', clubId)
    .select(CLUB_LIST_FIELDS)
    .single();
  if (error) throw mapClubError(error);
  return data;
}

export async function setClubActive(clubId, isActive) {
  const { data, error } = await supabase
    .from('clubs')
    .update({ is_active: Boolean(isActive) })
    .eq('id', clubId)
    .select(CLUB_LIST_FIELDS)
    .single();
  if (error) throw mapClubError(error);
  return data;
}
