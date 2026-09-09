export interface CampUpsertInput {
  id?: string;
  slug: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  daily_start_time: string | null;
  daily_end_time: string | null;
  schedule_text: string | null;
  min_age: number | null;
  max_age: number | null;
  eligibility_text: string | null;
  price_amount: number;
  member_price_amount: number | null;
  currency: 'CHF';
  max_capacity: number;
  registration_opens_at: string | null;
  registration_deadline_at: string | null;
  is_published: boolean;
  waitlist_enabled: boolean;
  practical_info: string | null;
}

export interface ExtraUpsertInput {
  id?: string;
  name: string;
  description: string | null;
  price_amount: number;
  is_active: boolean;
  sort_order: number;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function slugifyCampName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'camp';
}

export function validateCampPayload(
  input: unknown,
): { ok: true; camp: CampUpsertInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'invalid_camp' };
  const raw = input as Record<string, unknown>;
  const name = asString(raw.name);
  if (!name) return { ok: false, error: 'name_required' };
  const slug = asString(raw.slug) ?? slugifyCampName(name);
  if (!SLUG_RE.test(slug)) return { ok: false, error: 'invalid_slug' };
  const start = asString(raw.start_date);
  const end = asString(raw.end_date);
  if (!start || !end) return { ok: false, error: 'dates_required' };
  if (end < start) return { ok: false, error: 'invalid_date_order' };
  const price = asNumber(raw.price_amount);
  if (price === null || price < 0) return { ok: false, error: 'invalid_price' };
  const memberPrice = raw.member_price_amount == null || raw.member_price_amount === ''
    ? null
    : asNumber(raw.member_price_amount);
  if (memberPrice !== null && memberPrice < 0) return { ok: false, error: 'invalid_member_price' };
  const capacity = asNumber(raw.max_capacity);
  if (capacity === null || capacity <= 0 || !Number.isInteger(capacity)) {
    return { ok: false, error: 'invalid_capacity' };
  }
  const minAge = raw.min_age == null || raw.min_age === '' ? null : asNumber(raw.min_age);
  const maxAge = raw.max_age == null || raw.max_age === '' ? null : asNumber(raw.max_age);
  if (minAge !== null && (minAge < 0 || !Number.isInteger(minAge))) return { ok: false, error: 'invalid_age' };
  if (maxAge !== null && (maxAge < 0 || !Number.isInteger(maxAge))) return { ok: false, error: 'invalid_age' };
  if (minAge !== null && maxAge !== null && maxAge < minAge) return { ok: false, error: 'invalid_age_range' };

  return {
    ok: true,
    camp: {
      id: asString(raw.id) ?? undefined,
      slug,
      name,
      description: asString(raw.description),
      start_date: start,
      end_date: end,
      daily_start_time: asString(raw.daily_start_time),
      daily_end_time: asString(raw.daily_end_time),
      schedule_text: asString(raw.schedule_text),
      min_age: minAge,
      max_age: maxAge,
      eligibility_text: asString(raw.eligibility_text),
      price_amount: price,
      member_price_amount: memberPrice,
      currency: 'CHF',
      max_capacity: capacity,
      registration_opens_at: asString(raw.registration_opens_at),
      registration_deadline_at: asString(raw.registration_deadline_at),
      is_published: raw.is_published === true,
      waitlist_enabled: raw.waitlist_enabled === true,
      practical_info: asString(raw.practical_info),
    },
  };
}

export function validateExtraPayload(
  input: unknown,
): { ok: true; extra: ExtraUpsertInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'invalid_extra' };
  const raw = input as Record<string, unknown>;
  const name = asString(raw.name);
  if (!name) return { ok: false, error: 'name_required' };
  const price = asNumber(raw.price_amount);
  if (price === null || price < 0) return { ok: false, error: 'invalid_price' };
  const sort = asNumber(raw.sort_order) ?? 0;
  return {
    ok: true,
    extra: {
      id: asString(raw.id) ?? undefined,
      name,
      description: asString(raw.description),
      price_amount: price,
      is_active: raw.is_active !== false,
      sort_order: sort,
    },
  };
}

export const REGISTER_ERROR_CODES = new Set([
  'camp_full',
  'camp_closed',
  'camp_not_published',
  'age_out_of_range',
  'duplicate_registration',
  'profile_incomplete',
  'profile_inactive',
  'child_not_owned',
  'child_archived',
  'emergency_contact_required',
  'extras_invalid',
  'member_price_unavailable',
  'not_found',
  'refund_agreement_required',
  'camp_waitlist_unavailable',
]);

export function mapCampDbError(body: string): string | null {
  const lower = body.toLowerCase();
  for (const code of REGISTER_ERROR_CODES) {
    if (lower.includes(code)) return code;
  }
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message && REGISTER_ERROR_CODES.has(parsed.message)) return parsed.message;
  } catch {
    /* not JSON */
  }
  return null;
}

export function isBillingProfileComplete(profile: Record<string, unknown> | null | undefined): boolean {
  if (!profile) return false;
  const fields = ['first_name', 'last_name', 'phone', 'address', 'postal_code', 'city', 'country_code'];
  return fields.every((field) => {
    const value = profile[field];
    return typeof value === 'string' && value.trim() !== '';
  });
}

export function mapSubmitError(message: string): { error: string; status: number } {
  const code = mapCampDbError(message) ?? message;
  const conflict = new Set([
    'camp_full',
    'camp_closed',
    'camp_not_published',
    'age_out_of_range',
    'duplicate_registration',
    'profile_incomplete',
    'profile_inactive',
    'child_not_owned',
    'child_archived',
    'emergency_contact_required',
    'extras_invalid',
    'member_price_unavailable',
  ]);
  if (conflict.has(code)) return { error: code, status: 409 };
  return { error: 'register_failed', status: 500 };
}

export function mapCancelConflict(code: 'paid' | 'cancel_refused'): { error: string; status: number } {
  if (code === 'paid') return { error: 'refund_agreement_required', status: 409 };
  return { error: 'cancel_refused', status: 409 };
}
