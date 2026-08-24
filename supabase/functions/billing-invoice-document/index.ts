/**
 * billing-invoice-document — stream the Bexio invoice PDF (US3).
 * Contract: specs/features/007-bexio-integration/contracts/edge-functions.md §3.
 *
 * POST { booking_id }  or  GET ?booking_id=
 *   → 200 application/pdf (inline)
 *   → 404 { error: "no_document" }  (legacy bookings use generate-invoice-pdf)
 *   → 401/403 auth
 *   → 502 provider_unavailable
 *
 * Auth: caller JWT; booking owner or admin. Nothing is written to Storage (R-11).
 */

import {
  ProviderAuthError,
  ProviderClientError,
  ProviderConfigError,
  ProviderUnavailableError,
} from '../_shared/billing/accounting-provider.ts';
import { BexioClient } from '../_shared/billing/bexio/bexio-client.ts';
import { BexioAdapter } from '../_shared/billing/bexio/bexio-adapter.ts';
import type { BexioConfig } from '../_shared/billing/bexio/bexio-mappers.ts';
import { readSecret, writeSecret } from '../_shared/billing/vault.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLIENT_ID = Deno.env.get('BEXIO_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('BEXIO_CLIENT_SECRET') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-disposition',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ component: 'billing-invoice-document', ...event }));
}

async function dbSelect(table: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`db select ${table} failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>[];
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
  return (row.config ?? {}) as unknown as BexioConfig;
}

async function readBookingId(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('booking_id');
  if (fromQuery) return fromQuery;
  if (req.method === 'GET') return null;
  const body = (await req.json().catch(() => ({}))) as { booking_id?: string };
  return body.booking_id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  try {
    const caller = await resolveCaller(req);
    if (!caller) return json({ error: 'unauthenticated' }, 401);

    const bookingId = await readBookingId(req);
    if (!bookingId) return json({ error: 'booking_id required' }, 422);

    const bookings = await dbSelect('bookings', `id=eq.${bookingId}&select=user_id`);
    const booking = bookings[0];
    if (!booking) return json({ error: 'no_document', message: 'booking not found' }, 404);
    if (booking.user_id !== caller.userId && !caller.isAdmin) {
      return json({ error: 'forbidden' }, 403);
    }

    const documents = await dbSelect(
      'billing_documents',
      `booking_id=eq.${bookingId}&select=external_id,document_nr`,
    );
    const document = documents[0];
    if (!document?.external_id) return json({ error: 'no_document' }, 404);

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
    const pdf = await provider.getInvoicePdf({ externalId: String(document.external_id) });
    const fileName = pdf.fileName || `${document.document_nr ?? 'invoice'}.pdf`;

    log({ event: 'pdf_served', bookingId, fileName });
    return new Response(pdf.bytes, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof ProviderConfigError) {
      return json({ error: 'integration_not_configured', missing: err.missing }, 409);
    }
    if (err instanceof ProviderAuthError || err instanceof ProviderUnavailableError) {
      return json({ error: 'provider_unavailable', message: 'invoice PDF is temporarily unavailable' }, 502);
    }
    if (err instanceof ProviderClientError) {
      log({ event: 'pdf_rejected', status: err.status, error: err.message });
      return json({ error: 'provider_rejected', message: 'Invoice PDF is temporarily unavailable' }, 502);
    }
    log({ event: 'unhandled_error', error: (err as Error).name, message: (err as Error).message });
    return json({ error: 'internal_error' }, 500);
  }
});
