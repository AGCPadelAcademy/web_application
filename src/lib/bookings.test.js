import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  // Chainable thenable mimicking the supabase-js query builder.
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      single: vi.fn(() => chain),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  const mockSupabase = {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  };
  return { mockSupabase, makeChain };
});

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import {
  fetchDayBookings,
  buildBookingPayload,
  createBooking,
  requestInvoice,
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

  it('invokes generate-invoice-pdf with the invoice contract', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { success: true, url: 'https://example/inv.pdf', invoice_id: 'inv-1' },
      error: null,
    });

    const result = await requestInvoice({ booking, lesson, profile, userId: 'user-1' });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('generate-invoice-pdf', {
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

  it('throws when the function reports failure', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { success: false, error: 'pdf exploded' }, error: null });
    await expect(requestInvoice({ booking, lesson, profile, userId: 'user-1' })).rejects.toThrow('pdf exploded');
  });

  it('throws on invoke error', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'network down' } });
    await expect(requestInvoice({ booking, lesson, profile, userId: 'user-1' })).rejects.toThrow('network down');
  });
});
