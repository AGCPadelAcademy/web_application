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

import { invoicePreviewDownloadName, loadInvoicePreviewBlob } from '@/lib/invoicePreview';

describe('invoicePreviewDownloadName', () => {
  it('prefers the camp registration id for camp invoices', () => {
    expect(invoicePreviewDownloadName({ campRegistrationId: 'reg-1', bookingId: 'b-1' })).toBe('Invoice_reg-1.pdf');
    expect(invoicePreviewDownloadName({ bookingId: 'b-1' })).toBe('Invoice_b-1.pdf');
  });
});

describe('loadInvoicePreviewBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:invoice-pdf') });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a provided invoiceUrl without fetching', async () => {
    const loaded = await loadInvoicePreviewBlob({ invoiceUrl: 'blob:existing' });
    expect(loaded).toEqual({ previewUrl: 'blob:existing', ownedBlob: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches the camp PDF when campRegistrationId is set', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    fetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });

    const loaded = await loadInvoicePreviewBlob({ campRegistrationId: 'reg-1' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/billing-invoice-document'),
      expect.objectContaining({
        body: JSON.stringify({ camp_registration_id: 'reg-1' }),
      }),
    );
    expect(loaded).toEqual({ previewUrl: 'blob:invoice-pdf', ownedBlob: true });
  });

  it('fetches the lesson PDF when only bookingId is set', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    fetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });

    await loadInvoicePreviewBlob({ bookingId: 'booking-1' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/billing-invoice-document'),
      expect.objectContaining({
        body: JSON.stringify({ booking_id: 'booking-1' }),
      }),
    );
  });

  it('surfaces a pending state when no source is available', async () => {
    await expect(loadInvoicePreviewBlob({})).rejects.toThrow('Invoice is not available yet.');
  });
});
