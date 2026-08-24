/**
 * Reconciliation orchestration (US4 / T033–T035).
 * Contract: contracts/edge-functions.md §4; rules R-07 / R-08.
 *
 * The HTTP function (bexio-reconcile) is a thin auth + wiring layer; this
 * module is what the unit tests exercise with a mocked provider + in-memory repo.
 */

import {
  ProviderAuthError,
  ProviderUnavailableError,
  type AccountingProvider,
} from './accounting-provider.ts';
import {
  BookingNotBillableError,
  issueInvoiceForBooking,
  nextRetryAt,
  type BillingDocumentRow,
  type BillingOperationRow,
  type BillingRepo,
} from './financial-service.ts';
import { isOverpaid } from './bexio/bexio-adapter.ts';
import type { BexioConfig } from './bexio/bexio-mappers.ts';

export interface ReconcileBookingRow {
  id: string;
  payment_status: string;
  payment_confirmation_source: string | null;
  payment_confirmed_at: string | null;
}

export interface ReconcileEventRow {
  event_type: string;
  booking_id?: string | null;
  billing_document_id?: string | null;
  details: Record<string, unknown>;
}

export interface ReconcileRepo {
  listOpenDocuments(): Promise<BillingDocumentRow[]>;
  getDocument(id: string): Promise<BillingDocumentRow | null>;
  updateDocument(id: string, patch: Partial<BillingDocumentRow> & { last_synced_at?: string }): Promise<void>;
  getBooking(bookingId: string): Promise<ReconcileBookingRow | null>;
  /** Guarded R-08 write. Returns true when the row actually changed. */
  confirmBookingIfPending(bookingId: string, now: Date): Promise<boolean>;
  hasEvent(eventType: string, bookingId: string, kind?: string): Promise<boolean>;
  insertEvent(event: ReconcileEventRow): Promise<void>;
  listDueOperations(now: Date): Promise<BillingOperationRow[]>;
  upsertOperation(row: BillingOperationRow): Promise<void>;
  updateIntegration(patch: Record<string, unknown>): Promise<void>;
}

export interface ReconcileDeps {
  provider: AccountingProvider;
  repo: ReconcileRepo;
  billingRepo: BillingRepo;
  config: BexioConfig;
  now?: () => Date;
}

export interface ReconcileResult {
  checked: number;
  confirmed: number;
  retried: number;
  failed_operations: number;
  discrepancies: number;
  requires_reauth?: boolean;
}

function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ component: 'bexio-reconcile', ...event }));
}

async function emitOnce(
  repo: ReconcileRepo,
  event: ReconcileEventRow & { booking_id: string },
  kind?: string,
): Promise<boolean> {
  if (await repo.hasEvent(event.event_type, event.booking_id, kind)) return false;
  await repo.insertEvent(event);
  return true;
}

async function reconcileDocument(
  deps: ReconcileDeps,
  doc: BillingDocumentRow,
  now: Date,
  counts: ReconcileResult,
): Promise<void> {
  const invoice = await deps.provider.getInvoice({ externalId: doc.external_id });
  const previousStatus = doc.status;
  const nextStatus = invoice.status === 'unknown' ? previousStatus : invoice.status;
  const syncedPatch = {
    status: nextStatus,
    total: invoice.total,
    last_synced_at: now.toISOString(),
  };

  if (invoice.status === 'paid') {
    await deps.repo.updateDocument(doc.id!, syncedPatch);
    const didConfirm = await deps.repo.confirmBookingIfPending(doc.booking_id, now);
    if (didConfirm) counts.confirmed += 1;
    if (previousStatus !== 'paid') {
      await emitOnce(deps.repo, {
        event_type: 'payment.reconciled',
        booking_id: doc.booking_id,
        billing_document_id: doc.id ?? null,
        details: {
          document_nr: invoice.documentNr,
          already_confirmed: !didConfirm,
          received: invoice.received,
          remaining: invoice.remaining,
        },
      });
    }
    if (isOverpaid(invoice.received, invoice.total)) {
      if (await emitOnce(deps.repo, {
        event_type: 'reconciliation.discrepancy',
        booking_id: doc.booking_id,
        billing_document_id: doc.id ?? null,
        details: { kind: 'overpayment', received: invoice.received, total: invoice.total },
      }, 'overpayment')) {
        counts.discrepancies += 1;
      }
    }
    return;
  }

  if (invoice.status === 'partially_paid') {
    await deps.repo.updateDocument(doc.id!, syncedPatch);
    return;
  }

  if (invoice.status === 'cancelled') {
    await deps.repo.updateDocument(doc.id!, syncedPatch);
    const kind = invoice.received > 0 ? 'payment_on_cancelled' : 'invoice_cancelled';
    if (await emitOnce(deps.repo, {
      event_type: 'reconciliation.discrepancy',
      booking_id: doc.booking_id,
      billing_document_id: doc.id ?? null,
      details: { kind, received: invoice.received },
    }, kind)) {
      counts.discrepancies += 1;
    }
    return;
  }

  await deps.repo.updateDocument(doc.id!, { last_synced_at: now.toISOString() });
}

async function processRetries(deps: ReconcileDeps, now: Date, counts: ReconcileResult): Promise<void> {
  const due = await deps.repo.listDueOperations(now);
  for (const op of due) {
    if (op.kind === 'invoice_cancel') continue; // US5
    try {
      if (op.kind === 'invoice_issue' && op.booking_id) {
        await issueInvoiceForBooking({
          provider: deps.provider,
          repo: deps.billingRepo,
          config: deps.config,
          now: () => now,
        }, op.booking_id);
        await deps.repo.upsertOperation({
          ...op,
          status: 'succeeded',
          attempts: op.attempts + 1,
          next_retry_at: null,
          last_error: null,
        });
        counts.retried += 1;
        continue;
      }
      await deps.repo.upsertOperation({
        ...op,
        status: 'failed',
        attempts: op.attempts + 1,
        last_error: `unsupported_kind:${op.kind}`,
      });
      counts.failed_operations += 1;
    } catch (err) {
      if (err instanceof ProviderAuthError) throw err;
      if (err instanceof BookingNotBillableError) {
        await deps.repo.upsertOperation({
          ...op,
          status: 'failed',
          attempts: op.attempts + 1,
          last_error: err.name,
        });
        counts.failed_operations += 1;
        continue;
      }
      const attempts = op.attempts + 1;
      const exhausted = attempts >= (op.max_attempts ?? 8);
      await deps.repo.upsertOperation({
        ...op,
        status: exhausted ? 'failed' : 'pending',
        attempts,
        next_retry_at: exhausted ? null : nextRetryAt(attempts, now),
        last_error: (err as Error).name,
      });
      if (exhausted) {
        counts.failed_operations += 1;
        await deps.repo.insertEvent({
          event_type: 'operation.retry_exhausted',
          booking_id: op.booking_id ?? null,
          billing_document_id: op.billing_document_id ?? null,
          details: { kind: op.kind, attempts },
        });
      } else {
        counts.retried += 1;
      }
      if (!(err instanceof ProviderUnavailableError)) {
        log({ event: 'retry_unexpected', kind: op.kind, error: (err as Error).name });
      }
    }
  }
}

export async function runReconciliation(deps: ReconcileDeps): Promise<ReconcileResult> {
  const now = deps.now?.() ?? new Date();
  const counts: ReconcileResult = {
    checked: 0,
    confirmed: 0,
    retried: 0,
    failed_operations: 0,
    discrepancies: 0,
  };

  try {
    const open = await deps.repo.listOpenDocuments();
    for (const doc of open) {
      counts.checked += 1;
      try {
        await reconcileDocument(deps, doc, now, counts);
      } catch (err) {
        if (err instanceof ProviderAuthError) throw err;
        log({
          event: 'document_sync_failed',
          bookingId: doc.booking_id,
          error: (err as Error).name,
        });
      }
    }

    await processRetries(deps, now, counts);

    await deps.repo.updateIntegration({
      last_successful_call_at: now.toISOString(),
      last_error: null,
      status: 'connected',
    });
    await deps.repo.insertEvent({
      event_type: 'reconciliation.run',
      details: { ...counts },
    });
    return counts;
  } catch (err) {
    if (err instanceof ProviderAuthError) {
      await deps.repo.updateIntegration({
        status: 'requires_reauth',
        last_error: 'token refresh rejected',
      });
      await deps.repo.insertEvent({
        event_type: 'integration.token_refresh_failed',
        details: { reason: 'invalid_grant' },
      });
      return { ...counts, requires_reauth: true };
    }
    throw err;
  }
}

// --- PostgREST repository ---------------------------------------------------

export function createPostgrestReconcileRepo(
  supabaseUrl: string,
  serviceRoleKey: string,
): ReconcileRepo {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  async function select<T>(table: string, query: string): Promise<T[]> {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers });
    if (!res.ok) throw new Error(`db select ${table} failed: ${res.status}`);
    return (await res.json()) as T[];
  }

  async function patch(table: string, query: string, body: unknown, prefer = 'return=minimal'): Promise<unknown> {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: prefer },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`db patch ${table} failed: ${res.status}`);
    if (prefer.includes('representation')) return await res.json();
    return null;
  }

  return {
    listOpenDocuments: () =>
      select<BillingDocumentRow>(
        'billing_documents',
        'status=in.(issued,partially_paid)&select=id,booking_id,provider,external_id,document_nr,api_reference,status,total,currency',
      ),
    getDocument: async (id) => {
      const rows = await select<BillingDocumentRow>(
        'billing_documents',
        `id=eq.${id}&select=id,booking_id,provider,external_id,document_nr,api_reference,status,total,currency`,
      );
      return rows[0] ?? null;
    },
    updateDocument: async (id, row) => {
      await patch('billing_documents', `id=eq.${id}`, { ...row, updated_at: new Date().toISOString() });
    },
    getBooking: async (bookingId) => {
      const rows = await select<ReconcileBookingRow>(
        'bookings',
        `id=eq.${bookingId}&select=id,payment_status,payment_confirmation_source,payment_confirmed_at`,
      );
      return rows[0] ?? null;
    },
    confirmBookingIfPending: async (bookingId, now) => {
      const updated = await patch(
        'bookings',
        `id=eq.${bookingId}&payment_status=neq.confirmed`,
        {
          status: 'confirmed',
          payment_status: 'confirmed',
          verification_status: 'approved',
          payment_confirmation_source: 'bexio_reconciliation',
          payment_confirmed_at: now.toISOString(),
        },
        'return=representation',
      ) as unknown[];
      return Array.isArray(updated) && updated.length > 0;
    },
    hasEvent: async (eventType, bookingId, kind) => {
      const rows = await select<{ id: number; details: Record<string, unknown> }>(
        'billing_events',
        `event_type=eq.${encodeURIComponent(eventType)}&booking_id=eq.${bookingId}&select=id,details`,
      );
      if (!kind) return rows.length > 0;
      return rows.some((r) => r.details?.kind === kind);
    },
    insertEvent: async (event) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/billing_events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...event, details: event.details ?? {} }),
      });
      if (!res.ok) log({ event: 'event_insert_failed', status: res.status });
    },
    listDueOperations: (now) =>
      select<BillingOperationRow>(
        'billing_operations',
        `status=eq.pending&or=(next_retry_at.is.null,next_retry_at.lte.${encodeURIComponent(now.toISOString())})&select=kind,idempotency_key,booking_id,billing_document_id,status,attempts,max_attempts,next_retry_at,last_error`,
      ),
    upsertOperation: async (row) => {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/billing_operations?on_conflict=idempotency_key`,
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
        },
      );
      if (!res.ok) throw new Error(`db upsert billing_operations failed: ${res.status}`);
    },
    updateIntegration: async (patchBody) => {
      await patch('billing_integrations', 'provider=eq.bexio', {
        ...patchBody,
        updated_at: new Date().toISOString(),
      });
    },
  };
}
