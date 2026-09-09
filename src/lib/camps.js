import { supabase } from '@/lib/customSupabaseClient';

export const CAMPS_TERMS_VERSION = '2026-09';
export const CAMP_FULL_LABEL = 'Complet / Ausgebucht';
export const INACTIVE_CLIENT_MESSAGE = 'This client profile is inactive. Contact the academy.';

export const FUNNEL_EVENTS = {
  PAGE_VIEW: 'camps_page_view',
  STARTED: 'camp_registration_started',
  COMPLETED: 'camp_registration_completed',
  PAYMENT_CONFIRMED: 'camp_payment_confirmed',
};

export const CSV_REGISTRATION_FIELDS = [
  'camp_name',
  'child_first_name',
  'child_last_name',
  'child_age',
  'parent_full_name',
  'parent_phone',
  'parent_email',
  'padel_level',
  'extras',
  'total_amount',
  'payment_status',
  'registration_date',
  'remaining_places',
];

async function invokeCampFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in.');
  }

  const { data, error } = await supabase.functions.invoke(name, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body,
  });

  if (error) {
    let detail = error.message;
    const response = error.context;
    if (response && typeof response.json === 'function') {
      try {
        const parsed = await response.json();
        detail = parsed?.error || parsed?.message || detail;
      } catch { /* body already consumed or not JSON */ }
    }
    throw new Error(detail || 'Camp request failed');
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data;
}

export function deriveCampStatus(camp, now = new Date()) {
  if (!camp) return 'closed';
  if (camp.is_full) return 'full';
  const opens = camp.registration_opens_at ? new Date(camp.registration_opens_at) : null;
  const deadline = camp.registration_deadline_at ? new Date(camp.registration_deadline_at) : null;
  if (opens && now < opens) return 'closed';
  if (deadline && now > deadline) return 'closed';
  return 'open';
}

export function formatCampPrice(amount, currency = 'CHF') {
  const value = Number(amount);
  if (Number.isNaN(value)) return '';
  return `${value.toFixed(2)} ${currency}`;
}

export function extrasTotal(extras = []) {
  return extras.reduce((sum, extra) => sum + Number(extra.price_amount || 0), 0);
}

export function campDisplayTotal(camp, selectedExtras = []) {
  return Number(camp?.price_amount || 0) + extrasTotal(selectedExtras);
}

export async function fetchPublicCamps() {
  const { data, error } = await supabase
    .from('camp_public_list')
    .select('*')
    .order('start_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPublicCamp(slug) {
  const { data, error } = await supabase
    .from('camp_public_list')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function upsertCamp(camp) {
  return invokeCampFunction('camp-admin', { action: 'upsert_camp', camp });
}

export function upsertCampExtra(campId, extra) {
  return invokeCampFunction('camp-admin', { action: 'upsert_extra', camp_id: campId, extra });
}

export function removeCampExtra(extraId) {
  return invokeCampFunction('camp-admin', { action: 'remove_extra', extra_id: extraId });
}

export function listAdminCamps() {
  return invokeCampFunction('camp-admin', { action: 'list_camps' });
}

export function listCampRegistrations(campId, status) {
  return invokeCampFunction('camp-admin', { action: 'list_registrations', camp_id: campId, status });
}

export function exportCampRegistrations(campId) {
  return invokeCampFunction('camp-admin', { action: 'export_registrations', camp_id: campId });
}

export function listCampWaitlist(campId) {
  return invokeCampFunction('camp-admin', { action: 'list_waitlist', camp_id: campId });
}

export function convertWaitlistEntry(entryId) {
  return invokeCampFunction('camp-admin', { action: 'convert_waitlist', entry_id: entryId });
}

export function submitCampRegistration({ campId, childId, extraIds, termsVersion = CAMPS_TERMS_VERSION }) {
  return invokeCampFunction('camp-submit-registration', {
    camp_id: campId,
    child_id: childId,
    extra_ids: extraIds ?? [],
    terms_version: termsVersion,
    terms_accepted: true,
  });
}

export function cancelCampRegistration(registrationId) {
  return invokeCampFunction('camp-cancel-registration', {
    registration_id: registrationId,
  });
}

export async function joinCampWaitlist({ campId, childId, parentId }) {
  const { data, error } = await supabase
    .from('camp_waitlist_entries')
    .insert({ camp_id: campId, child_id: childId, parent_id: parentId, status: 'active' })
    .select()
    .single();
  if (error) {
    const detail = `${error.message || ''} ${error.details || ''}`.toLowerCase();
    if (detail.includes('camp_waitlist_unavailable')) {
      throw new Error('Waitlist is not available for this camp.');
    }
    if (error.code === '23505' || detail.includes('duplicate')) {
      throw new Error('This child is already on the waitlist.');
    }
    throw error;
  }
  return data;
}

export function funnelEventPayload(event, campId = null) {
  return {
    camp_id: campId,
    event,
  };
}

export async function trackCampFunnelEvent(event, campId = null) {
  const payload = funnelEventPayload(event, campId);
  const { error } = await supabase.from('camp_funnel_events').insert(payload);
  if (error) {
    console.warn('camp funnel insert failed', error);
  }
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function serializeRegistrationsCsv(rows = []) {
  const header = CSV_REGISTRATION_FIELDS.join(',');
  const lines = rows.map((row) => CSV_REGISTRATION_FIELDS.map((field) => csvEscape(row[field])).join(','));
  return [header, ...lines].join('\n');
}

export function mapCampError(message) {
  const code = String(message || '');
  const map = {
    camp_full: 'This camp is full.',
    camp_closed: 'Registration is closed for this camp.',
    camp_not_published: 'This camp is not open for registration.',
    age_out_of_range: 'This child is outside the camp age range.',
    duplicate_registration: 'This child is already registered for this camp.',
    profile_incomplete: 'Complete your billing profile before registering.',
    profile_inactive: INACTIVE_CLIENT_MESSAGE,
    terms_required: 'You must accept the terms to continue.',
    emergency_contact_required: 'Add an emergency contact on the child record before registering.',
    extras_invalid: 'One or more selected extras are no longer available.',
    refund_agreement_required: 'Paid registrations cannot be cancelled here.',
    forbidden: 'You do not have permission to do that.',
  };
  return map[code] || code || 'Camp request failed';
}

// --- Registration draft preservation (evolution 2026-09-09, FR-008a) --------

export function campDraftKey(campId) {
  return `campRegistrationDraft:${campId}`;
}

export function readCampDraft(campId, storage) {
  try {
    const raw = storage.getItem(campDraftKey(campId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      childId: typeof parsed.childId === 'string' && parsed.childId ? parsed.childId : null,
      selectedExtras: Array.isArray(parsed.selectedExtras)
        ? parsed.selectedExtras.filter((id) => typeof id === 'string')
        : [],
      termsAccepted: parsed.termsAccepted === true,
    };
  } catch {
    return null;
  }
}

export function writeCampDraft(campId, draft, storage) {
  try {
    storage.setItem(campDraftKey(campId), JSON.stringify({
      childId: draft.childId || null,
      selectedExtras: Array.isArray(draft.selectedExtras) ? draft.selectedExtras : [],
      termsAccepted: draft.termsAccepted === true,
    }));
  } catch {
    /* storage full or unavailable — draft is best-effort */
  }
}

export function clearCampDraft(campId, storage) {
  try {
    storage.removeItem(campDraftKey(campId));
  } catch {
    /* best-effort */
  }
}
