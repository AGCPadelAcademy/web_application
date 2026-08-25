/**
 * Unit tests for reconciliation (T031). Run with: deno test --allow-env --allow-net=none
 * Provider and repositories are fully mocked — no network, no database.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  runReconciliation,
  type ReconcileBookingRow,
  type ReconcileEventRow,
  type ReconcileRepo,
} from '../_shared/billing/reconciliation-service.ts';
import {
  type BillingDocumentRow,
  type BillingOperationRow,
  type BillingRepo,
} from '../_shared/billing/financial-service.ts';
import {
  ProviderUnavailableError,
  type AccountingProvider,
  type ExternalInvoice,
} from '../_shared/billing/accounting-provider.ts';

const NOW = new Date('2026-08-24T12:00:00.000Z');
const BOOKING_ID = 'b0000000-0000-4000-8000-000000000001';
const DOC_ID = 'd0000000-0000-4000-8000-000000000001';

const CONFIG = {
  bexio_user_id: 1,
  currency_id: 1,
  bank_account_id: 2,
  payment_type_id: 3,
  sales_account_id: 9,
  tax_id_sales: 14,
  unit_id: 5,
  mwst_type: 0,
  mwst_is_net: false,
  payment_term_days: 30,
};

function makeInvoice(overrides: Partial<ExternalInvoice> = {}): ExternalInvoice {
  return {
    externalId: 'inv-1',
    documentNr: 'RE-00001',
    status: 'issued',
    total: 120,
    received: 0,
    remaining: 120,
    hasQrPaymentPart: true,
    ...overrides,
  };
}

function makeDoc(overrides: Partial<BillingDocumentRow> = {}): BillingDocumentRow {
  return {
    id: DOC_ID,
    booking_id: BOOKING_ID,
    provider: 'bexio',
    external_id: 'inv-1',
    document_nr: 'RE-00001',
    api_reference: `agc:booking:${BOOKING_ID}`,
    status: 'issued',
    total: 120,
    currency: 'CHF',
    ...overrides,
  };
}

interface Memory {
  documents: BillingDocumentRow[];
  bookings: ReconcileBookingRow[];
  events: ReconcileEventRow[];
  operations: BillingOperationRow[];
  integration: Record<string, unknown>;
}

function memoryRepo(mem: Memory): ReconcileRepo {
  return {
    listOpenDocuments: async () => mem.documents.filter((d) => d.status === 'issued' || d.status === 'partially_paid'),
    getDocument: async (id) => mem.documents.find((d) => d.id === id) ?? null,
    updateDocument: async (id, patch) => {
      const doc = mem.documents.find((d) => d.id === id);
      if (doc) Object.assign(doc, patch);
    },
    getBooking: async (id) => mem.bookings.find((b) => b.id === id) ?? null,
    confirmBookingIfPending: async (id, now) => {
      const booking = mem.bookings.find((b) => b.id === id);
      if (!booking || booking.payment_status === 'confirmed') return false;
      booking.payment_status = 'confirmed';
      booking.payment_confirmation_source = 'bexio_reconciliation';
      booking.payment_confirmed_at = now.toISOString();
      return true;
    },
    hasEvent: async (eventType, bookingId, kind) =>
      mem.events.some((e) =>
        e.event_type === eventType &&
        e.booking_id === bookingId &&
        (kind ? e.details?.kind === kind : true)
      ),
    insertEvent: async (event) => {
      mem.events.push({ ...event, details: event.details ?? {} });
    },
    listDueOperations: async (now) =>
      mem.operations.filter((op) => {
        if (op.status !== 'pending') return false;
        if (!op.next_retry_at) return true;
        return new Date(op.next_retry_at) <= now;
      }),
    upsertOperation: async (row) => {
      const idx = mem.operations.findIndex((o) => o.idempotency_key === row.idempotency_key);
      if (idx >= 0) mem.operations[idx] = { ...mem.operations[idx], ...row };
      else mem.operations.push(row);
    },
    updateIntegration: async (patch) => {
      Object.assign(mem.integration, patch);
    },
  };
}

function stubBillingRepo(): BillingRepo {
  return {
    getBooking: async () => null,
    getProfile: async () => null,
    getLesson: async () => null,
    findDocumentByBooking: async () => null,
    findContactByUser: async () => null,
    upsertContact: async () => {},
    upsertDocument: async (row) => row,
    findOperation: async () => null,
    upsertOperation: async () => {},
    insertEvent: async () => {},
  };
}

function makeProvider(invoice: ExternalInvoice, failWith?: Error): AccountingProvider {
  return {
    name: 'bexio',
    healthCheck: async () => ({ ok: true, checkedAt: NOW.toISOString() }),
    getConfigStatus: async () => ({ complete: true, missing: [] }),
    findContactByEmail: async () => null,
    createContact: async () => ({ externalId: 'c1' }),
    updateContact: async () => {},
    findInvoiceByApiReference: async () => invoice,
    createInvoice: async () => invoice,
    issueInvoice: async () => invoice,
    getInvoice: async () => {
      if (failWith) throw failWith;
      return invoice;
    },
    getInvoicePdf: async () => ({ bytes: new Uint8Array(), fileName: 'x.pdf' }),
    sendInvoiceEmail: async () => {},
    cancelInvoice: async () => {},
  };
}

function pendingBooking(): ReconcileBookingRow {
  return {
    id: BOOKING_ID,
    payment_status: 'pending',
    payment_confirmation_source: null,
    payment_confirmed_at: null,
  };
}

Deno.test('full payment confirms a pending booking', async () => {
  const mem: Memory = {
    documents: [makeDoc()],
    bookings: [pendingBooking()],
    events: [],
    operations: [],
    integration: { status: 'connected' },
  };
  const result = await runReconciliation({
    provider: makeProvider(makeInvoice({ status: 'paid', received: 120, remaining: 0 })),
    repo: memoryRepo(mem),
    billingRepo: stubBillingRepo(),
    config: CONFIG,
    now: () => NOW,
  });

  assertEquals(result.confirmed, 1);
  assertEquals(mem.bookings[0].payment_status, 'confirmed');
  assertEquals(mem.bookings[0].payment_confirmation_source, 'bexio_reconciliation');
  assertEquals(mem.documents[0].status, 'paid');
  assertEquals(mem.events.filter((e) => e.event_type === 'payment.reconciled').length, 1);
});

Deno.test('already-confirmed booking is not overwritten', async () => {
  const mem: Memory = {
    documents: [makeDoc()],
    bookings: [{
      id: BOOKING_ID,
      payment_status: 'confirmed',
      payment_confirmation_source: 'bexio_reconciliation',
      payment_confirmed_at: '2026-08-01T00:00:00.000Z',
    }],
    events: [],
    operations: [],
    integration: { status: 'connected' },
  };
  const result = await runReconciliation({
    provider: makeProvider(makeInvoice({ status: 'paid', received: 120, remaining: 0 })),
    repo: memoryRepo(mem),
    billingRepo: stubBillingRepo(),
    config: CONFIG,
    now: () => NOW,
  });

  assertEquals(result.confirmed, 0);
  assertEquals(mem.bookings[0].payment_confirmed_at, '2026-08-01T00:00:00.000Z');
  assertEquals(mem.documents[0].status, 'paid');
  const reconciled = mem.events.filter((e) => e.event_type === 'payment.reconciled');
  assertEquals(reconciled.length, 1);
  assertEquals(reconciled[0].details.already_confirmed, true);
});

Deno.test('re-run does not duplicate payment.reconciled events', async () => {
  const mem: Memory = {
    documents: [makeDoc({ status: 'paid' })],
    bookings: [{
      id: BOOKING_ID,
      payment_status: 'confirmed',
      payment_confirmation_source: 'bexio_reconciliation',
      payment_confirmed_at: NOW.toISOString(),
    }],
    events: [{
      event_type: 'payment.reconciled',
      booking_id: BOOKING_ID,
      details: {},
    }],
    operations: [],
    integration: { status: 'connected' },
  };
  // Already paid documents are not in the open work set.
  await runReconciliation({
    provider: makeProvider(makeInvoice({ status: 'paid', received: 120, remaining: 0 })),
    repo: memoryRepo(mem),
    billingRepo: stubBillingRepo(),
    config: CONFIG,
    now: () => NOW,
  });
  assertEquals(mem.events.filter((e) => e.event_type === 'payment.reconciled').length, 1);
});

Deno.test('partial payment does not confirm the booking', async () => {
  const mem: Memory = {
    documents: [makeDoc()],
    bookings: [pendingBooking()],
    events: [],
    operations: [],
    integration: { status: 'connected' },
  };
  const result = await runReconciliation({
    provider: makeProvider(makeInvoice({ status: 'partially_paid', received: 40, remaining: 80 })),
    repo: memoryRepo(mem),
    billingRepo: stubBillingRepo(),
    config: CONFIG,
    now: () => NOW,
  });
  assertEquals(result.confirmed, 0);
  assertEquals(mem.bookings[0].payment_status, 'pending');
  assertEquals(mem.documents[0].status, 'partially_paid');
});

Deno.test('provider failure on one document leaves other documents convergent', async () => {
  const otherId = 'b0000000-0000-4000-8000-000000000002';
  const mem: Memory = {
    documents: [
      makeDoc({ id: 'd1', booking_id: BOOKING_ID, external_id: 'inv-fail' }),
      makeDoc({ id: 'd2', booking_id: otherId, external_id: 'inv-ok', api_reference: `agc:booking:${otherId}` }),
    ],
    bookings: [
      pendingBooking(),
      { id: otherId, payment_status: 'pending', payment_confirmation_source: null, payment_confirmed_at: null },
    ],
    events: [],
    operations: [],
    integration: { status: 'connected' },
  };
  const provider = makeProvider(makeInvoice({ status: 'paid', received: 120, remaining: 0 }));
  const originalGet = provider.getInvoice.bind(provider);
  provider.getInvoice = async (ref) => {
    if (ref.externalId === 'inv-fail') throw new ProviderUnavailableError('429');
    return originalGet(ref);
  };
  await runReconciliation({
    provider,
    repo: memoryRepo(mem),
    billingRepo: stubBillingRepo(),
    config: CONFIG,
    now: () => NOW,
  });
  assertEquals(mem.documents[0].status, 'issued');
  assertEquals(mem.documents[1].status, 'paid');
  assertEquals(mem.bookings[1].payment_status, 'confirmed');
});

Deno.test('retry exhaustion marks the operation failed and emits an event', async () => {
  const mem: Memory = {
    documents: [],
    bookings: [],
    events: [],
    operations: [{
      kind: 'invoice_issue',
      idempotency_key: `booking:${BOOKING_ID}:invoice:v1`,
      booking_id: BOOKING_ID,
      status: 'pending',
      attempts: 7,
      max_attempts: 8,
      next_retry_at: '2026-08-24T11:00:00.000Z',
      last_error: 'ProviderUnavailableError',
    }],
    integration: { status: 'connected' },
  };
  const provider = makeProvider(makeInvoice());
  provider.findInvoiceByApiReference = async () => {
    throw new ProviderUnavailableError('still down');
  };
  const billingRepo: BillingRepo = {
    ...stubBillingRepo(),
    getBooking: async () => ({
      id: BOOKING_ID,
      user_id: 'user-1',
      lesson_code: 'PRIV60',
      lesson_name: 'Private',
      booking_date: '2026-09-01',
      price: '120',
      status: 'pending_payment',
      payment_status: 'pending',
    }),
    getProfile: async () => ({ id: 'user-1', full_name: 'Ada', email: 'a@b.com' }),
    getLesson: async () => ({ lesson_code: 'PRIV60', name: 'Private', price_amount: 120 }),
    findDocumentByBooking: async () => null,
    findOperation: async () => mem.operations[0],
    upsertOperation: async (row) => {
      mem.operations[0] = { ...mem.operations[0], ...row };
    },
  };

  const result = await runReconciliation({
    provider,
    repo: memoryRepo(mem),
    billingRepo,
    config: CONFIG,
    now: () => NOW,
  });
  assertEquals(mem.operations[0].status, 'failed');
  assertEquals(result.failed_operations, 1);
  assertEquals(mem.events.some((e) => e.event_type === 'operation.retry_exhausted'), true);
});

Deno.test('due invoice_cancel operations are retried via cancelInvoiceForBooking', async () => {
  const mem: Memory = {
    documents: [makeDoc()],
    bookings: [pendingBooking()],
    events: [],
    operations: [{
      kind: 'invoice_cancel',
      idempotency_key: `booking:${BOOKING_ID}:invoice_cancel:v1`,
      booking_id: BOOKING_ID,
      billing_document_id: DOC_ID,
      status: 'pending',
      attempts: 1,
      max_attempts: 8,
      next_retry_at: '2026-08-24T11:00:00.000Z',
      last_error: 'ProviderUnavailableError',
    }],
    integration: { status: 'connected' },
  };
  const provider = makeProvider(makeInvoice());
  let cancelled = false;
  provider.cancelInvoice = async () => {
    cancelled = true;
  };
  const billingRepo: BillingRepo = {
    ...stubBillingRepo(),
    findDocumentByBooking: async () => mem.documents[0],
    upsertDocument: async (row) => {
      mem.documents[0] = { ...mem.documents[0], ...row };
      return mem.documents[0];
    },
    findOperation: async (key) => mem.operations.find((o) => o.idempotency_key === key) ?? null,
    upsertOperation: async (row) => {
      const idx = mem.operations.findIndex((o) => o.idempotency_key === row.idempotency_key);
      if (idx >= 0) mem.operations[idx] = { ...mem.operations[idx], ...row };
      else mem.operations.push(row);
    },
    insertEvent: async (event) => {
      mem.events.push({ event_type: event.event_type, booking_id: event.booking_id, details: event.details ?? {} });
    },
  };

  const result = await runReconciliation({
    provider,
    repo: memoryRepo(mem),
    billingRepo,
    config: CONFIG,
    now: () => NOW,
  });
  assertEquals(cancelled, true);
  assertEquals(mem.documents[0].status, 'cancelled');
  assertEquals(mem.operations[0].status, 'succeeded');
  assertEquals(result.retried >= 1, true);
});
