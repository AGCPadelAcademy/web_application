import { supabase } from '@/lib/customSupabaseClient';
import { formDataToProfilePayload } from '@/lib/profileService';

export const ASSIGNABLE_ROLES = ['student', 'coach', 'admin'];
export const CLIENT_DIRECTORY_FIELDS = [
  'id', 'first_name', 'last_name', 'full_name', 'email', 'phone',
  'date_of_birth', 'address', 'postal_code', 'city', 'country',
  'country_code', 'role', 'is_active', 'updated_at',
].join(', ');

const MESSAGES = {
  ownRole: 'You cannot change your own role.',
  ownStatus: 'You cannot deactivate your own administrator profile.',
  accounting: 'Accounting is managed in Bexio and cannot be assigned here.',
  lastAdmin: 'At least one active administrator is required.',
};

export function mapClientManagementError(error) {
  const detail = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (detail.includes('own role')) return new Error(MESSAGES.ownRole);
  if (detail.includes('own administrator') || detail.includes('deactivate their own')) {
    return new Error(MESSAGES.ownStatus);
  }
  if (detail.includes('accounting') || detail.includes('bexio')) return new Error(MESSAGES.accounting);
  if (detail.includes('at least one active administrator')) return new Error(MESSAGES.lastAdmin);
  return error instanceof Error ? error : new Error(error?.message || 'Client management operation failed.');
}

function safeSearchTerm(value) {
  return String(value || '').trim().replace(/[%_,().]/g, '');
}

export async function listClients({
  search = '',
  role = 'all',
  status = 'all',
  page = 1,
  pageSize = 50,
} = {}) {
  const boundedSize = Math.min(100, Math.max(1, Number(pageSize) || 50));
  const boundedPage = Math.max(1, Number(page) || 1);
  const from = (boundedPage - 1) * boundedSize;
  let query = supabase
    .from('profiles')
    .select(CLIENT_DIRECTORY_FIELDS, { count: 'exact' })
    .order('full_name', { ascending: true })
    .order('id', { ascending: true });

  const term = safeSearchTerm(search);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  if (ASSIGNABLE_ROLES.includes(role) || role === 'accounting') query = query.eq('role', role);
  if (status === 'active') query = query.eq('is_active', true);
  if (status === 'inactive') query = query.eq('is_active', false);

  const { data, error, count } = await query.range(from, from + boundedSize - 1);
  if (error) throw mapClientManagementError(error);
  return { clients: data ?? [], count: count ?? 0, page: boundedPage, pageSize: boundedSize };
}

async function updateClient(clientId, payload) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', clientId)
    .select(CLIENT_DIRECTORY_FIELDS)
    .single();
  if (error) throw mapClientManagementError(error);
  return data;
}

export function updateClientPersonalFields(clientId, formData) {
  return updateClient(clientId, formDataToProfilePayload(formData));
}

export function updateClientRole(clientId, role, currentUserId) {
  if (clientId === currentUserId) return Promise.reject(new Error(MESSAGES.ownRole));
  if (role === 'accounting') return Promise.reject(new Error(MESSAGES.accounting));
  if (!ASSIGNABLE_ROLES.includes(role)) return Promise.reject(new Error('Unsupported role.'));
  return updateClient(clientId, { role });
}

export function updateClientStatus(clientId, isActive, currentUserId) {
  if (clientId === currentUserId && !isActive) return Promise.reject(new Error(MESSAGES.ownStatus));
  return updateClient(clientId, { is_active: Boolean(isActive) });
}
