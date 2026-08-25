/**
 * Unit tests for cancelInvoiceForBooking (T039 / US5).
 * Run with: deno test --allow-env --allow-net=none
 * Provider and repository are fully mocked — no network, no database.
 */

import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  cancelInvoiceForBooking,
  InvoiceCancelConflictError,
  NoBillingDocumentError,
  RefundAgreementRequiredError,
  type BillingDocumentRow,
  type BillingRepo,
} from './financial-service.ts';
import {
  ProviderClientError,
  ProviderUnavailableError,
  type AccountingProvider,
  type ContactInput,
  type ExternalContactRef,
  type ExternalInvoice,
  type InvoiceInput,
} from './accounting-provider.ts';

const CONFIG = {
  bexio_user_id: 1,
  currency_id: 1,
  bank_account_id: 2,
  payment_type_id: 3,
  sales_account_id: 9,
  tax_id_sales: 14,
  unit_id: 5,
  language_id: 1,
  country_id_ch: 7,
  mwst_type: 0,
  mwst_is_net: false,
  payment_term_days: 30,
  template_slug: null,
};

const BOOKING_ID = 'b0000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-08-25T12:00:00Z');

function issuedDoc(overrides: Partial<BillingDocumentRow> = {}): BillingDocumentRow {
  return {
    id: 'doc-1',
    booking_id: BOOKING_ID,
    provider: 'bexio',
    external_id: 'inv-100',
    document_nr: 'RE-00001',
    api_reference: `agc:booking:${BOOKING_ID}`,
    status: 'issued',
    total: 120,
    currency: 'CHF',
    ...overrides,
  };
}

interface MockProvider extends AccountingProvider {
  calls: string[];
  cancelFailWith?: Error;
}

function makeProvider(overrides: Partial<MockProvider> = {}): MockProvider {
  const calls: string[] = [];
  const provider: MockProvider = {
    name: 'bexio',
    calls,
    healthCheck: () => Promise.resolve({ ok: true, checkedAt: 'now' }),
    getConfigStatus: () => Promise.resolve({ complete: true, missing: [] }),
    findContactByEmail: (_email: string) => Promise.resolve(null),
    createContact: (_input: ContactInput) => Promise.resolve({ externalId: 'c1' }),
    updateContact: (_ref: ExternalContactRef, _input: ContactInput) => Promise.resolve(),
    findInvoiceByApiReference: (_ref: string) => Promise.resolve(null),
    createInvoice: (_input: InvoiceInput) =>
      Promise.resolve({
        externalId: 'inv-100',
        documentNr: 'RE-00001',
        status: 'issued',
        total: 120,
        received: 0,
        remaining: 120,
        hasQrPaymentPart: true,
      } satisfies ExternalInvoice),
    issueInvoice: () =>
      Promise.resolve({
        externalId: 'inv-100',
        documentNr: 'RE-00001',
        status: 'issued',
        total: 120,
        received: 0,
        remaining: 120,
        hasQrPaymentPart: true,
      }),
    getInvoice: () =>
      Promise.resolve({
        externalId: 'inv-100',
        documentNr: 'RE-00001',
        status: 'issued',
        total: 120,
        received: 0,
        remaining: 120,
        hasQrPaymentPart: true,
      }),
    getInvoicePdf: () => Promise.resolve({ bytes: new Uint8Array(), fileName: 'x.pdf' }),
    sendInvoiceEmail: () => Promise.resolve(),
    cancelInvoice: () => {
      calls.push('cancelInvoice');
      if (provider.cancelFailWith) return Promise.reject(provider.cancelFailWith);
      return Promise.resolve();
    },
    ...overrides,
  };
  return provider;
}

interface MockRepo extends BillingRepo {
  documents: Map<string, BillingDocumentRow>;
  operations: Map<string, Record<string, unknown>>;
  events: Record<string, unknown>[];
}

function makeRepo(doc: BillingDocumentRow | null): MockRepo {
  const documents = new Map<string, BillingDocumentRow>();
  if (doc) documents.set(doc.booking_id, { ...doc });
  const operations = new Map<string, Record<string, unknown>>();
  const events: Record<string, unknown>[] = [];
  return {
    documents,
    operations,
    events,
    getBooking: () => Promise.resolve(null),
    getProfile: () => Promise.resolve(null),
    getLesson: () => Promise.resolve(null),
    findDocumentByBooking: (bookingId) => Promise.resolve(documents.get(bookingId) ?? null),
    findContactByUser: () => Promise.resolve(null),
    upsertContact: () => Promise.resolve(),
    upsertDocument: (row) => {
      const saved = { ...row, id: row.id ?? 'doc-1' };
      documents.set(row.booking_id, saved);
      return Promise.resolve(saved);
    },
    findOperation: (key) => Promise.resolve((operations.get(key) as never) ?? null),
    upsertOperation: (row) => {
      operations.set(row.idempotency_key, { ...row });
      return Promise.resolve();
    },
    insertEvent: (event) => {
      events.push({ ...event });
      return Promise.resolve();
    },
  };
}

Deno.test('unpaid issued document is cancelled via the provider and persisted', async () => {
  const provider = makeProvider();
  const repo = makeRepo(issuedDoc());

  const result = await cancelInvoiceForBooking(
    { provider, repo, config: CONFIG, now: () => NOW },
    BOOKING_ID,
  );

  assertEquals(result.outcome, 'cancelled');
  assertEquals(result.reused, false);
  assertEquals(provider.calls, ['cancelInvoice']);
  assertEquals(repo.documents.get(BOOKING_ID)!.status, 'cancelled');
  assertEquals(repo.operations.get(`booking:${BOOKING_ID}:invoice_cancel:v1`)!.status, 'succeeded');
  assertEquals(repo.events.map((e) => e.event_type), ['invoice.cancelled']);
});

Deno.test('already-cancelled document is reused without a second provider call', async () => {
  const provider = makeProvider();
  const repo = makeRepo(issuedDoc({ status: 'cancelled' }));

  const result = await cancelInvoiceForBooking(
    { provider, repo, config: CONFIG, now: () => NOW },
    BOOKING_ID,
  );

  assertEquals(result.outcome, 'cancelled');
  assertEquals(result.reused, true);
  assertEquals(provider.calls, []);
  assertEquals(repo.events.length, 0);
});

Deno.test('paid cancellation with refund agreed records expectation and never calls cancelInvoice', async () => {
  const provider = makeProvider();
  const repo = makeRepo(issuedDoc({ status: 'paid' }));

  const result = await cancelInvoiceForBooking(
    { provider, repo, config: CONFIG, now: () => NOW },
    BOOKING_ID,
    { refundAgreed: true },
  );

  assertEquals(result.outcome, 'refund_required');
  assertEquals(provider.calls, []);
  assertEquals(repo.documents.get(BOOKING_ID)!.status, 'paid');
  assertEquals(repo.events.map((e) => e.event_type), ['refund.expected']);
  assertEquals(repo.operations.get(`booking:${BOOKING_ID}:refund:v1`)!.status, 'succeeded');
});

Deno.test('partially paid cancellation with refund agreed is the same refund handoff', async () => {
  const provider = makeProvider();
  const repo = makeRepo(issuedDoc({ status: 'partially_paid' }));

  const result = await cancelInvoiceForBooking(
    { provider, repo, config: CONFIG, now: () => NOW },
    BOOKING_ID,
    { refundAgreed: true },
  );

  assertEquals(result.outcome, 'refund_required');
  assertEquals(provider.calls, []);
  assertEquals(repo.documents.get(BOOKING_ID)!.status, 'partially_paid');
});

Deno.test('paid cancellation without refund agreement is refused and leaves state untouched', async () => {
  const provider = makeProvider();
  const repo = makeRepo(issuedDoc({ status: 'paid' }));

  await assertRejects(
    () => cancelInvoiceForBooking({ provider, repo, config: CONFIG, now: () => NOW }, BOOKING_ID),
    RefundAgreementRequiredError,
  );

  assertEquals(provider.calls, []);
  assertEquals(repo.documents.get(BOOKING_ID)!.status, 'paid');
  assertEquals(repo.events.length, 0);
  assertEquals(repo.operations.size, 0);
});

Deno.test('provider refusal surfaces a conflict without forcing the document cancelled', async () => {
  const provider = makeProvider({
    cancelFailWith: new ProviderClientError('already paid / locked year', 422),
  });
  const repo = makeRepo(issuedDoc());

  await assertRejects(
    () => cancelInvoiceForBooking({ provider, repo, config: CONFIG, now: () => NOW }, BOOKING_ID),
    InvoiceCancelConflictError,
  );

  assertEquals(provider.calls, ['cancelInvoice']);
  assertEquals(repo.documents.get(BOOKING_ID)!.status, 'issued');
  assertEquals(repo.events.map((e) => e.event_type), ['invoice.cancel_refused']);
  const op = repo.operations.get(`booking:${BOOKING_ID}:invoice_cancel:v1`);
  assertEquals(op?.status, 'failed');
});

Deno.test('provider outage enqueues invoice_cancel and does not mark the document cancelled', async () => {
  const provider = makeProvider({ cancelFailWith: new ProviderUnavailableError('bexio down') });
  const repo = makeRepo(issuedDoc());

  await assertRejects(
    () => cancelInvoiceForBooking({ provider, repo, config: CONFIG, now: () => NOW }, BOOKING_ID),
    ProviderUnavailableError,
  );

  assertEquals(repo.documents.get(BOOKING_ID)!.status, 'issued');
  const op = repo.operations.get(`booking:${BOOKING_ID}:invoice_cancel:v1`)!;
  assertEquals(op.status, 'pending');
  assertEquals(op.kind, 'invoice_cancel');
  assert(new Date(op.next_retry_at as string).getTime() > NOW.getTime());
  assert(!repo.events.some((e) => e.event_type === 'invoice.cancelled'));
});

Deno.test('missing billing document is a not-found error, not a provider call', async () => {
  const provider = makeProvider();
  const repo = makeRepo(null);

  await assertRejects(
    () => cancelInvoiceForBooking({ provider, repo, config: CONFIG, now: () => NOW }, BOOKING_ID),
    NoBillingDocumentError,
  );
  assertEquals(provider.calls, []);
});
