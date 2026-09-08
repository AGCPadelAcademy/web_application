/**
 * Unit tests for issueInvoiceForCampRegistration (T035).
 * Run with: deno test --allow-env --allow-net=none
 */

import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  issueInvoiceForCampRegistration,
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
import type { CampRegistrationRow } from './camp-mapper.ts';

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

const REG_ID = 'r0000000-0000-4000-8000-000000000001';
const PARENT_ID = 'user-1';

const REGISTRATION: CampRegistrationRow = {
  id: REG_ID,
  camp_id: 'c0000000-0000-4000-8000-000000000001',
  child_id: 'k0000000-0000-4000-8000-000000000001',
  parent_id: PARENT_ID,
  status: 'pending_payment',
  payment_status: 'pending',
  camp_name: 'Junior Camp',
  camp_start_date: '2026-10-12',
  camp_end_date: '2026-10-16',
  base_price: 349,
  total_amount: 374,
  currency: 'CHF',
};

const PROFILE = {
  id: PARENT_ID,
  full_name: 'Alex Parent',
  email: 'alex@example.com',
};

function makeInvoice(overrides: Partial<ExternalInvoice> = {}): ExternalInvoice {
  return {
    externalId: 'inv-camp-1',
    documentNr: 'RE-C-00001',
    status: 'issued',
    total: 374,
    received: 0,
    remaining: 374,
    hasQrPaymentPart: true,
    ...overrides,
  };
}

interface MockProvider extends AccountingProvider {
  calls: string[];
  invoiceByApiReference: ExternalInvoice | null;
  failWith?: Error;
}

function maybeFail<T>(provider: MockProvider, value: T): Promise<T> {
  return provider.failWith ? Promise.reject(provider.failWith) : Promise.resolve(value);
}

function makeProvider(overrides: Partial<MockProvider> = {}): MockProvider {
  const calls: string[] = [];
  const provider: MockProvider = {
    name: 'bexio',
    calls,
    invoiceByApiReference: null,
    healthCheck: () => Promise.resolve({ ok: true, checkedAt: 'now' }),
    getConfigStatus: () => Promise.resolve({ complete: true, missing: [] }),
    findContactByEmail: (_email: string) => {
      calls.push('findContactByEmail');
      return maybeFail(provider, null as ExternalContactRef | null);
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

interface MockRepo extends BillingRepo {
  documents: Map<string, Record<string, unknown>>;
  operations: Map<string, Record<string, unknown>>;
}

function makeRepo(overrides: Partial<MockRepo> = {}): MockRepo {
  const documents = new Map<string, Record<string, unknown>>();
  const contacts = new Map<string, Record<string, unknown>>();
  const operations = new Map<string, Record<string, unknown>>();
  const events: Record<string, unknown>[] = [];
  return {
    documents,
    operations,
    getBooking: () => Promise.resolve(null),
    getProfile: (userId) => Promise.resolve(userId === PARENT_ID ? { ...PROFILE } : null),
    getLesson: () => Promise.resolve(null),
    findDocumentByBooking: () => Promise.resolve(null),
    findContactByUser: (userId) => Promise.resolve((contacts.get(userId) as never) ?? null),
    upsertContact: (row) => {
      contacts.set(row.user_id, { ...row });
      return Promise.resolve();
    },
    upsertDocument: (row) => Promise.resolve(row),
    findOperation: (key) => Promise.resolve((operations.get(key) as never) ?? null),
    upsertOperation: (row) => {
      operations.set(row.idempotency_key, { ...row });
      return Promise.resolve();
    },
    insertEvent: (event) => {
      events.push({ ...event });
      return Promise.resolve();
    },
    cancelBooking: () => Promise.resolve(),
    getCampRegistration: (id) => Promise.resolve(id === REG_ID ? { ...REGISTRATION } : null),
    getCampRegistrationExtras: () => Promise.resolve([{ name: 'Lunch', price_amount: 25 }]),
    findDocumentByCampRegistration: (id) =>
      Promise.resolve((documents.get(id) as never) ?? null),
    upsertCampDocument: (row) => {
      documents.set(row.camp_registration_id, { ...row, id: row.id ?? 'doc-camp-1' });
      return Promise.resolve(documents.get(row.camp_registration_id) as never);
    },
    cancelCampRegistration: () => Promise.resolve(),
    ...overrides,
  };
}

const NOW = new Date('2026-09-08T12:00:00Z');

Deno.test('camp invoice: creates contact, issues invoice with camp api_reference', async () => {
  const provider = makeProvider();
  const repo = makeRepo();
  const result = await issueInvoiceForCampRegistration(
    { provider, repo, config: CONFIG, now: () => NOW },
    REG_ID,
  );
  assertEquals(result.reused, false);
  assertEquals(provider.calls, [
    'findContactByEmail',
    'createContact',
    'findInvoiceByApiReference',
    'createInvoice',
    'issueInvoice',
  ]);
  const doc = repo.documents.get(REG_ID)!;
  assertEquals(doc.api_reference, `agc:camp-registration:${REG_ID}`);
  assertEquals(doc.status, 'issued');
  assertEquals(repo.operations.get(`camp-registration:${REG_ID}:invoice:v1`)!.status, 'succeeded');
  assertEquals(repo.operations.get(`camp-registration:${REG_ID}:invoice:v1`)!.kind, 'camp_invoice_issue');
});

Deno.test('camp invoice: existing document short-circuits (idempotent replay)', async () => {
  const provider = makeProvider();
  const repo = makeRepo();
  repo.documents.set(REG_ID, {
    id: 'doc-camp-1',
    camp_registration_id: REG_ID,
    external_id: 'inv-camp-1',
    document_nr: 'RE-C-00001',
    status: 'issued',
    total: 374,
    api_reference: `agc:camp-registration:${REG_ID}`,
  });
  const result = await issueInvoiceForCampRegistration(
    { provider, repo, config: CONFIG, now: () => NOW },
    REG_ID,
  );
  assertEquals(result.reused, true);
  assertEquals(provider.calls, []);
});

Deno.test('camp invoice: lost-response recovery via api_reference', async () => {
  const provider = makeProvider({ invoiceByApiReference: makeInvoice() });
  const repo = makeRepo();
  const result = await issueInvoiceForCampRegistration(
    { provider, repo, config: CONFIG, now: () => NOW },
    REG_ID,
  );
  assertEquals(result.reused, false);
  assert(provider.calls.includes('findInvoiceByApiReference'));
  assert(!provider.calls.includes('createInvoice'));
  assertEquals(repo.documents.get(REG_ID)!.external_id, 'inv-camp-1');
});

Deno.test('camp invoice: provider outage enqueues camp_invoice_issue and rethrows', async () => {
  const provider = makeProvider({ failWith: new ProviderUnavailableError('bexio down') });
  const repo = makeRepo();
  await assertRejects(
    () => issueInvoiceForCampRegistration({ provider, repo, config: CONFIG, now: () => NOW }, REG_ID),
    ProviderUnavailableError,
  );
  const op = repo.operations.get(`camp-registration:${REG_ID}:invoice:v1`)!;
  assertEquals(op.status, 'pending');
  assertEquals(op.kind, 'camp_invoice_issue');
  assertEquals(repo.documents.has(REG_ID), false);
});
