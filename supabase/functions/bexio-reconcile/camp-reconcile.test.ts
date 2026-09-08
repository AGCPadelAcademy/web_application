/**
 * Camp reconciliation tests (T045). Run with: deno test --allow-env --allow-net=none
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  runReconciliation,
  type ReconcileEventRow,
  type ReconcileRepo,
} from '../_shared/billing/reconciliation-service.ts';
import {
  type BillingDocumentRow,
  type BillingOperationRow,
  type BillingRepo,
} from '../_shared/billing/financial-service.ts';
import {
  type AccountingProvider,
  type ExternalInvoice,
} from '../_shared/billing/accounting-provider.ts';

const NOW = new Date('2026-09-08T12:00:00.000Z');
const REG_ID = 'r0000000-0000-4000-8000-000000000001';
const DOC_ID = 'd0000000-0000-4000-8000-000000000099';

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

interface CampReg {
  id: string;
  payment_status: string;
  status: string;
  payment_confirmation_source: string | null;
  payment_confirmed_at: string | null;
}

interface Memory {
  documents: BillingDocumentRow[];
  camps: CampReg[];
  events: ReconcileEventRow[];
  operations: BillingOperationRow[];
  integration: Record<string, unknown>;
}

function makeInvoice(overrides: Partial<ExternalInvoice> = {}): ExternalInvoice {
  return {
    externalId: 'inv-camp',
    documentNr: 'RE-C-1',
    status: 'issued',
    total: 349,
    received: 0,
    remaining: 349,
    hasQrPaymentPart: true,
    ...overrides,
  };
}

function makeDoc(overrides: Partial<BillingDocumentRow> = {}): BillingDocumentRow {
  return {
    id: DOC_ID,
    booking_id: null,
    camp_registration_id: REG_ID,
    provider: 'bexio',
    external_id: 'inv-camp',
    document_nr: 'RE-C-1',
    api_reference: `agc:camp-registration:${REG_ID}`,
    status: 'issued',
    total: 349,
    currency: 'CHF',
    ...overrides,
  };
}

function memoryRepo(mem: Memory): ReconcileRepo {
  return {
    listOpenDocuments: async () => mem.documents.filter((d) => d.status === 'issued' || d.status === 'partially_paid'),
    getDocument: async (id) => mem.documents.find((d) => d.id === id) ?? null,
    updateDocument: async (id, patch) => {
      const doc = mem.documents.find((d) => d.id === id);
      if (doc) Object.assign(doc, patch);
    },
    getBooking: async () => null,
    confirmBookingIfPending: async () => false,
    confirmCampRegistrationIfPending: async (id, now) => {
      const row = mem.camps.find((c) => c.id === id);
      if (!row || row.payment_status === 'confirmed') return false;
      row.status = 'confirmed';
      row.payment_status = 'confirmed';
      row.payment_confirmation_source = 'bexio_reconciliation';
      row.payment_confirmed_at = now.toISOString();
      return true;
    },
    hasEvent: async () => false,
    hasCampEvent: async (eventType, campRegistrationId, kind) =>
      mem.events.some((e) =>
        e.event_type === eventType &&
        e.camp_registration_id === campRegistrationId &&
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
    cancelBooking: async () => {},
    getCampRegistration: async () => null,
    getCampRegistrationExtras: async () => [],
    findDocumentByCampRegistration: async () => null,
    upsertCampDocument: async (row) => row,
    cancelCampRegistration: async () => {},
  };
}

function makeProvider(invoice: ExternalInvoice): AccountingProvider {
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
    getInvoice: async () => invoice,
    getInvoicePdf: async () => ({ bytes: new Uint8Array(), fileName: 'x.pdf' }),
    sendInvoiceEmail: async () => {},
    cancelInvoice: async () => {},
  };
}

Deno.test('paid camp document confirms registration once and calls onCampConfirmed once', async () => {
  const mem: Memory = {
    documents: [makeDoc()],
    camps: [{
      id: REG_ID,
      status: 'pending_payment',
      payment_status: 'pending',
      payment_confirmation_source: null,
      payment_confirmed_at: null,
    }],
    events: [],
    operations: [],
    integration: { status: 'connected' },
  };
  let confirms = 0;
  const result = await runReconciliation({
    provider: makeProvider(makeInvoice({ status: 'paid', received: 349, remaining: 0 })),
    repo: memoryRepo(mem),
    billingRepo: stubBillingRepo(),
    config: CONFIG,
    now: () => NOW,
    onCampConfirmed: async () => {
      confirms += 1;
    },
  });
  assertEquals(result.confirmed, 1);
  assertEquals(confirms, 1);
  assertEquals(mem.camps[0].payment_status, 'confirmed');
  assertEquals(mem.camps[0].payment_confirmation_source, 'bexio_reconciliation');
});

Deno.test('partial camp payment stays pending and does not confirm', async () => {
  const mem: Memory = {
    documents: [makeDoc()],
    camps: [{
      id: REG_ID,
      status: 'pending_payment',
      payment_status: 'pending',
      payment_confirmation_source: null,
      payment_confirmed_at: null,
    }],
    events: [],
    operations: [],
    integration: { status: 'connected' },
  };
  let confirms = 0;
  const result = await runReconciliation({
    provider: makeProvider(makeInvoice({ status: 'partially_paid', received: 100, remaining: 249 })),
    repo: memoryRepo(mem),
    billingRepo: stubBillingRepo(),
    config: CONFIG,
    now: () => NOW,
    onCampConfirmed: async () => {
      confirms += 1;
    },
  });
  assertEquals(result.confirmed, 0);
  assertEquals(confirms, 0);
  assertEquals(mem.camps[0].payment_status, 'pending');
  assertEquals(mem.documents[0].status, 'partially_paid');
});

Deno.test('re-run on already-confirmed camp does not call onCampConfirmed again', async () => {
  const mem: Memory = {
    documents: [makeDoc()],
    camps: [{
      id: REG_ID,
      status: 'confirmed',
      payment_status: 'confirmed',
      payment_confirmation_source: 'bexio_reconciliation',
      payment_confirmed_at: '2026-09-01T00:00:00.000Z',
    }],
    events: [],
    operations: [],
    integration: { status: 'connected' },
  };
  let confirms = 0;
  const result = await runReconciliation({
    provider: makeProvider(makeInvoice({ status: 'paid', received: 349, remaining: 0 })),
    repo: memoryRepo(mem),
    billingRepo: stubBillingRepo(),
    config: CONFIG,
    now: () => NOW,
    onCampConfirmed: async () => {
      confirms += 1;
    },
  });
  assertEquals(result.confirmed, 0);
  assertEquals(confirms, 0);
  assertEquals(mem.camps[0].payment_confirmed_at, '2026-09-01T00:00:00.000Z');
});
