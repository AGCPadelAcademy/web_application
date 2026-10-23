import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { access_token: 'test-token' } } })
      ),
    },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import {
  fetchCampInvoicePdfBlob,
  fetchInvoicePdfBlob,
  fetchMembershipPeriodDocument,
} from '@/lib/billing';

describe('fetchInvoicePdfBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:invoice-pdf') });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts booking_id and returns a blob URL', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    fetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });

    const url = await fetchInvoicePdfBlob('booking-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/billing-invoice-document'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        body: JSON.stringify({ booking_id: 'booking-1' }),
      }),
    );
    expect(url).toBe('blob:invoice-pdf');
  });

  it('surfaces the function error body', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'no_document' }),
    });
    await expect(fetchInvoicePdfBlob('booking-1')).rejects.toThrow('no_document');
  });
});

describe('fetchCampInvoicePdfBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:camp-pdf') });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts camp_registration_id and returns a blob URL', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    fetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });

    const url = await fetchCampInvoicePdfBlob('reg-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/billing-invoice-document'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ camp_registration_id: 'reg-1' }),
      }),
    );
    expect(url).toBe('blob:camp-pdf');
  });
});

describe('fetchMembershipPeriodDocument', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:membership-pdf') });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts membership_period_intent_id and honors a JSON qr_pay_hidden flag', async () => {
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: () => Promise.resolve({ qr_pay_hidden: true }),
    });

    const result = await fetchMembershipPeriodDocument('intent-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/billing-invoice-document'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        body: JSON.stringify({ membership_period_intent_id: 'intent-1' }),
      }),
    );
    expect(result).toEqual({ qrPayHidden: true, previewUrl: null });
  });

  it('honors x-qr-pay-hidden on a membership PDF and still returns the preview', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    fetch.mockResolvedValue({
      ok: true,
      headers: {
        get: (name) => {
          const key = name.toLowerCase();
          if (key === 'content-type') return 'application/pdf';
          if (key === 'x-qr-pay-hidden') return 'true';
          return null;
        },
      },
      blob: () => Promise.resolve(blob),
    });

    const result = await fetchMembershipPeriodDocument('intent-2');

    expect(result).toEqual({ qrPayHidden: true, previewUrl: 'blob:membership-pdf' });
  });

  it('returns a preview when membership QR pay is still offered', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/pdf' },
      blob: () => Promise.resolve(blob),
    });

    const result = await fetchMembershipPeriodDocument('intent-3');

    expect(result.qrPayHidden).toBe(false);
    expect(result.previewUrl).toBe('blob:membership-pdf');
  });
});
