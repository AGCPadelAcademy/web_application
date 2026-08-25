/**
 * FinancialService — AGC-facing billing orchestration (T022).
 * Contract: contracts/accounting-provider.md; layering per spec §Architecture.
 *
 * issueInvoiceForBooking(bookingId):
 *   idempotency guard → ensure contact (search/adopt/create, FR-010/011)
 *   → create draft with api_reference → issue → upsert billing_documents
 *   → invoice.issued audit event. Provider failures persist a pending
 *   billing_operations row (deterministic idempotency key) and rethrow (FR-030).
 */

import {
  ProviderAuthError,
  ProviderClientError,
  ProviderUnavailableError,
  type AccountingProvider,
  type ContactInput,
  type ExternalContactRef,
} from './accounting-provider.ts';
import {
  bookingToInvoiceInput,
  profileToContactInput,
  resolveBexioCountryId,
  type AgcBookingRow,
  type AgcLessonRow,
  type AgcProfileRow,
  type BexioConfig,
} from './bexio-mappers.ts';

export class BookingNotBillableError extends Error {
  override readonly name = 'BookingNotBillableError';
}

export class NoBillingDocumentError extends Error {
  override readonly name = 'NoBillingDocumentError';
}

/** Paid/partial invoice cannot be cancelled via API without an explicit refund agreement (FR-031). */
export class RefundAgreementRequiredError extends Error {
  override readonly name = 'RefundAgreementRequiredError';
}

/** Bexio refused the cancel (already paid, locked year, …). AGC state is left unchanged (FR-032). */
export class InvoiceCancelConflictError extends Error {
  override readonly name = 'InvoiceCancelConflictError';
}

export interface BillingDocumentRow {
  id?: string;
  booking_id: string;
  provider: string;
  external_id: string;
  document_nr: string | null;
  api_reference: string;
  status: string;
  total: number;
  currency: string;
}

export interface BillingOperationRow {
  kind: string;
  idempotency_key: string;
  booking_id?: string | null;
  billing_document_id?: string | null;
  status: string;
  attempts: number;
  max_attempts?: number;
  next_retry_at?: string | null;
  last_error?: string | null;
}

/** Persistence boundary — mocked in tests, PostgREST (service role) in production. */
export interface BillingRepo {
  getBooking(bookingId: string): Promise<(AgcBookingRow & { status: string; payment_status: string }) | null>;
  getProfile(userId: string): Promise<AgcProfileRow | null>;
  getLesson(lessonCode: string): Promise<AgcLessonRow | null>;
  findDocumentByBooking(bookingId: string): Promise<BillingDocumentRow | null>;
  findContactByUser(userId: string): Promise<{ external_id: string; email_snapshot: string } | null>;
  upsertContact(row: {
    user_id: string;
    provider: string;
    external_id: string;
    email_snapshot: string;
  }): Promise<void>;
  upsertDocument(row: BillingDocumentRow): Promise<BillingDocumentRow>;
  findOperation(idempotencyKey: string): Promise<BillingOperationRow | null>;
  upsertOperation(row: BillingOperationRow): Promise<void>;
  insertEvent(event: {
    event_type: string;
    actor_user_id?: string | null;
    booking_id?: string | null;
    billing_document_id?: string | null;
    details?: Record<string, unknown>;
  }): Promise<void>;
}

export interface FinancialServiceDeps {
  provider: AccountingProvider;
  repo: BillingRepo;
  config: BexioConfig;
  now?: () => Date;
}

export interface IssueInvoiceResult {
  document: BillingDocumentRow;
  reused: boolean;
}

export type CancelInvoiceOutcome = 'cancelled' | 'refund_required';

export interface CancelInvoiceResult {
  outcome: CancelInvoiceOutcome;
  document: BillingDocumentRow;
  reused: boolean;
}

export interface CancelInvoiceOptions {
  refundAgreed?: boolean;
  actorUserId?: string | null;
}

function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ component: 'financial-service', ...event }));
}

function billingContactInput(profile: AgcProfileRow, config: BexioConfig): ContactInput {
  const input = profileToContactInput(profile);
  const countryId = resolveBexioCountryId(profile.country_code ?? input.countryCode, config.countries);
  if (countryId) input.countryId = countryId;
  return input;
}

/** Exponential backoff for the retry queue: 2^n minutes, capped at 4h. */
export function nextRetryAt(attempts: number, now: Date): string {
  const minutes = Math.min(2 ** attempts, 240);
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export async function issueInvoiceForBooking(
  deps: FinancialServiceDeps,
  bookingId: string,
): Promise<IssueInvoiceResult> {
  const { provider, repo, config } = deps;
  const now = deps.now?.() ?? new Date();
  const idempotencyKey = `booking:${bookingId}:invoice:v1`;

  // Idempotency layer 1: local document anchor (R-05).
  const existingDoc = await repo.findDocumentByBooking(bookingId);
  if (existingDoc) return { document: existingDoc, reused: true };

  // Idempotency layer 2: a previously succeeded operation.
  const existingOp = await repo.findOperation(idempotencyKey);
  if (existingOp?.status === 'succeeded') {
    const doc = await repo.findDocumentByBooking(bookingId);
    if (doc) return { document: doc, reused: true };
  }

  const booking = await repo.getBooking(bookingId);
  if (!booking || booking.status === 'cancelled' || booking.payment_status === 'cancelled') {
    throw new BookingNotBillableError(`booking ${bookingId} is not in a billable state`);
  }
  const [profile, lesson] = await Promise.all([
    repo.getProfile(booking.user_id),
    booking.lesson_code ? repo.getLesson(booking.lesson_code) : Promise.resolve(null),
  ]);
  if (!profile?.email) throw new BookingNotBillableError(`booking ${bookingId} has no billable profile`);
  if (!lesson) throw new BookingNotBillableError(`booking ${bookingId} has no priced lesson`);

  try {
    // Ensure contact: stored mapping → email search/adopt → create (R-04).
    let contactRef: ExternalContactRef | null = null;
    const storedContact = await repo.findContactByUser(booking.user_id);
    const contactInput = billingContactInput(profile, config);
    if (storedContact) {
      contactRef = { externalId: storedContact.external_id };
      try {
        await provider.updateContact(contactRef, contactInput);
      } catch (err) {
        log({ event: 'contact_update_failed', error: (err as Error).name });
      }
    } else {
      contactRef = await provider.findContactByEmail(profile.email);
      if (!contactRef) {
        contactRef = await provider.createContact(contactInput);
      }
      await repo.upsertContact({
        user_id: booking.user_id,
        provider: provider.name,
        external_id: contactRef.externalId,
        email_snapshot: profile.email,
      });
      await repo.insertEvent({
        event_type: 'contact.linked',
        booking_id: bookingId,
        details: { provider: provider.name },
      });
    }

    // Idempotency layer 3: lost-response recovery via api_reference (R-05).
    const apiReference = `agc:booking:${bookingId}`;
    let invoice = await provider.findInvoiceByApiReference(apiReference);
    if (!invoice) {
      const input = bookingToInvoiceInput(booking, lesson, contactRef, config, now);
      const draft = await provider.createInvoice(input);
      invoice = await provider.issueInvoice({ externalId: draft.externalId });
    }

    const document = await repo.upsertDocument({
      booking_id: bookingId,
      provider: provider.name,
      external_id: invoice.externalId,
      document_nr: invoice.documentNr,
      api_reference: apiReference,
      status: invoice.status === 'unknown' ? 'issued' : invoice.status,
      total: invoice.total,
      currency: 'CHF',
    });

    await repo.upsertOperation({
      kind: 'invoice_issue',
      idempotency_key: idempotencyKey,
      booking_id: bookingId,
      billing_document_id: document.id ?? null,
      status: 'succeeded',
      attempts: (existingOp?.attempts ?? 0) + 1,
      next_retry_at: null,
      last_error: null,
    });
    await repo.insertEvent({
      event_type: 'invoice.issued',
      booking_id: bookingId,
      billing_document_id: document.id ?? null,
      details: { provider: provider.name, document_nr: invoice.documentNr, total: invoice.total },
    });
    log({ event: 'invoice_issued', bookingId, documentNr: invoice.documentNr });
    return { document, reused: false };
  } catch (err) {
    if (err instanceof ProviderAuthError || err instanceof ProviderUnavailableError) {
      // FR-030: enqueue for the worker; the booking itself is unaffected.
      const attempts = (existingOp?.attempts ?? 0) + 1;
      await repo.upsertOperation({
        kind: 'invoice_issue',
        idempotency_key: idempotencyKey,
        booking_id: bookingId,
        status: 'pending',
        attempts,
        next_retry_at: nextRetryAt(attempts, now),
        last_error: err.name,
      });
      log({ event: 'invoice_issue_enqueued', bookingId, error: err.name, attempts });
    }
    throw err;
  }
}

function moneyHasMoved(status: string): boolean {
  return status === 'paid' || status === 'partially_paid';
}

/**
 * Cancel the Bexio invoice for a booking (US5 / T040).
 *
 * Unpaid `issued` documents are cancelled via API. Paid/partial documents
 * never move money programmatically (no credit-note API) — they record a
 * refund expectation when `refundAgreed` is set. Provider refusals leave
 * AGC document state unchanged (FR-032).
 */
export async function cancelInvoiceForBooking(
  deps: FinancialServiceDeps,
  bookingId: string,
  options: CancelInvoiceOptions = {},
): Promise<CancelInvoiceResult> {
  const { provider, repo } = deps;
  const now = deps.now?.() ?? new Date();
  const cancelKey = `booking:${bookingId}:invoice_cancel:v1`;
  const refundKey = `booking:${bookingId}:refund:v1`;

  const document = await repo.findDocumentByBooking(bookingId);
  if (!document) throw new NoBillingDocumentError(`no billing document for booking ${bookingId}`);

  if (document.status === 'cancelled') {
    return { outcome: 'cancelled', document, reused: true };
  }

  const existingCancel = await repo.findOperation(cancelKey);
  if (existingCancel?.status === 'succeeded') {
    return { outcome: 'cancelled', document, reused: true };
  }
  const existingRefund = await repo.findOperation(refundKey);
  if (existingRefund?.status === 'succeeded') {
    return { outcome: 'refund_required', document, reused: true };
  }

  if (moneyHasMoved(document.status)) {
    if (!options.refundAgreed) {
      throw new RefundAgreementRequiredError(
        `booking ${bookingId} is ${document.status}; refund agreement required`,
      );
    }
    await repo.upsertOperation({
      kind: 'invoice_cancel',
      idempotency_key: refundKey,
      booking_id: bookingId,
      billing_document_id: document.id ?? null,
      status: 'succeeded',
      attempts: 1,
      next_retry_at: null,
      last_error: null,
    });
    await repo.insertEvent({
      event_type: 'refund.expected',
      actor_user_id: options.actorUserId ?? null,
      booking_id: bookingId,
      billing_document_id: document.id ?? null,
      details: {
        status: 'pending_manual',
        document_nr: document.document_nr,
        total: document.total,
        currency: document.currency,
      },
    });
    log({ event: 'refund_expected', bookingId, documentNr: document.document_nr });
    return { outcome: 'refund_required', document, reused: false };
  }

  try {
    await provider.cancelInvoice({ externalId: document.external_id });
    const cancelled = await repo.upsertDocument({ ...document, status: 'cancelled' });
    await repo.upsertOperation({
      kind: 'invoice_cancel',
      idempotency_key: cancelKey,
      booking_id: bookingId,
      billing_document_id: cancelled.id ?? document.id ?? null,
      status: 'succeeded',
      attempts: (existingCancel?.attempts ?? 0) + 1,
      next_retry_at: null,
      last_error: null,
    });
    await repo.insertEvent({
      event_type: 'invoice.cancelled',
      actor_user_id: options.actorUserId ?? null,
      booking_id: bookingId,
      billing_document_id: cancelled.id ?? document.id ?? null,
      details: { provider: provider.name, document_nr: document.document_nr },
    });
    log({ event: 'invoice_cancelled', bookingId, documentNr: document.document_nr });
    return { outcome: 'cancelled', document: cancelled, reused: false };
  } catch (err) {
    if (err instanceof ProviderAuthError || err instanceof ProviderUnavailableError) {
      const attempts = (existingCancel?.attempts ?? 0) + 1;
      await repo.upsertOperation({
        kind: 'invoice_cancel',
        idempotency_key: cancelKey,
        booking_id: bookingId,
        billing_document_id: document.id ?? null,
        status: 'pending',
        attempts,
        next_retry_at: nextRetryAt(attempts, now),
        last_error: err.name,
      });
      log({ event: 'invoice_cancel_enqueued', bookingId, error: err.name, attempts });
      throw err;
    }
    if (err instanceof ProviderClientError) {
      await repo.upsertOperation({
        kind: 'invoice_cancel',
        idempotency_key: cancelKey,
        booking_id: bookingId,
        billing_document_id: document.id ?? null,
        status: 'failed',
        attempts: (existingCancel?.attempts ?? 0) + 1,
        next_retry_at: null,
        last_error: err.name,
      });
      await repo.insertEvent({
        event_type: 'invoice.cancel_refused',
        actor_user_id: options.actorUserId ?? null,
        booking_id: bookingId,
        billing_document_id: document.id ?? null,
        details: { reason: 'provider_refused', status: err.status },
      });
      log({ event: 'invoice_cancel_refused', bookingId, status: err.status });
      throw new InvoiceCancelConflictError(
        `Bexio refused to cancel invoice for booking ${bookingId}`,
      );
    }
    throw err;
  }
}

// --- PostgREST repository (service role; Edge Functions are the only writers) ---

export function createPostgrestRepo(supabaseUrl: string, serviceRoleKey: string): BillingRepo {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  async function selectOne<T>(table: string, query: string): Promise<T | null> {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers });
    if (!res.ok) throw new Error(`db select ${table} failed: ${res.status}`);
    const rows = (await res.json()) as T[];
    return rows[0] ?? null;
  }

  async function upsert(table: string, onConflict: string, row: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`db upsert ${table} failed: ${res.status}`);
  }

  return {
    getBooking: (bookingId) =>
      selectOne(
        'bookings',
        `id=eq.${bookingId}&select=id,user_id,lesson_code,lesson_name,booking_date,price,status,payment_status`,
      ),
    getProfile: (userId) =>
      selectOne(
        'profiles',
        `id=eq.${userId}&select=id,full_name,first_name,last_name,email,phone,address,postal_code,city,country,country_code`,
      ),
    getLesson: (lessonCode) =>
      selectOne('lessons', `lesson_code=eq.${lessonCode}&select=lesson_code,name,price_amount`),
    findDocumentByBooking: (bookingId) =>
      selectOne(
        'billing_documents',
        `booking_id=eq.${bookingId}&select=id,booking_id,provider,external_id,document_nr,api_reference,status,total,currency`,
      ),
    findContactByUser: (userId) =>
      selectOne('billing_contacts', `user_id=eq.${userId}&select=external_id,email_snapshot`),
    upsertContact: (row) => upsert('billing_contacts', 'user_id', { ...row }),
    upsertDocument: async (row) => {
      await upsert('billing_documents', 'booking_id', { ...row });
      const saved = await selectOne<BillingDocumentRow>(
        'billing_documents',
        `booking_id=eq.${row.booking_id}&select=id,booking_id,provider,external_id,document_nr,api_reference,status,total,currency`,
      );
      return saved ?? row;
    },
    findOperation: (key) =>
      selectOne(
        'billing_operations',
        `idempotency_key=eq.${encodeURIComponent(key)}&select=kind,idempotency_key,booking_id,billing_document_id,status,attempts,next_retry_at,last_error`,
      ),
    upsertOperation: (row) => upsert('billing_operations', 'idempotency_key', { ...row }),
    insertEvent: async (event) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/billing_events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ details: {}, ...event }),
      });
      if (!res.ok) log({ event: 'event_insert_failed', status: res.status });
    },
  };
}
