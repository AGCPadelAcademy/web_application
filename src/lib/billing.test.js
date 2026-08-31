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

import { fetchInvoicePdfBlob } from '@/lib/billing';

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
