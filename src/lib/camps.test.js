import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      order: vi.fn(() => chain),
      maybeSingle: vi.fn(() => chain),
      single: vi.fn(() => chain),
      then: (resolve) => Promise.resolve(result).then(resolve),
    };
    return chain;
  };
  const mockSupabase = {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { access_token: 'test-token' } } })
      ),
    },
  };
  return { mockSupabase, makeChain };
});

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import {
  CAMP_CARD_FLYER_FRAME_CLASS,
  campDisplayTotal,
  campInvoicePreviewFromSubmit,
  clearCampDraft,
  CSV_REGISTRATION_FIELDS,
  deriveCampStatus,
  distinctCampTypes,
  extrasTotal,
  filterCampsByType,
  funnelEventPayload,
  FUNNEL_EVENTS,
  readCampDraft,
  serializeRegistrationsCsv,
  submitCampRegistration,
  upsertCamp,
  writeCampDraft,
} from '@/lib/camps';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deriveCampStatus', () => {
  const now = new Date('2026-09-08T12:00:00Z');

  it('maps full camps to full regardless of window', () => {
    expect(deriveCampStatus({ is_full: true, registration_opens_at: null, registration_deadline_at: null }, now)).toBe('full');
  });

  it('maps closed window and open published camps', () => {
    expect(deriveCampStatus({
      is_full: false,
      registration_opens_at: '2026-10-01T00:00:00Z',
      registration_deadline_at: null,
    }, now)).toBe('closed');
    expect(deriveCampStatus({
      is_full: false,
      registration_opens_at: '2026-08-01T00:00:00Z',
      registration_deadline_at: '2026-10-01T00:00:00Z',
    }, now)).toBe('open');
  });
});

describe('extras total display', () => {
  it('adds extra prices to the camp base', () => {
    expect(extrasTotal([{ price_amount: 25 }, { price_amount: 10 }])).toBe(35);
  });

  it('switches the registration total to the member price with and without extras', () => {
    const camp = { price_amount: 199, member_price_amount: 179 };
    expect(campDisplayTotal(camp, [], null)).toBe(199);
    expect(campDisplayTotal(camp, [], 179)).toBe(179);
    expect(campDisplayTotal(camp, [{ price_amount: 25 }], 179)).toBe(204);
    expect(campDisplayTotal(camp, [{ price_amount: 25 }], null)).toBe(224);
  });
});

describe('camp type filters', () => {
  const camps = [
    { id: '1', camp_type: 'Mini' },
    { id: '2', camp_type: 'Junior' },
    { id: '3', camp_type: 'Mini' },
    { id: '4', camp_type: null },
    { id: '5', camp_type: '  ' },
  ];

  it('lists distinct non-empty types and excludes empty type from chips', () => {
    expect(distinctCampTypes(camps)).toEqual(['Junior', 'Mini']);
  });

  it('filters to one type and restores the full list for All', () => {
    expect(filterCampsByType(camps, 'Mini').map((c) => c.id)).toEqual(['1', '3']);
    expect(filterCampsByType(camps, null)).toEqual(camps);
    expect(filterCampsByType(camps, '')).toEqual(camps);
  });
});

describe('admin camp invoke', () => {
  it('sends the session JWT when upserting a camp', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { camp: { id: '1' } }, error: null });
    await upsertCamp({ name: 'Junior' });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('camp-admin', {
      headers: { Authorization: 'Bearer test-token' },
      body: { action: 'upsert_camp', camp: { name: 'Junior' } },
    });
  });

  it('submits a registration with terms accepted', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { registration: { id: 'r1' } }, error: null });
    await submitCampRegistration({ campId: 'c1', childId: 'k1', extraIds: ['e1'] });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('camp-submit-registration', expect.objectContaining({
      headers: { Authorization: 'Bearer test-token' },
      body: expect.objectContaining({
        camp_id: 'c1',
        child_id: 'k1',
        extra_ids: ['e1'],
        terms_accepted: true,
      }),
    }));
  });

  it('forwards the membership claim to the submit function', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { registration: { id: 'r1' } }, error: null });
    await submitCampRegistration({ campId: 'c1', childId: 'k1', extraIds: [], membershipClaimed: true });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('camp-submit-registration', expect.objectContaining({
      body: expect.objectContaining({ membership_claimed: true }),
    }));
    await submitCampRegistration({ campId: 'c1', childId: 'k1', extraIds: [] });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('camp-submit-registration', expect.objectContaining({
      body: expect.objectContaining({ membership_claimed: false }),
    }));
  });
});

describe('CSV serialization', () => {
  it('emits only the authorized FR-035 field set', () => {
    const csv = serializeRegistrationsCsv([{
      camp_name: 'Junior Camp',
      child_first_name: 'Mia',
      child_last_name: 'Parent',
      child_age: 9,
      parent_full_name: 'Alex Parent',
      parent_phone: '+41',
      parent_email: 'a@example.com',
      padel_level: 'beginner',
      extras: ['Lunch'],
      total_amount: 374,
      payment_status: 'pending',
      member_price_claimed: true,
      registration_date: '2026-09-08',
      remaining_places: 1,
      secret: 'nope',
    }]);
    expect(csv.split('\n')[0]).toBe(CSV_REGISTRATION_FIELDS.join(','));
    expect(csv).toContain('Junior Camp');
    expect(csv).toContain('true');
    expect(csv).not.toContain('secret');
    expect(csv).not.toContain('nope');
  });
});

describe('funnel payloads', () => {
  it('contains only camp id + event, never PII', () => {
    const payload = funnelEventPayload(FUNNEL_EVENTS.STARTED, 'camp-1');
    expect(payload).toEqual({ camp_id: 'camp-1', event: 'camp_registration_started' });
    expect(JSON.stringify(payload)).not.toMatch(/email|phone|allerg|dob|emergency|name/i);
  });
});

describe('registration draft preservation', () => {
  const makeStorage = () => {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key),
    };
  };

  it('round-trips child, extras, terms, and membership claim state', () => {
    const storage = makeStorage();
    writeCampDraft('camp-1', { childId: 'k1', selectedExtras: ['e1', 'e2'], termsAccepted: true, memberClaimed: true }, storage);
    expect(readCampDraft('camp-1', storage)).toEqual({
      childId: 'k1',
      selectedExtras: ['e1', 'e2'],
      termsAccepted: true,
      memberClaimed: true,
    });
  });

  it('returns null for missing or corrupt drafts and sanitizes shapes', () => {
    const storage = makeStorage();
    expect(readCampDraft('camp-1', storage)).toBeNull();
    storage.setItem('campRegistrationDraft:camp-1', '{not json');
    expect(readCampDraft('camp-1', storage)).toBeNull();
    writeCampDraft('camp-1', { childId: 42, selectedExtras: 'nope', termsAccepted: 'yes', memberClaimed: 'yes' }, storage);
    expect(readCampDraft('camp-1', storage)).toEqual({ childId: null, selectedExtras: [], termsAccepted: false, memberClaimed: false });
  });

  it('clears the draft after submit', () => {
    const storage = makeStorage();
    writeCampDraft('camp-1', { childId: 'k1', selectedExtras: [], termsAccepted: true }, storage);
    clearCampDraft('camp-1', storage);
    expect(readCampDraft('camp-1', storage)).toBeNull();
  });
});

describe('post-submit invoice preview (C4)', () => {
  it('opens the preview for the returned registration and does not send the parent to /children first', () => {
    const preview = campInvoicePreviewFromSubmit({
      registration: { id: 'reg-1' },
      document: { id: 'doc-1', document_nr: 'RE-1' },
    });
    expect(preview).toEqual({ campRegistrationId: 'reg-1', documentReady: true });
    expect(preview.campRegistrationId).not.toBeNull();
  });

  it('still opens the preview when issuance is queued (document null)', () => {
    expect(campInvoicePreviewFromSubmit({ registration: { id: 'reg-2' }, document: null })).toEqual({
      campRegistrationId: 'reg-2',
      documentReady: false,
    });
  });
});

describe('camp card flyer frame (C4 T111)', () => {
  it('gives the flyer an explicit mobile height so object-contain cannot collapse', () => {
    expect(CAMP_CARD_FLYER_FRAME_CLASS).toMatch(/\bh-64\b/);
    expect(CAMP_CARD_FLYER_FRAME_CLASS).not.toMatch(/\bmin-h-\[16rem\]\b/);
    expect(CAMP_CARD_FLYER_FRAME_CLASS).toMatch(/\border-first\b/);
  });
});
