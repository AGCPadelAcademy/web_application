import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  // Chainable thenable mimicking the supabase-js query builder.
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      single: vi.fn(() => chain),
      maybeSingle: vi.fn(() => chain),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
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
  fetchDayBookings,
  buildBookingPayload,
  createBooking,
  requestInvoice,
  cancelBooking,
  ACTIVE_BOOKING_STATUSES,
} from '@/lib/bookings';

const lesson = {
  lesson_code: 'AGC-IND-60',
  name: 'Individual Session 60',
  price_amount: 60,
  duration_minutes: 60,
};

const profile = {
  email: 'jane@example.com',
  phone: '+41791234567',
  full_name: 'Jane Doe',
  address: 'Rue du Lac 1',
  postal_code: '1000',
  city: 'Lausanne',
  country: 'Switzerland',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildBookingPayload', () => {
  it('builds the canonical pending-payment payload', () => {
    const payload = buildBookingPayload({
      userId: 'user-1',
      lesson,
      bookingDate: '2026-08-15',
      selectedTime: { time: '10:00', date: new Date('2026-08-15T10:00:00') },
      profile,
      comments: 'First class',
    });

    expect(payload).toEqual({
      user_id: 'user-1',
      lesson_code: 'AGC-IND-60',
      lesson_name: 'Individual Session 60',
      price: '60 CHF',
      booking_date: '2026-08-15',
      start_time: '10:00',
      end_time: '11:00',
      duration_minutes: 60,
      status: 'pending_payment',
      payment_status: 'pending',
      client_email: 'jane@example.com',
      client_phone: '+41791234567',
      notes: 'First class',
    });
  });

  it('leaves times null when no slot is selected', () => {
    const payload = buildBookingPayload({
      userId: 'user-1',
      lesson,
      bookingDate: '2026-08-15',
      selectedTime: null,
      profile,
      comments: '',
    });

    expect(payload.start_time).toBeNull();
    expect(payload.end_time).toBeNull();
  });
});

describe('fetchDayBookings', () => {
  it('queries the booking_slots view for the date with active statuses and returns rows', async () => {
    const rows = [{ booking_date: '2026-08-15', start_time: '10:00', end_time: '11:00', payment_status: 'pending' }];
    const chain = makeChain({ data: rows, error: null });
    mockSupabase.from.mockReturnValue(chain);

    const result = await fetchDayBookings('2026-08-15');

    expect(mockSupabase.from).toHaveBeenCalledWith('booking_slots');
    expect(chain.eq).toHaveBeenCalledWith('booking_date', '2026-08-15');
    expect(chain.in).toHaveBeenCalledWith('payment_status', ACTIVE_BOOKING_STATUSES);
    expect(result).toEqual(rows);
  });

  it('returns an empty array when data is null', async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: null, error: null }));
    expect(await fetchDayBookings('2026-08-15')).toEqual([]);
  });

  it('throws on query error', async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: null, error: new Error('boom') }));
    await expect(fetchDayBookings('2026-08-15')).rejects.toThrow('boom');
  });
});

describe('createBooking', () => {
  it('inserts and returns the created row', async () => {
    const created = { id: 'booking-1' };
    const chain = makeChain({ data: created, error: null });
    mockSupabase.from.mockReturnValue(chain);

    const payload = { lesson_code: 'AGC-IND-60' };
    expect(await createBooking(payload)).toEqual(created);
    expect(chain.insert).toHaveBeenCalledWith(payload);
  });

  it('throws on insert error', async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: null, error: new Error('insert failed') }));
    await expect(createBooking({})).rejects.toThrow('insert failed');
  });
});

describe('requestInvoice', () => {
  const booking = { id: 'booking-1', booking_date: '2026-08-15', lesson_name: 'Individual Session 60' };

  beforeEach(() => {
    // Default: cutover flag off → legacy generate-invoice-pdf path (R-12).
    mockSupabase.from.mockReturnValue(makeChain({ data: { integration_enabled: false }, error: null }));
  });

  it('invokes generate-invoice-pdf with the invoice contract', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { success: true, url: 'https://example/inv.pdf', invoice_id: 'inv-1' },
      error: null,
    });

    const result = await requestInvoice({ booking, lesson, profile, userId: 'user-1' });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('generate-invoice-pdf', {
      headers: { Authorization: 'Bearer test-token' },
      body: {
        booking_id: 'booking-1',
        amount: 60,
        invoice_date: '2026-08-15',
        customer_fullname: 'Jane Doe',
        customer_address: 'Rue du Lac 1',
        customer_postal_city: '1000 Lausanne',
        customer_country: 'Switzerland',
        lesson_name: 'Individual Session 60',
        qty: 1,
        user_id: 'user-1',
      },
    });
    expect(result.url).toBe('https://example/inv.pdf');
  });

  it('defaults invoice_date to today when booking_date is null', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { success: true, url: 'https://example/inv.pdf', invoice_id: 'inv-1' },
      error: null,
    });

    await requestInvoice({
      booking: { id: 'booking-1', booking_date: null, lesson_name: 'Individual Session 60' },
      lesson,
      profile,
      userId: 'user-1',
    });

    const body = mockSupabase.functions.invoke.mock.calls[0][1].body;
    expect(body.invoice_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('throws when the function reports failure', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { success: false, error: 'pdf exploded' }, error: null });
    await expect(requestInvoice({ booking, lesson, profile, userId: 'user-1' })).rejects.toThrow('pdf exploded');
  });

  it('throws on invoke error', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'network down' } });
    await expect(requestInvoice({ booking, lesson, profile, userId: 'user-1' })).rejects.toThrow('network down');
  });

  it('throws without invoking when there is no session', async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(requestInvoice({ booking, lesson, profile, userId: 'user-1' })).rejects.toThrow('signed in');
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('uses billing-issue-invoice when the Bexio cutover flag is on (Q1-A)', async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: { integration_enabled: true }, error: null }));
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { document: { id: 'doc-1', document_nr: 'RE-00001', status: 'issued', total: 60, currency: 'CHF' }, reused: false },
      error: null,
    });

    const result = await requestInvoice({ booking, lesson, profile, userId: 'user-1' });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('billing-issue-invoice', {
      headers: { Authorization: 'Bearer test-token' },
      body: { booking_id: 'booking-1', idempotency_key: 'booking:booking-1:invoice:v1' },
    });
    expect(result.url).toBeNull();
    expect(result.document.document_nr).toBe('RE-00001');
  });

  it('surfaces provider_unavailable from the Bexio path (no legacy fallback)', async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: { integration_enabled: true }, error: null }));
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge function returned a non-2xx status code', context: { json: () => Promise.resolve({ error: 'provider_unavailable' }) } },
    });
    await expect(requestInvoice({ booking, lesson, profile, userId: 'user-1' })).rejects.toThrow('provider_unavailable');
  });
});

describe('cancelBooking', () => {
  it('updates the booking when Bexio billing is off', async () => {
    const flagChain = makeChain({ data: { integration_enabled: false }, error: null });
    const updateChain = makeChain({ data: null, error: null });
    mockSupabase.from
      .mockReturnValueOnce(flagChain)
      .mockReturnValueOnce(updateChain);

    const result = await cancelBooking('booking-1');

    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'bookings');
    expect(updateChain.update).toHaveBeenCalledWith({ status: 'cancelled', payment_status: 'cancelled' });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'booking-1');
    expect(result.outcome).toBe('cancelled');
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('invokes billing-cancel-invoice when Bexio billing is on', async () => {
    mockSupabase.from.mockReturnValue(makeChain({ data: { integration_enabled: true }, error: null }));
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { outcome: 'cancelled', reused: false, document: { status: 'cancelled' } },
      error: null,
    });

    const result = await cancelBooking('booking-1');

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('billing-cancel-invoice', {
      headers: { Authorization: 'Bearer test-token' },
      body: { booking_id: 'booking-1', idempotency_key: 'booking:booking-1:invoice_cancel:v1' },
    });
    expect(result.outcome).toBe('cancelled');
  });
});
