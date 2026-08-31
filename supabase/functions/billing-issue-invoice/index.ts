/**
 * billing-issue-invoice — post-booking invoicing orchestration (US2).
 * Contract: specs/features/007-bexio-integration/contracts/edge-functions.md §2.
 *
 * POST { booking_id, idempotency_key? }
 *   → 200 { document: { id, document_nr, status, total, currency }, reused }
 *   → 409 booking_not_billable | integration_not_configured
 *   → 502 provider_unavailable (operation enqueued in billing_operations)
 *
 * Auth: caller JWT (gateway verify_jwt + in-function user resolution);
 * caller must own the booking or be admin. The booking flow itself must never
 * fail because of this function (FR-030) — provider outages enqueue a retry.
 */

import {
  ProviderAuthError,
  ProviderClientError,
  ProviderConfigError,
  ProviderUnavailableError,
  type AccountingProvider,
} from '../_shared/billing/accounting-provider.ts';
import { BexioClient } from '../_shared/billing/bexio/bexio-client.ts';
import { BexioAdapter } from '../_shared/billing/bexio/bexio-adapter.ts';
import type { BexioConfig } from '../_shared/billing/bexio/bexio-mappers.ts';
import { readSecret, writeSecret } from '../_shared/billing/vault.ts';
import {
  BookingNotBillableError,
  createPostgrestRepo,
  issueInvoiceForBooking,
  type BillingDocumentRow,
} from '../_shared/billing/financial-service.ts';
import {
  invoiceEmailHtml,
  invoiceEmailSubject,
  sendTransactionalEmail,
} from '../_shared/billing/mailer.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLIENT_ID = Deno.env.get('BEXIO_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('BEXIO_CLIENT_SECRET') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ component: 'billing-issue-invoice', ...event }));
}

async function dbSelect(table: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`db select ${table} failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>[];
}

/** Resolve the caller from their JWT; returns null when unauthenticated. */
async function resolveCaller(req: Request): Promise<{ userId: string; isAdmin: boolean } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return null;
  const rows = await dbSelect('profiles', `id=eq.${user.id}&select=role`);
  return { userId: user.id, isAdmin: rows[0]?.role === 'admin' };
}

async function insertNotification(row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications_log`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) log({ event: 'notification_log_failed', status: res.status });
}

/** FR-029a: email the Bexio PDF via Resend. Never throws (FR-030). */
async function maybeEmailInvoicePdf(opts: {
  provider: AccountingProvider;
  bookingId: string;
  userId: string;
  document: BillingDocumentRow;
}): Promise<void> {
  const subject = invoiceEmailSubject(opts.document.document_nr);
  try {
    const already = await dbSelect(
      'notifications_log',
      `booking_id=eq.${opts.bookingId}&status=eq.sent&message_subject=like.${encodeURIComponent('Your AGC invoice')}*&select=id`,
    );
    if (already.length > 0) {
      log({ event: 'invoice_email_skipped', bookingId: opts.bookingId, reason: 'already_sent' });
      return;
    }

    const profiles = await dbSelect('profiles', `id=eq.${opts.userId}&select=email,full_name,first_name`);
    const profile = profiles[0];
    const to = typeof profile?.email === 'string' ? profile.email : '';
    if (!to) {
      log({ event: 'invoice_email_skipped', bookingId: opts.bookingId, reason: 'no_email' });
      return;
    }

    const pdf = await opts.provider.getInvoicePdf({ externalId: opts.document.external_id });
    const resendKey = (Deno.env.get('RESEND_API_KEY') ?? '').trim() || null;
    const result = await sendTransactionalEmail(
      {
        to,
        subject,
        html: invoiceEmailHtml({
          name: (profile.first_name as string) || (profile.full_name as string) || null,
          documentNr: opts.document.document_nr,
          total: Number(opts.document.total),
          currency: opts.document.currency,
        }),
        attachments: [{
          filename: pdf.fileName || `${opts.document.document_nr ?? 'invoice'}.pdf`,
          bytes: pdf.bytes,
        }],
      },
      { sendgridKey: null, resendKey },
    );

    await insertNotification({
      booking_id: opts.bookingId,
      notification_type: 'email',
      recipient_type: 'client',
      recipient_email: to,
      message_subject: subject,
      status: result.sent ? 'sent' : 'failed',
      error_message: result.error ?? null,
      sent_at: result.sent ? new Date().toISOString() : null,
    });
    log({
      event: result.sent ? 'invoice_email_sent' : 'invoice_email_failed',
      bookingId: opts.bookingId,
      via: 'resend',
      skipped: result.skipped ?? false,
      message: result.error ?? undefined,
    });
  } catch (err) {
    const message = (err as Error).message;
    log({
      event: 'invoice_email_failed',
      bookingId: opts.bookingId,
      error: (err as Error).name,
      message,
    });
    try {
      const profiles = await dbSelect('profiles', `id=eq.${opts.userId}&select=email`);
      const to = typeof profiles[0]?.email === 'string' ? profiles[0].email : null;
      await insertNotification({
        booking_id: opts.bookingId,
        notification_type: 'email',
        recipient_type: 'client',
        recipient_email: to,
        message_subject: subject,
        status: 'failed',
        error_message: message,
        sent_at: null,
      });
    } catch {
      /* audit best-effort */
    }
  }
}

async function loadConfig(): Promise<BexioConfig> {
  const rows = await dbSelect('billing_integrations', 'provider=eq.bexio&select=config,status');
  const row = rows[0];
  if (!row || (row.status !== 'connected' && row.status !== 'degraded')) {
    throw new ProviderConfigError('bexio integration is not connected', ['status']);
  }
  const config = (row.config ?? {}) as Record<string, unknown>;
  const missing = [
    'bexio_user_id',
    'currency_id',
    'bank_account_id',
    'payment_type_id',
    'sales_account_id',
    'tax_id_sales',
    'unit_id',
  ].filter((k) => config[k] === null || config[k] === undefined);
  if (missing.length > 0) {
    throw new ProviderConfigError('bexio integration config incomplete', missing);
  }
  return config as unknown as BexioConfig;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const caller = await resolveCaller(req);
    if (!caller) return json({ error: 'unauthenticated' }, 401);

    const body = (await req.json().catch(() => ({}))) as {
      booking_id?: string;
      idempotency_key?: string;
    };
    if (!body.booking_id) return json({ error: 'booking_id required' }, 422);
    // The idempotency key is deterministic and server-computed; a mismatched
    // client-supplied key indicates a caller bug (contract §2).
    const expectedKey = `booking:${body.booking_id}:invoice:v1`;
    if (body.idempotency_key && body.idempotency_key !== expectedKey) {
      return json({ error: 'invalid_idempotency_key' }, 422);
    }

    // Ownership-or-admin authorization (same dual-check pattern as proof access).
    const bookings = await dbSelect('bookings', `id=eq.${body.booking_id}&select=user_id`);
    const booking = bookings[0];
    if (!booking) return json({ error: 'booking_not_billable', message: 'booking not found' }, 409);
    if (booking.user_id !== caller.userId && !caller.isAdmin) {
      return json({ error: 'forbidden' }, 403);
    }

    const config = await loadConfig();
    const client = new BexioClient({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      refreshTokenName: 'bexio_refresh_token',
      accessCacheName: 'bexio_access_token_cache',
      readSecret,
      writeSecret,
    });
    const provider = new BexioAdapter(client, config);
    const repo = createPostgrestRepo(SUPABASE_URL, SERVICE_ROLE_KEY);

    const result = await issueInvoiceForBooking({ provider, repo, config }, body.booking_id);
    await maybeEmailInvoicePdf({
      provider,
      bookingId: body.booking_id,
      userId: String(booking.user_id),
      document: result.document,
    });
    return json({
      document: {
        id: result.document.id ?? null,
        document_nr: result.document.document_nr,
        status: result.document.status,
        total: result.document.total,
        currency: result.document.currency,
      },
      reused: result.reused,
    });
  } catch (err) {
    if (err instanceof BookingNotBillableError) {
      return json({ error: 'booking_not_billable', message: err.message }, 409);
    }
    if (err instanceof ProviderConfigError) {
      return json({ error: 'integration_not_configured', missing: err.missing }, 409);
    }
    if (err instanceof ProviderAuthError || err instanceof ProviderUnavailableError) {
      // Operation already enqueued by the financial service (FR-030).
      return json({ error: 'provider_unavailable', message: 'invoice issuing queued for retry' }, 502);
    }
    if (err instanceof ProviderClientError) {
      return json({ error: 'provider_rejected', message: 'Bexio rejected the request' }, 502);
    }
    log({ event: 'unhandled_error', error: (err as Error).name });
    return json({ error: 'internal_error' }, 500);
  }
});
