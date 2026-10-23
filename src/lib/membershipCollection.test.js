import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  COLLECTION_COPY,
  COLLECTION_ERROR_COPY,
  adminCollectionLists,
  assertCollectionCopyAllowed,
  buildSubjectCollectionView,
  isCollectionDataAvailable,
  listCollectionSubjects,
  requestNewMandate,
  setCollectionMethod,
} from '@/lib/membershipCollection';

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'test-token' } },
  });
});

describe('membership-set-collection-method', () => {
  it('posts subject_id and automatic_collection', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { method: 'qr_invoice' }, error: null });

    await setCollectionMethod('subject-1', 'automatic_collection');

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      'membership-set-collection-method',
      {
        headers: { Authorization: 'Bearer test-token' },
        body: { subject_id: 'subject-1', method: 'automatic_collection' },
      },
    );
  });

  it('posts qr_invoice when automatic collection is declined', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { method: 'qr_invoice' }, error: null });

    await setCollectionMethod('subject-1', 'qr_invoice');

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      'membership-set-collection-method',
      expect.objectContaining({
        body: { subject_id: 'subject-1', method: 'qr_invoice' },
      }),
    );
  });

  it('maps an unconfigured channel to the invoice fallback copy', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: () => Promise.resolve({ error: 'collection_channel_not_configured' }) },
      },
    });

    await expect(setCollectionMethod('subject-1', 'automatic_collection')).rejects.toThrow(
      COLLECTION_COPY.channelNotConfigured,
    );
  });
});

describe('membership-request-mandate', () => {
  it('posts subject_id for an explicit new attempt', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({ data: { status: 'proposal_sent' }, error: null });

    await requestNewMandate('subject-9');

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      'membership-request-mandate',
      {
        headers: { Authorization: 'Bearer test-token' },
        body: { subject_id: 'subject-9' },
      },
    );
  });
});

describe('collection copy', () => {
  it('rejects Automatic transaction, standing approval, and standing order', () => {
    for (const phrase of ['Automatic transaction', 'standing approval', 'standing order']) {
      expect(() => assertCollectionCopyAllowed(`Enable ${phrase} in e-banking`)).toThrow(phrase);
    }
    expect(() => assertCollectionCopyAllowed(Object.values(COLLECTION_COPY).join('\n'))).not.toThrow();
    expect(() => assertCollectionCopyAllowed(Object.values(COLLECTION_ERROR_COPY).join('\n'))).not.toThrow();
  });

  it('uses the contract sentences and does not treat proposal or active as paid', () => {
    const proposal = buildSubjectCollectionView({
      id: 's1',
      client_id: 'c1',
      display_label: 'Adult evening',
      collection_methods: { method: 'automatic_collection' },
      direct_debit_mandates: [
        { attempt_no: 1, status: 'rejected' },
        { attempt_no: 2, status: 'proposal_sent' },
      ],
      membership_period_intents: [{
        id: 'period-1',
        period_key: '2026-10',
        amount: 120,
        currency: 'CHF',
        status: 'pending',
        created_at: '2026-10-01T00:00:00Z',
      }],
    });

    expect(proposal.mandateStatus).toBe('proposal_sent');
    expect(proposal.statusCopy).toBe('Waiting for bank mandate approval');
    expect(proposal.periods[0].paid).toBe(false);
    expect(proposal.periods[0].showInvoice).toBe(false);
    expect(proposal.statusCopy.toLowerCase()).not.toContain('paid');

    const active = buildSubjectCollectionView({
      id: 's1',
      client_id: 'c1',
      display_label: 'Adult evening',
      collection_methods: { method: 'automatic_collection' },
      direct_debit_mandates: [{ attempt_no: 1, status: 'active' }],
      membership_period_intents: [{
        id: 'period-2',
        period_key: '2026-11',
        amount: 80,
        currency: 'CHF',
        status: 'invoiced',
      }],
    });
    expect(active.periods[0].paid).toBe(false);
    expect(active.periods[0].showInvoice).toBe(true);
    expect(active.periods[0].qrPayHidden).toBe(false);
    expect(active.statusCopy).toBe(COLLECTION_COPY.mandateActive);
  });

  it('hides invoice pay while a collection is submitted and keeps QR for the other fallbacks', () => {
    const hidden = buildSubjectCollectionView({
      id: 's1',
      display_label: 'Adult evening',
      collection_methods: { method: 'automatic_collection' },
      direct_debit_mandates: [{ attempt_no: 1, status: 'active' }],
      membership_period_intents: [{
        id: 'period-3',
        period_key: '2026-12',
        status: 'collection_submitted',
        collection_requests: { status: 'submitted' },
      }],
    });
    expect(hidden.periods[0].qrPayHidden).toBe(true);
    expect(hidden.periods[0].showInvoice).toBe(false);
    expect(hidden.periods[0].paid).toBe(false);
    expect(hidden.periods[0].copy).toBe(COLLECTION_COPY.collectionSubmitted);

    const qr = buildSubjectCollectionView({
      id: 's2',
      display_label: 'Adult morning',
      collection_methods: { method: 'qr_invoice' },
      direct_debit_mandates: [],
      membership_period_intents: [{ id: 'period-4', period_key: '2026-12', status: 'invoiced' }],
    });
    expect(qr.statusCopy).toBe('Pay by invoice');
    expect(qr.periods[0].showInvoice).toBe(true);

    const unsupported = buildSubjectCollectionView({
      id: 's3',
      display_label: 'Adult morning',
      collection_methods: { method: 'automatic_collection' },
      direct_debit_mandates: [{ attempt_no: 1, status: 'unsupported_bank' }],
    });
    expect(unsupported.statusCopy).toBe(COLLECTION_COPY.unsupportedBank);
    expect(unsupported.canRequestNewMandate).toBe(false);

    const inactive = buildSubjectCollectionView({
      id: 's4',
      display_label: 'Adult evening',
      profile: { is_active: false },
      collection_methods: { method: 'qr_invoice' },
      direct_debit_mandates: [{ attempt_no: 1, status: 'revoked' }],
    });
    expect(inactive.inactive).toBe(true);
    expect(inactive.canRequestNewMandate).toBe(false);
  });
});

describe('admin collection lists', () => {
  it('lists failed or rejected collections, reversals, and duplicate receipts', () => {
    const lists = adminCollectionLists([{
      id: 's1',
      client_id: 'client-1',
      display_label: 'Adult evening',
      profile: { full_name: 'Ana Client' },
      membership_period_intents: [
        {
          id: 'p1',
          period_key: '2026-09',
          status: 'collection_failed',
          collection_requests: { status: 'failed', failure_reason: 'bank declined' },
        },
        {
          id: 'p2',
          period_key: '2026-10',
          status: 'reversed',
          duplicate_receipt: true,
          membership_payment_signals: [{ kind: 'payment_reversed' }],
          collection_requests: { status: 'rejected' },
        },
      ],
    }]);

    expect(lists.failed).toEqual([
      expect.objectContaining({ period: '2026-09', status: 'failed', client: 'Ana Client' }),
      expect.objectContaining({ period: '2026-10', status: 'rejected' }),
    ]);
    expect(lists.reversals).toEqual([
      expect.objectContaining({ period: '2026-10', status: 'reversed' }),
    ]);
    expect(lists.duplicates).toEqual([
      expect.objectContaining({ period: '2026-10', label: 'Adult evening' }),
    ]);
  });
});

describe('listCollectionSubjects', () => {
  it('reads collection rows under RLS and omits iban', async () => {
    const order = vi.fn(() => Promise.resolve({
      data: [{ id: 's1', client_id: 'c1', display_label: 'Adult evening', collection_methods: null }],
      error: null,
    }));
    const select = vi.fn(() => ({ order }));
    const profileIn = vi.fn(() => Promise.resolve({
      data: [{ id: 'c1', full_name: 'Ana Client', email: 'ana@example.com', is_active: true }],
      error: null,
    }));
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') return { select: () => ({ in: profileIn }) };
      return { select };
    });

    const result = await listCollectionSubjects();

    expect(select).toHaveBeenCalledWith(expect.not.stringContaining('iban'));
    expect(select.mock.calls[0][0]).toContain('collection_methods');
    expect(select.mock.calls[0][0]).toContain('direct_debit_mandates');
    expect(result.available).toBe(true);
    expect(result.subjects[0].profile.full_name).toBe('Ana Client');
  });

  it('stays unavailable when the collection tables are not migrated yet', async () => {
    mockSupabase.from.mockReturnValue({
      select: () => ({
        order: () => Promise.resolve({
          data: null,
          error: { code: 'PGRST205', message: "Could not find the table 'public.collection_subjects' in the schema cache" },
        }),
        limit: () => Promise.resolve({
          data: null,
          error: { code: 'PGRST205', message: 'schema cache' },
        }),
      }),
    });

    await expect(listCollectionSubjects()).resolves.toEqual({ available: false, subjects: [] });
    await expect(isCollectionDataAvailable()).resolves.toBe(false);
  });
});
