import { supabase } from '@/lib/customSupabaseClient';

export const MEMBERSHIP_STATUSES = [
  'pending_payment',
  'active',
  'paused',
  'cancelled',
  'expired',
];

export const MEMBERSHIP_STATUS_LABELS = {
  pending_payment: 'Pending Payment',
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const MEMBERSHIP_FIELDS = [
  'id',
  'user_id',
  'group_id',
  'status',
  'monthly_price_amount',
  'cancellation_effective_on',
  'updated_at',
  'start_date',
].join(', ');

const WITH_NAMES = `${MEMBERSHIP_FIELDS}, profiles:user_id(full_name, email), groups:group_id(name, weekday, start_time, end_time)`;

const MESSAGES = {
  duplicate: 'This client already has a live membership in that group.',
  inactiveGroup: 'That group is not active.',
  inactiveClient: 'That client is not active.',
  transition: 'That membership change is not allowed.',
  denied: 'You cannot change this membership.',
  price: 'Enter a monthly price greater than zero.',
  fields: 'Choose a client and a group.',
};

export function mapMembershipError(error) {
  const detail = `${error?.message || ''} ${error?.details || ''} ${error?.code || ''}`.toLowerCase();
  if (detail.includes('memberships_one_live') || detail.includes('duplicate') || detail.includes('23505')) {
    return new Error(MESSAGES.duplicate);
  }
  if (detail.includes('group is inactive')) return new Error(MESSAGES.inactiveGroup);
  if (detail.includes('client is inactive')) return new Error(MESSAGES.inactiveClient);
  if (detail.includes('transition is not allowed') || detail.includes('cannot expire')) {
    return new Error(MESSAGES.transition);
  }
  if (
    detail.includes('not permitted')
    || detail.includes('cannot change other fields')
    || detail.includes('42501')
  ) {
    return new Error(MESSAGES.denied);
  }
  return error instanceof Error ? error : new Error(error?.message || 'Membership operation failed.');
}

function boundedPage(page, pageSize) {
  const size = Math.min(100, Math.max(1, Number(pageSize) || 50));
  const current = Math.max(1, Number(page) || 1);
  return { size, current, from: (current - 1) * size };
}

export async function listGroups() {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, weekday, start_time, end_time, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw mapMembershipError(error);
  return data ?? [];
}

export async function listMemberships({ status = 'all', page = 1, pageSize = 50 } = {}) {
  const { size, current, from } = boundedPage(page, pageSize);
  let query = supabase
    .from('memberships')
    .select(WITH_NAMES, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true });
  if (MEMBERSHIP_STATUSES.includes(status)) query = query.eq('status', status);
  const { data, error, count } = await query.range(from, from + size - 1);
  if (error) throw mapMembershipError(error);
  return { memberships: data ?? [], count: count ?? 0, page: current, pageSize: size };
}

export async function createMembership({ clientId, groupId, monthlyPriceAmount }) {
  if (!clientId || !groupId) return Promise.reject(new Error(MESSAGES.fields));
  const price = Number(monthlyPriceAmount);
  if (!Number.isFinite(price) || price <= 0) return Promise.reject(new Error(MESSAGES.price));
  const { data, error } = await supabase
    .from('memberships')
    .insert({
      user_id: clientId,
      group_id: groupId,
      monthly_price_amount: price.toFixed(2),
      status: 'pending_payment',
    })
    .select(MEMBERSHIP_FIELDS)
    .single();
  if (error) throw mapMembershipError(error);
  return data;
}

async function setStatus(membershipId, status) {
  const { data, error } = await supabase
    .from('memberships')
    .update({ status })
    .eq('id', membershipId)
    .select(MEMBERSHIP_FIELDS)
    .single();
  if (error) throw mapMembershipError(error);
  return data;
}

export function activateMembership(membershipId) {
  return setStatus(membershipId, 'active');
}

export function pauseMembership(membershipId) {
  return setStatus(membershipId, 'paused');
}

export function resumeMembership(membershipId) {
  return setStatus(membershipId, 'active');
}

export function cancelMembership(membershipId) {
  return setStatus(membershipId, 'cancelled');
}

export function expireMembership(membershipId) {
  return setStatus(membershipId, 'expired');
}

export function cancelMyMembership(membershipId) {
  return cancelMembership(membershipId);
}

export async function fetchMyMemberships() {
  const { data, error } = await supabase
    .from('memberships')
    .select(`${MEMBERSHIP_FIELDS}, groups:group_id(name, weekday, start_time, end_time)`)
    .order('updated_at', { ascending: false });
  if (error) throw mapMembershipError(error);
  return data ?? [];
}
