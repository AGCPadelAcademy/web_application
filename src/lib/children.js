import { supabase } from '@/lib/customSupabaseClient';
import { INACTIVE_CLIENT_MESSAGE } from '@/lib/camps';
import { IMAGE_MAX_BYTES, IMAGE_TYPES, validateImageFile } from '@/lib/imageValidation';
import { DEFAULT_PHONE_PREFIX, PHONE_PREFIXES } from '@/lib/phonePrefixes';

export const CHILD_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'padel_level',
  'allergies',
  'emergency_contact_name',
  'emergency_contact_phone',
];

export const CHILD_AVATARS_BUCKET = 'child-avatars';
export const CHILD_AVATAR_MAX_BYTES = IMAGE_MAX_BYTES;
export const CHILD_AVATAR_TYPES = IMAGE_TYPES;
/** Backwards-compatible alias of the shared image validator. */
export const validateChildAvatarFile = validateImageFile;

export const CHILD_HAS_HISTORY_MESSAGE =
  'This child has camp registrations or invoices and cannot be removed. History is kept.';

export function childPayload(input = {}) {
  const payload = {};
  for (const field of CHILD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      const value = input[field];
      payload[field] = typeof value === 'string' ? value.trim() || null : value ?? null;
    }
  }
  return payload;
}

function mapChildError(error) {
  const detail = `${error?.message || ''} ${error?.details || ''} ${error?.code || ''}`.toLowerCase();
  if (detail.includes('inactive')) return new Error(INACTIVE_CLIENT_MESSAGE);
  if (detail.includes('future') || detail.includes('22007')) {
    return new Error('Date of birth cannot be in the future.');
  }
  if (detail.includes('23503') || detail.includes('foreign key') || detail.includes('restrict')) {
    return new Error(CHILD_HAS_HISTORY_MESSAGE);
  }
  return error instanceof Error ? error : new Error(error?.message || 'Child operation failed.');
}

/** Manual date-of-birth entry: accepts DD.MM.YYYY (or ISO YYYY-MM-DD), returns ISO or null. */
export function dobInputToIso(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let year;
  let month;
  let day;
  let match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    [, year, month, day] = match;
  } else {
    match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!match) return null;
    [, day, month, year] = match;
  }
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** ISO (YYYY-MM-DD) → DD.MM.YYYY for the manual-entry field. */
export function dobIsoToInput(iso) {
  const match = typeof iso === 'string' ? iso.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (!match) return '';
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** Prefix + national number → E.164 ('' when both empty, null when invalid). */
export function assembleEmergencyPhone(prefix, national) {
  const p = String(prefix || '').trim();
  const digits = String(national || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!p && !digits) return '';
  if (!/^\+[1-9]\d{0,3}$/.test(p)) return null;
  if (!digits) return null;
  return `${p}${digits}`;
}

/** E.164-ish stored value → { prefix, national } for the split inputs. */
export function splitEmergencyPhone(value) {
  const compact = String(value || '').trim().replace(/[\s-]/g, '');
  if (!compact) return { prefix: DEFAULT_PHONE_PREFIX, national: '' };
  const byLength = [...PHONE_PREFIXES].sort((a, b) => b.length - a.length);
  for (const prefix of byLength) {
    if (compact.startsWith(prefix)) {
      return { prefix, national: compact.slice(prefix.length) };
    }
  }
  const match = compact.match(/^(\+[1-9]\d{0,3})(\d+)$/);
  if (match) return { prefix: match[1], national: match[2] };
  return { prefix: DEFAULT_PHONE_PREFIX, national: compact.replace(/^\+/, '') };
}

export async function listChildren() {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .is('archived_at', null)
    .order('first_name', { ascending: true });
  if (error) throw mapChildError(error);
  return data ?? [];
}

export async function getChild(childId) {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('id', childId)
    .maybeSingle();
  if (error) throw mapChildError(error);
  return data;
}

export async function createChild(input, parentId) {
  const payload = { ...childPayload(input), parent_id: parentId };
  const { data, error } = await supabase
    .from('children')
    .insert(payload)
    .select()
    .single();
  if (error) throw mapChildError(error);
  return data;
}

export async function updateChild(childId, input) {
  const { data, error } = await supabase
    .from('children')
    .update({ ...childPayload(input), updated_at: new Date().toISOString() })
    .eq('id', childId)
    .select()
    .single();
  if (error) throw mapChildError(error);
  return data;
}

export async function archiveChild(childId) {
  const { data, error } = await supabase
    .from('children')
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', childId)
    .select()
    .single();
  if (error) throw mapChildError(error);
  return data;
}

/** Hard delete; the FK RESTRICT on camp_registrations maps to CHILD_HAS_HISTORY_MESSAGE. */
export async function removeChild(childId) {
  const { data, error } = await supabase
    .from('children')
    .delete()
    .eq('id', childId)
    .select('id');
  if (error) throw mapChildError(error);
  if (!data || data.length === 0) {
    throw new Error('Child could not be removed (not found or not permitted).');
  }
}

export async function uploadChildAvatar(childId, parentId, file) {
  const problem = validateChildAvatarFile(file);
  if (problem) throw new Error(problem);
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${parentId}/${childId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(CHILD_AVATARS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw mapChildError(error);
  const { data, error: updateError } = await supabase
    .from('children')
    .update({ avatar_path: path, updated_at: new Date().toISOString() })
    .eq('id', childId)
    .select()
    .single();
  if (updateError) throw mapChildError(updateError);
  return data;
}

export async function removeChildAvatar(child) {
  if (child?.avatar_path) {
    await supabase.storage.from(CHILD_AVATARS_BUCKET).remove([child.avatar_path]).catch(() => {});
  }
  const { data, error } = await supabase
    .from('children')
    .update({ avatar_path: null, updated_at: new Date().toISOString() })
    .eq('id', child.id)
    .select()
    .single();
  if (error) throw mapChildError(error);
  return data;
}

/** Short-lived signed URL for the private bucket; null when unavailable. */
export async function childAvatarSignedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(CHILD_AVATARS_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function listChildCampInvoices(childId) {
  const { data, error } = await supabase
    .from('camp_registrations')
    .select('id, camp_name, camp_start_date, camp_end_date, status, payment_status, total_amount, currency, created_at, billing_documents(status, document_nr)')
    .eq('child_id', childId)
    .order('created_at', { ascending: false });
  if (error) throw mapChildError(error);
  return data ?? [];
}
