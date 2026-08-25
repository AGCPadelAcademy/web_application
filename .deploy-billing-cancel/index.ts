/**
 * billing-cancel-invoice — unpaid invoice cancel + refund handoff (US5).
 * Contract: specs/features/007-bexio-integration/contracts/edge-functions.md §5.
 *
 * POST { booking_id, refund_agreed?, idempotency_key? }
 *   → 200 { outcome: "cancelled"|"refund_required", document, reused }
 *   → 404 no_document
 *   → 409 refund_agreement_required | cancel_refused | booking_not_cancellable
 *   → 502 provider_unavailable (invoice_cancel queued; AGC booking still cancelled)
 *
 * Auth: caller JWT; booking owner or admin. refund_agreed is admin-only.
 * Customer-facing cancel UX belongs to cancel-reservation; this is the
 * financial side effect plus an admin-triggerable path (FR-030).
 */

import {
  ProviderAuthError,
  ProviderClientError,
  ProviderConfigError,
  ProviderUnavailableError,
} from './accounting-provider.ts';
import { BexioClient } from './bexio-client.ts';
import { BexioAdapter } from './bexio-adapter.ts';
import type { BexioConfig } from './bexio-mappers.ts';
import { readSecret, writeSecret } from './vault.ts';
import {
  InvoiceCancelConflictError,
  NoBillingDocumentError,
  RefundAgreementRequiredError,
  cancelInvoiceForBooking,
  createPostgrestRepo,
} from './financial-service.ts';

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
  console.log(JSON.stringify({ component: 'billing-cancel-invoice', ...event }));
}

async function dbSelect(table: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`db select ${table} failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>[];
}

async function cancelAgcBooking(bookingId: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}&payment_status=neq.cancelled`,
    {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: 'cancelled', payment_status: 'cancelled' }),
    },
  );
  if (!res.ok) log({ event: 'booking_cancel_failed', bookingId, status: res.status });
}

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

  let bookingId = '';
  try {
    const caller = await resolveCaller(req);
    if (!caller) return json({ error: 'unauthenticated' }, 401);

    const body = (await req.json().catch(() => ({}))) as {
      booking_id?: string;
      refund_agreed?: boolean;
      idempotency_key?: string;
    };
    if (!body.booking_id) return json({ error: 'booking_id required' }, 422);
    bookingId = body.booking_id;
    if (body.refund_agreed && !caller.isAdmin) {
      return json({ error: 'forbidden', message: 'refund_agreed is admin-only' }, 403);
    }

    const expectedCancelKey = `booking:${body.booking_id}:invoice_cancel:v1`;
    const expectedRefundKey = `booking:${body.booking_id}:refund:v1`;
    if (
      body.idempotency_key &&
      body.idempotency_key !== expectedCancelKey &&
      body.idempotency_key !== expectedRefundKey
    ) {
      return json({ error: 'invalid_idempotency_key' }, 422);
    }

    const bookings = await dbSelect('bookings', `id=eq.${body.booking_id}&select=user_id`);
    const booking = bookings[0];
    if (!booking) return json({ error: 'booking_not_cancellable', message: 'booking not found' }, 409);
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

    const result = await cancelInvoiceForBooking(
      { provider, repo, config },
      body.booking_id,
      { refundAgreed: Boolean(body.refund_agreed), actorUserId: caller.userId },
    );
    // Operational cancel always completes when the financial intention is accepted
    // (unpaid cancel or paid refund handoff). Bexio outage is handled below.
    await cancelAgcBooking(body.booking_id);
    return json({
      outcome: result.outcome,
      reused: result.reused,
      document: {
        id: result.document.id ?? null,
        document_nr: result.document.document_nr,
        status: result.document.status,
        total: result.document.total,
        currency: result.document.currency,
      },
    });
  } catch (err) {
    if (err instanceof NoBillingDocumentError) {
      return json({ error: 'no_document', message: err.message }, 404);
    }
    if (err instanceof RefundAgreementRequiredError) {
      return json({ error: 'refund_agreement_required', message: err.message }, 409);
    }
    if (err instanceof InvoiceCancelConflictError) {
      return json({ error: 'cancel_refused', message: err.message }, 409);
    }
    if (err instanceof ProviderConfigError) {
      return json({ error: 'integration_not_configured', missing: err.missing }, 409);
    }
    if (err instanceof ProviderAuthError || err instanceof ProviderUnavailableError) {
      if (bookingId) await cancelAgcBooking(bookingId);
      return json({
        error: 'provider_unavailable',
        message: 'invoice cancellation queued for retry; booking cancelled in AGC',
      }, 502);
    }
    if (err instanceof ProviderClientError) {
      return json({ error: 'provider_rejected', message: 'Bexio rejected the request' }, 502);
    }
    log({ event: 'unhandled_error', error: (err as Error).name });
    return json({ error: 'internal_error' }, 500);
  }
});
