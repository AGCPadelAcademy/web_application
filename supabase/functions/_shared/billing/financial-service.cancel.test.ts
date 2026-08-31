/**
 * Unit tests for unpaid lesson cancel (US5 / T039).
 * Run with: deno test --allow-env --allow-net=none
 */

import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  cancelInvoiceForBooking,
  InvoiceCancelConflictError,
  type BillingDocumentRow,
  type BillingRepo,
} from './financial-service.ts';
import {
  ProviderClientError,
  ProviderUnavailableError,
  type AccountingProvider,
  type ContactInput,
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

function issuedDoc(): BillingDocumentRow {
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
  };
}

interface MockProvider extends AccountingProvider {
  calls: string[];
  failWith?: Error;
}

function makeProvider(overrides: Partial<MockProvider> = {}): MockProvider {
  const calls: string[] = [];
  const provider: MockProvider = {
    name: 'bexio',
    calls,
    healthCheck: () => Promise.resolve({ ok: true, checkedAt: 'now' }),
    getConfigStatus: () => Promise.resolve({ complete: true, missing: [] }),
    findContactByEmail: () => Promise.resolve(null),
    createContact: (_input: ContactInput) => Promise.resolve({ externalId: 'c1' }),
    updateContact: () => Promise.resolve(),
    findInvoiceByApiReference: () => Promise.resolve(null),
    createInvoice: (_input: InvoiceInput) => Promise.resolve({
      externalId: 'inv-100',
      documentNr: 'RE-00001',
      status: 'issued',
      total: 120,
      received: 0,
      remaining: 120,
      hasQrPaymentPart: true,
    } satisfies ExternalInvoice),
    issueInvoice: () => Promise.resolve({
      externalId: 'inv-100',
      documentNr: 'RE-00001',
      status: 'issued',
      total: 120,
      received: 0,
      remaining: 120,
      hasQrPaymentPart: true,
    }),
    getInvoice: () => Promise.resolve({
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
      return provider.failWith ? Promise.reject(provider.failWith) : Promise.resolve();
    },
    ...overrides,
  };
  return provider;
}

interface MockRepo extends BillingRepo {
  documents: Map<string, BillingDocumentRow>;
  operations: Map<string, Record<string, unknown>>;
  events: Record<string, unknown>[];
  cancelledBookings: string[];
}

function makeRepo(overrides: Partial<MockRepo> = {}): MockRepo {
  const documents = new Map<string, BillingDocumentRow>();
  const operations = new Map<string, Record<string, unknown>>();
  const events: Record<string, unknown>[] = [];
  const cancelledBookings: string[] = [];
  return {
    documents,
    operations,
    events,
    cancelledBookings,
    getBooking: () => Promise.resolve(null),
    getProfile: () => Promise.resolve(null),
    getLesson: () => Promise.resolve(null),
    findDocumentByBooking: (bookingId) => Promise.resolve(documents.get(bookingId) ?? null),
    findContactByUser: () => Promise.resolve(null),
    upsertContact: () => Promise.resolve(),
    upsertDocument: (row) => {
      const saved = { ...issuedDoc(), ...row, id: row.id ?? 'doc-1' };
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
    cancelBooking: (id) => {
      cancelledBookings.push(id);
      return Promise.resolve();
    },
    ...overrides,
  };
}

Deno.test('unpaid issued invoice is cancelled in Bexio and AGC', async () => {
  const provider = makeProvider();
  const repo = makeRepo();
  repo.documents.set(BOOKING_ID, issuedDoc());

  const result = await cancelInvoiceForBooking(
    { provider, repo, config: CONFIG, now: () => NOW },
    BOOKING_ID,
  );

  assertEquals(result.reused, false);
  assertEquals(result.outcome, 'cancelled');
  assertEquals(provider.calls, ['cancelInvoice']);
  assertEquals(repo.documents.get(BOOKING_ID)!.status, 'cancelled');
  assertEquals(repo.cancelledBookings, [BOOKING_ID]);
  assertEquals(repo.operations.get(`booking:${BOOKING_ID}:invoice_cancel:v1`)!.status, 'succeeded');
  assertEquals(repo.events.map((e) => e.event_type), ['invoice.cancelled']);
});

Deno.test('paid invoice is refused and AGC state is unchanged', async () => {
  const provider = makeProvider();
  const repo = makeRepo();
  repo.documents.set(BOOKING_ID, { ...issuedDoc(), status: 'paid' });

  await assertRejects(
    () => cancelInvoiceForBooking({ provider, repo, config: CONFIG, now: () => NOW }, BOOKING_ID),
    InvoiceCancelConflictError,
  );
  assertEquals(provider.calls, []);
  assertEquals(repo.cancelledBookings, []);
  assertEquals(repo.documents.get(BOOKING_ID)!.status, 'paid');
});

Deno.test('provider refusal does not force the invoice cancelled', async () => {
  const provider = makeProvider({ failWith: new ProviderClientError('already paid', 422) });
  const repo = makeRepo();
  repo.documents.set(BOOKING_ID, issuedDoc());

  const err = await assertRejects(
    () => cancelInvoiceForBooking({ provider, repo, config: CONFIG, now: () => NOW }, BOOKING_ID),
    InvoiceCancelConflictError,
  );
  assertEquals((err as InvoiceCancelConflictError).code, 'cancel_refused');
  assertEquals(repo.documents.get(BOOKING_ID)!.status, 'issued');
  assertEquals(repo.cancelledBookings, []);
  assert(repo.events.some((e) => e.event_type === 'invoice.cancel_refused'));
});

Deno.test('Bexio outage still cancels the AGC booking and queues invoice_cancel', async () => {
  const provider = makeProvider({ failWith: new ProviderUnavailableError('down') });
  const repo = makeRepo();
  repo.documents.set(BOOKING_ID, issuedDoc());

  await assertRejects(
    () => cancelInvoiceForBooking({ provider, repo, config: CONFIG, now: () => NOW }, BOOKING_ID),
    ProviderUnavailableError,
  );

  assertEquals(repo.cancelledBookings, [BOOKING_ID]);
  const op = repo.operations.get(`booking:${BOOKING_ID}:invoice_cancel:v1`)!;
  assertEquals(op.status, 'pending');
  assertEquals(op.kind, 'invoice_cancel');
  assertEquals(repo.documents.get(BOOKING_ID)!.status, 'issued');
});

Deno.test('booking without a Bexio document still cancels in AGC', async () => {
  const provider = makeProvider();
  const repo = makeRepo();

  const result = await cancelInvoiceForBooking(
    { provider, repo, config: CONFIG, now: () => NOW },
    BOOKING_ID,
  );

  assertEquals(result.document, null);
  assertEquals(provider.calls, []);
  assertEquals(repo.cancelledBookings, [BOOKING_ID]);
});
