import { supabase } from '@/lib/customSupabaseClient';
import { INACTIVE_CLIENT_MESSAGE } from '@/lib/camps';

export const CHILD_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'padel_level',
  'allergies',
  'emergency_contact_name',
  'emergency_contact_phone',
];

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
  const detail = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (detail.includes('inactive')) return new Error(INACTIVE_CLIENT_MESSAGE);
  if (detail.includes('future') || detail.includes('22007')) {
    return new Error('Date of birth cannot be in the future.');
  }
  return error instanceof Error ? error : new Error(error?.message || 'Child operation failed.');
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

export async function listChildCampInvoices(childId) {
  const { data, error } = await supabase
    .from('camp_registrations')
    .select('id, camp_name, camp_start_date, camp_end_date, status, payment_status, total_amount, currency, created_at, billing_documents(status, document_nr)')
    .eq('child_id', childId)
    .order('created_at', { ascending: false });
  if (error) throw mapChildError(error);
  return data ?? [];
}
