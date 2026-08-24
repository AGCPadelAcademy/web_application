/**
 * Unit tests for financial-service (T019). Run with: deno test --allow-env --allow-net=none
 * Provider and repository are fully mocked — no network, no database.
 */

import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  BookingNotBillableError,
  issueInvoiceForBooking,
  type BillingRepo,
} from './financial-service.ts';
import {
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

const BOOKING = {
  id: 'b0000000-0000-4000-8000-000000000001',
  user_id: 'user-1',
  lesson_code: 'PRIV60',
  lesson_name: 'Private Lesson 60min',
  booking_date: '2026-09-01',
  price: '120 CHF',
  status: 'pending_payment',
  payment_status: 'pending',
};

const PROFILE = {
  id: 'user-1',
  full_name: 'Josep Barbera',
  email: 'josep@example.com',
  address: 'Bahnhofstrasse 1',
  postal_code: '8001',
  city: 'Zürich',
  country: 'Switzerland',
};

const LESSON = { lesson_code: 'PRIV60', name: 'Private Lesson 60min', price_amount: 120 };

function makeInvoice(overrides: Partial<ExternalInvoice> = {}): ExternalInvoice {
  return {
    externalId: 'inv-100',
    documentNr: 'RE-00001',
    status: 'issued',
    total: 120,
    received: 0,
    remaining: 120,
    hasQrPaymentPart: true,
    ...overrides,
  };
}

interface MockProvider extends AccountingProvider {
  calls: string[];
  invoiceByApiReference: ExternalInvoice | null;
  contactByEmail: ExternalContactRef | null;
  failWith?: Error;
}

function makeProvider(overrides: Partial<MockProvider> = {}): MockProvider {
  const calls: string[] = [];
  const provider: MockProvider = {
    name: 'bexio',
    calls,
    invoiceByApiReference: null,
    contactByEmail: null,
    failWith: undefined,
    healthCheck: () => Promise.resolve({ ok: true, checkedAt: 'now' }),
    getConfigStatus: () => Promise.resolve({ complete: true, missing: [] }),
    findContactByEmail: (_email: string) => {
      calls.push('findContactByEmail');
      return maybeFail(provider, provider.contactByEmail);
    },
    createContact: (_input: ContactInput) => {
      calls.push('createContact');
      return maybeFail(provider, { externalId: 'contact-1' });
    },
    updateContact: () => {
      calls.push('updateContact');
      return Promise.resolve();
    },
    findInvoiceByApiReference: (_ref: string) => {
      calls.push('findInvoiceByApiReference');
      return maybeFail(provider, provider.invoiceByApiReference);
    },
    createInvoice: (_input: InvoiceInput) => {
      calls.push('createInvoice');
      return maybeFail(provider, makeInvoice({ status: 'draft', documentNr: null }));
    },
    issueInvoice: () => {
      calls.push('issueInvoice');
      return maybeFail(provider, makeInvoice());
    },
    getInvoice: () => maybeFail(provider, makeInvoice()),
    getInvoicePdf: () => Promise.resolve({ bytes: new Uint8Array(), fileName: 'x.pdf' }),
    sendInvoiceEmail: () => Promise.resolve(),
    cancelInvoice: () => Promise.resolve(),
    ...overrides,
  };
  return provider;
}

function maybeFail<T>(provider: MockProvider, value: T): Promise<T> {
  return provider.failWith ? Promise.reject(provider.failWith) : Promise.resolve(value);
}

interface MockRepo extends BillingRepo {
  documents: Map<string, Record<string, unknown>>;
  contacts: Map<string, Record<string, unknown>>;
  operations: Map<string, Record<string, unknown>>;
  events: Record<string, unknown>[];
}

function makeRepo(overrides: Partial<MockRepo> = {}): MockRepo {
  const documents = new Map<string, Record<string, unknown>>();
  const contacts = new Map<string, Record<string, unknown>>();
  const operations = new Map<string, Record<string, unknown>>();
  const events: Record<string, unknown>[] = [];
  return {
    documents,
    contacts,
    operations,
    events,
    getBooking: (id) => Promise.resolve(id === BOOKING.id ? { ...BOOKING } : null),
    getProfile: (userId) => Promise.resolve(userId === PROFILE.id ? { ...PROFILE } : null),
    getLesson: (code) => Promise.resolve(code === LESSON.lesson_code ? { ...LESSON } : null),
    findDocumentByBooking: (bookingId) =>
      Promise.resolve((documents.get(bookingId) as never) ?? null),
    findContactByUser: (userId) => Promise.resolve((contacts.get(userId) as never) ?? null),
    upsertContact: (row) => {
      contacts.set(row.user_id as string, { ...row });
      return Promise.resolve();
    },
    upsertDocument: (row) => {
      documents.set(row.booking_id as string, { ...row, id: row.id ?? 'doc-1' });
      return Promise.resolve(documents.get(row.booking_id as string) as never);
    },
    findOperation: (key) => Promise.resolve((operations.get(key) as never) ?? null),
    upsertOperation: (row) => {
      operations.set(row.idempotency_key as string, { ...row });
      return Promise.resolve();
    },
    insertEvent: (event) => {
      events.push({ ...event });
      return Promise.resolve();
    },
    ...overrides,
  };
}

const NOW = new Date('2026-08-21T12:00:00Z');

Deno.test('happy path: creates contact, creates+issues invoice, persists document (FR-010/013/017)', async () => {
  const provider = makeProvider();
  const repo = makeRepo();

  const result = await issueInvoiceForBooking(
    { provider, repo, config: CONFIG, now: () => NOW },
    BOOKING.id,
  );

  assertEquals(result.reused, false);
  assertEquals(provider.calls, [
    'findContactByEmail',
    'createContact',
    'findInvoiceByApiReference',
    'createInvoice',
    'issueInvoice',
  ]);
  const doc = repo.documents.get(BOOKING.id)!;
  assertEquals(doc.external_id, 'inv-100');
  assertEquals(doc.document_nr, 'RE-00001');
  assertEquals(doc.status, 'issued');
  assertEquals(doc.total, 120);
  assertEquals(doc.api_reference, `agc:booking:${BOOKING.id}`);
  assertEquals(repo.contacts.get(PROFILE.id)!.external_id, 'contact-1');
  assertEquals(repo.operations.get(`booking:${BOOKING.id}:invoice:v1`)!.status, 'succeeded');
  assertEquals(repo.events.map((e) => e.event_type), ['contact.linked', 'invoice.issued']);
});

Deno.test('idempotency: existing billing_documents row short-circuits (FR-015)', async () => {
  const provider = makeProvider();
  const repo = makeRepo();
  repo.documents.set(BOOKING.id, {
    id: 'doc-1',
    booking_id: BOOKING.id,
    external_id: 'inv-100',
    document_nr: 'RE-00001',
    status: 'issued',
    total: 120,
    api_reference: `agc:booking:${BOOKING.id}`,
  });

  const result = await issueInvoiceForBooking(
    { provider, repo, config: CONFIG, now: () => NOW },
    BOOKING.id,
  );

  assertEquals(result.reused, true);
  assertEquals(provider.calls, []);
});

Deno.test('idempotency: succeeded operation short-circuits even without document row', async () => {
  const provider = makeProvider();
  const repo = makeRepo();
  repo.operations.set(`booking:${BOOKING.id}:invoice:v1`, { status: 'succeeded' });
  repo.documents.set(BOOKING.id, {
    id: 'doc-1',
    booking_id: BOOKING.id,
    external_id: 'inv-100',
    document_nr: 'RE-00001',
    status: 'issued',
    total: 120,
    api_reference: `agc:booking:${BOOKING.id}`,
  });

  const result = await issueInvoiceForBooking(
    { provider, repo, config: CONFIG, now: () => NOW },
    BOOKING.id,
  );

  assertEquals(result.reused, true);
  assertEquals(provider.calls, []);
});

Deno.test('lost-response recovery: invoice found by api_reference is adopted, never re-created (R-05)', async () => {
  const provider = makeProvider({ invoiceByApiReference: makeInvoice() });
  const repo = makeRepo();

  const result = await issueInvoiceForBooking(
    { provider, repo, config: CONFIG, now: () => NOW },
    BOOKING.id,
  );

  assertEquals(result.reused, false);
  assert(provider.calls.includes('findInvoiceByApiReference'));
  assert(!provider.calls.includes('createInvoice'));
  assert(!provider.calls.includes('issueInvoice'));
  assertEquals(repo.documents.get(BOOKING.id)!.external_id, 'inv-100');
});

Deno.test('returning customer reuses the stored contact mapping (no duplicate contact)', async () => {
  const provider = makeProvider();
  const repo = makeRepo();
  repo.contacts.set(PROFILE.id, {
    user_id: PROFILE.id,
    provider: 'bexio',
    external_id: 'contact-9',
    email_snapshot: PROFILE.email,
  });

  await issueInvoiceForBooking({ provider, repo, config: CONFIG, now: () => NOW }, BOOKING.id);

  assert(!provider.calls.includes('findContactByEmail'));
  assert(!provider.calls.includes('createContact'));
  assert(provider.calls.includes('updateContact'));
  assert(!repo.events.some((e) => e.event_type === 'contact.linked'));
});

Deno.test('provider outage enqueues a pending billing_operations row with backoff and rethrows (FR-030)', async () => {
  const provider = makeProvider({ failWith: new ProviderUnavailableError('bexio down') });
  const repo = makeRepo();

  await assertRejects(
    () => issueInvoiceForBooking({ provider, repo, config: CONFIG, now: () => NOW }, BOOKING.id),
    ProviderUnavailableError,
  );

  const op = repo.operations.get(`booking:${BOOKING.id}:invoice:v1`)!;
  assertEquals(op.status, 'pending');
  assertEquals(op.kind, 'invoice_issue');
  assertEquals(op.attempts, 1);
  assert(new Date(op.next_retry_at as string).getTime() > NOW.getTime());
  assertEquals(repo.documents.has(BOOKING.id), false);
});

Deno.test('cancelled booking is not billable (409 mapping, no provider calls)', async () => {
  const provider = makeProvider();
  const repo = makeRepo({
    getBooking: () => Promise.resolve({ ...BOOKING, status: 'cancelled' }),
  });

  await assertRejects(
    () => issueInvoiceForBooking({ provider, repo, config: CONFIG, now: () => NOW }, BOOKING.id),
    BookingNotBillableError,
  );
  assertEquals(provider.calls, []);
});
