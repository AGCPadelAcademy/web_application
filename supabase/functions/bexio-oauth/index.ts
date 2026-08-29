/**
 * bexio-oauth — OAuth 2.0 authorization-code flow + integration configuration.
 * Contract: specs/features/007-bexio-integration/contracts/edge-functions.md §1.
 *
 * Actions:
 *   POST {action:'start'}      → {authorize_url} (admin)
 *   GET  /bexio-oauth/callback → 302 to admin UI (state-signed, no caller JWT)
 *   POST {action:'status'}     → integration status + config (admin)
 *   POST {action:'initialize'} → discover Bexio config IDs, save (admin)
 *   POST {action:'configure'}  → merge + validate admin-supplied config (admin)
 *   POST {action:'disconnect'} → revoke stored tokens, mark disconnected (admin)
 */

import { signState, verifyState } from './state.ts';
import { BexioClient } from '../_shared/billing/bexio/bexio-client.ts';
import { pickPreferredSalesTax } from '../_shared/billing/bexio/tax-selection.ts';
import { readSecret, writeSecret, deleteSecret } from '../_shared/billing/vault.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLIENT_ID = Deno.env.get('BEXIO_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('BEXIO_CLIENT_SECRET') ?? '';
const STATE_SECRET = Deno.env.get('BEXIO_OAUTH_STATE_SECRET') ?? '';
const APP_ORIGIN = Deno.env.get('PUBLIC_APP_URL') ?? 'https://agcpadelacademy.com';

// New IdP endpoints (idp.bexio.com decommissioned 2025-03-31).
const AUTHORIZE_URL = 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth';
const TOKEN_URL = 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/token';

// Path-based callback: Bexio's new IdP (Keycloak) does exact redirect_uri
// matching and is unreliable with query strings in registered URLs.
// CALLBACK_PATH is the external URL registered with Bexio. NOTE: the Supabase
// gateway strips the `/functions/v1` prefix before invoking the function, so
// in-function routing must match on the shorter CALLBACK_SUFFIX instead.
const CALLBACK_PATH = '/functions/v1/bexio-oauth/callback';
const CALLBACK_SUFFIX = '/bexio-oauth/callback';

const SCOPES = ['contact_show', 'contact_edit', 'kb_invoice_show', 'kb_invoice_edit', 'offline_access'];
const REFRESH_TOKEN_NAME = 'bexio_refresh_token';
const ACCESS_CACHE_NAME = 'bexio_access_token_cache';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function redirect(params: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP_ORIGIN}/admin/integrations?${params}` },
  });
}

function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ component: 'bexio-oauth', ...event }));
}

// --- Service-role DB helpers (RLS bypassed; this function is the only writer) ---

async function dbSelect(table: string, query: string): Promise<unknown[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`db select ${table} failed: ${res.status}`);
  return (await res.json()) as unknown[];
}

async function dbUpsertIntegration(fields: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/billing_integrations?on_conflict=provider`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ provider: 'bexio', updated_at: new Date().toISOString(), ...fields }),
  });
  if (!res.ok) throw new Error(`integration upsert failed: ${res.status}`);
}

async function dbInsertEvent(eventType: string, details: Record<string, unknown>, actorUserId?: string | null): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/billing_events`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: eventType,
      actor_user_id: actorUserId ?? null,
      details,
    }),
  });
  if (!res.ok) log({ event: 'event_insert_failed', status: res.status, eventType });
}

// --- Auth -------------------------------------------------------------------
// verify_jwt is OFF at the gateway because the OAuth callback arrives as a
// browser redirect with no Authorization header. Admin actions are therefore
// authenticated in-function: the bearer token is validated against the Auth
// server (signature + expiry), then the profiles role is checked.

async function requireAdmin(req: Request): Promise<{ userId: string } | Response> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthenticated' }, 401);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ error: 'unauthenticated' }, 401);
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return json({ error: 'unauthenticated' }, 401);

  const rows = (await dbSelect('profiles', `id=eq.${user.id}&select=role`)) as { role: string }[];
  if (rows[0]?.role !== 'admin') return json({ error: 'admin role required' }, 403);
  return { userId: user.id };
}

// --- Bexio client factory ---------------------------------------------------

function makeClient(): BexioClient {
  return new BexioClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    refreshTokenName: REFRESH_TOKEN_NAME,
    accessCacheName: ACCESS_CACHE_NAME,
    readSecret,
    writeSecret,
    onAuthFailure: async () => {
      await dbUpsertIntegration({ status: 'requires_reauth', last_error: 'token refresh rejected' });
      await dbInsertEvent('integration.requires_reauth', { reason: 'invalid_grant' });
    },
  });
}

// --- Config ------------------------------------------------------------------

const CONFIG_KEYS = [
  'currency_id',
  'tax_id_sales',
  'tax_value_sales',
  'tax_code_sales',
  'bank_account_id',
  'payment_type_id',
  'unit_id',
  'language_id',
  'country_id_ch',
  'sales_account_id',
  'bexio_user_id',
  'template_slug',
  'mwst_is_net',
  'payment_term_days',
  'manual_paid_grace_days',
  'taxes_sales',
] as const;

const REQUIRED_CONFIG_KEYS = [
  'currency_id',
  'tax_id_sales',
  'bank_account_id',
  'payment_type_id',
  'unit_id',
  'language_id',
  'country_id_ch',
  'sales_account_id',
  'bexio_user_id',
] as const;

function missingConfigKeys(config: Record<string, unknown>): string[] {
  return REQUIRED_CONFIG_KEYS.filter((k) => config[k] === null || config[k] === undefined);
}

// --- Actions -----------------------------------------------------------------

async function handleStart(userId: string): Promise<Response> {
  if (!CLIENT_ID || !STATE_SECRET) return json({ error: 'integration not configured server-side' }, 500);
  const state = await signState(STATE_SECRET, userId);
  const redirectUri = `${SUPABASE_URL}${CALLBACK_PATH}`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
  });
  return json({ authorize_url: `${AUTHORIZE_URL}?${params.toString()}` });
}

async function handleCallback(url: URL): Promise<Response> {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return redirect('bexio=error&code=missing_params');

  const check = await verifyState(STATE_SECRET, state);
  if (!check.valid) return redirect('bexio=error&code=invalid_state');

  const redirectUri = `${SUPABASE_URL}${CALLBACK_PATH}`;
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) {
    log({ event: 'token_exchange_failed', status: tokenRes.status });
    return redirect('bexio=error&code=token_exchange');
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  };
  await writeSecret(REFRESH_TOKEN_NAME, tokens.refresh_token);
  await writeSecret(
    ACCESS_CACHE_NAME,
    JSON.stringify({
      access_token: tokens.access_token,
      expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    }),
  );

  await dbUpsertIntegration({
    status: 'connected',
    refresh_token_secret: REFRESH_TOKEN_NAME,
    access_token_secret: ACCESS_CACHE_NAME,
    scopes: SCOPES,
    connected_at: new Date().toISOString(),
    connected_by: check.userId ?? null,
    last_error: null,
  });
  await dbInsertEvent('integration.connected', { scopes: SCOPES }, check.userId);
  log({ event: 'integration_connected' });
  return redirect('bexio=connected');
}

async function handleStatus(): Promise<Response> {
  const rows = (await dbSelect(
    'billing_integrations',
    'provider=eq.bexio&select=status,connected_at,connected_by,scopes,last_successful_call_at,last_error,config',
  )) as Record<string, unknown>[];
  const row = rows[0] ?? null;
  const config = (row?.config ?? {}) as Record<string, unknown>;
  const missing = missingConfigKeys(config);
  return json({
    status: row?.status ?? 'not_connected',
    connected_at: row?.connected_at ?? null,
    connected_by: row?.connected_by ?? null,
    scopes: row?.scopes ?? [],
    last_successful_call_at: row?.last_successful_call_at ?? null,
    last_error: row?.last_error ?? null,
    config,
    config_complete: missing.length === 0,
    missing,
  });
}

async function handleInitialize(): Promise<Response> {
  const client = makeClient();
  const missing: string[] = [];
  const config: Record<string, unknown> = {
    payment_term_days: 30,
    manual_paid_grace_days: 30,
    // Advertised lesson price is the invoice total (R-14). Go-live VAT is 0%
    // (clarification 2026-08-29). mwst_type 0 = including taxes.
    mwst_is_net: false,
    mwst_type: 0,
    template_slug: null,
  };

  // Health check (FR-006); the user id is required on every invoice payload.
  const me = (await client.request<{ id: number }>('GET', '/3.0/users/me')) as { id: number };
  config.bexio_user_id = me.id;
  log({ event: 'health_check_ok', bexio_user_id: me.id });

  const discover = async <T>(key: string, path: string, pick: (data: T) => unknown): Promise<void> => {
    try {
      const data = await client.request<T>('GET', path);
      const value = pick(data);
      if (value === null || value === undefined) missing.push(key);
      else config[key] = value;
    } catch (err) {
      log({ event: 'discovery_failed', key, error: (err as Error).name });
      missing.push(key);
    }
  };

  // Bexio /3.0/currencies uses `name` for the ISO 4217 code (no `code` field).
  await discover('currency_id', '/3.0/currencies', (rows: { id: number; name: string }[]) =>
    rows.find((r) => r.name === 'CHF')?.id ?? null);
  await discover('bank_account_id', '/3.0/banking/accounts', (rows: { id: number }[]) => rows[0]?.id ?? null);
  await discover('payment_type_id', '/2.0/payment_type', (rows: { id: number }[]) => rows[0]?.id ?? null);
  await discover('unit_id', '/2.0/unit', (rows: { id: number; name: string }[]) =>
    rows.find((r) => /hour|stunde|std/i.test(r.name))?.id ?? rows[0]?.id ?? null);
  await discover('language_id', '/2.0/language', (rows: { id: number; name: string }[]) =>
    rows.find((r) => /deutsch|german/i.test(r.name))?.id ?? rows[0]?.id ?? null);
  try {
    const countryRows = await client.request<{
      id: number;
      name: string;
      name_short?: string;
      iso3166_alpha2?: string;
    }[]>('GET', '/2.0/country');
    config.countries = countryRows.map((row) => ({
      id: row.id,
      iso: (row.iso3166_alpha2 || row.name_short || '').toUpperCase(),
      name: row.name,
    }));
    config.country_id_ch =
      countryRows.find((r) => (r.iso3166_alpha2 || r.name_short) === 'CH')?.id
      ?? countryRows.find((r) => /switzerland|schweiz/i.test(r.name))?.id
      ?? null;
    if (config.country_id_ch === null) missing.push('country_id_ch');
  } catch (err) {
    log({ event: 'discovery_failed', key: 'countries', error: (err as Error).name });
    missing.push('country_id_ch');
  }
  // Sales revenue account for invoice positions: Swiss SME chart of accounts —
  // class 3 = operating revenue. May fail if the granted scopes exclude the
  // accounts endpoint; then the admin enters it via `configure`.
  await discover('sales_account_id', '/2.0/accounts', (rows: { id: number; account_no: string; is_active: boolean }[]) =>
    rows.find((r) => r.is_active && /^3/.test(r.account_no))?.id ?? null);

  // Taxes: list all active rates (not only types=sales_tax). Production uses
  // Bexio code VIM; the sales_tax filter on this company only returns 8.1%/2.6%.
  // Do not default to taxes[0].
  try {
    type BexioTaxRow = {
      id: number;
      value: number;
      name: string;
      code?: string;
      type?: string;
    };
    let taxes = await client.request<BexioTaxRow[]>('GET', '/3.0/taxes?scope=active');
    if (!pickPreferredSalesTax(taxes)) {
      const unfiltered = await client.request<BexioTaxRow[]>('GET', '/3.0/taxes').catch(() => []);
      if (unfiltered.length > 0) taxes = unfiltered;
    }
    config.taxes_sales = taxes.map((t) => ({
      id: t.id,
      value: t.value,
      name: t.name,
      code: t.code ?? null,
      type: t.type ?? null,
    }));
    const selected = pickPreferredSalesTax(taxes);
    config.tax_id_sales = selected?.id ?? null;
    config.tax_value_sales = selected?.value ?? null;
    config.tax_code_sales = selected?.code ?? null;
    if (config.tax_id_sales === null) missing.push('tax_id_sales');
  } catch (err) {
    log({ event: 'discovery_failed', key: 'tax_id_sales', error: (err as Error).name });
    missing.push('tax_id_sales');
  }

  const rows = (await dbSelect('billing_integrations', 'provider=eq.bexio&select=config')) as {
    config: Record<string, unknown>;
  }[];
  const merged = { ...(rows[0]?.config ?? {}), ...config };
  await dbUpsertIntegration({ config: merged, last_successful_call_at: new Date().toISOString() });
  await dbInsertEvent('integration.initialized', { missing });

  return json({ config: merged, missing, config_complete: missing.length === 0 });
}

async function handleConfigure(body: { config?: Record<string, unknown> }): Promise<Response> {
  const incoming = body.config ?? {};
  const patch: Record<string, unknown> = {};
  for (const key of CONFIG_KEYS) {
    if (key in incoming) patch[key] = incoming[key];
  }
  if (Object.keys(patch).length === 0) return json({ error: 'no recognized config keys' }, 422);

  // Validate referenced resources exist before saving (cheap GETs).
  const client = makeClient();
  const invalid: string[] = [];
  const check = async (key: string, path: string): Promise<void> => {
    try {
      await client.request('GET', path);
    } catch {
      invalid.push(key);
    }
  };
  if (typeof patch.tax_id_sales === 'number') await check('tax_id_sales', `/3.0/taxes/${patch.tax_id_sales}`);
  if (typeof patch.currency_id === 'number') await check('currency_id', '/3.0/currencies');
  if (typeof patch.bank_account_id === 'number') await check('bank_account_id', '/3.0/banking/accounts');
  if (typeof patch.payment_type_id === 'number') await check('payment_type_id', '/2.0/payment_type');
  if (typeof patch.unit_id === 'number') await check('unit_id', '/2.0/unit');
  if (typeof patch.language_id === 'number') await check('language_id', '/2.0/language');
  if (typeof patch.country_id_ch === 'number') await check('country_id_ch', '/2.0/country');
  if (invalid.length > 0) return json({ error: 'invalid config references', invalid }, 422);

  const rows = (await dbSelect('billing_integrations', 'provider=eq.bexio&select=config')) as {
    config: Record<string, unknown>;
  }[];
  const merged = { ...(rows[0]?.config ?? {}), ...patch };
  await dbUpsertIntegration({ config: merged });
  await dbInsertEvent('integration.configured', { keys: Object.keys(patch) });

  const missing = missingConfigKeys(merged);
  return json({ config: merged, missing, config_complete: missing.length === 0 });
}

async function handleDisconnect(userId: string): Promise<Response> {
  await deleteSecret(REFRESH_TOKEN_NAME);
  await deleteSecret(ACCESS_CACHE_NAME);
  await dbUpsertIntegration({
    status: 'disconnected',
    refresh_token_secret: null,
    access_token_secret: null,
    last_error: null,
  });
  await dbInsertEvent('integration.disconnected', {}, userId);
  return json({ ok: true });
}

// --- Entry point --------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);

  try {
    // Browser redirect callback — authenticated by the signed state nonce.
    if (req.method === 'GET' && url.pathname.endsWith(CALLBACK_SUFFIX)) {
      return await handleCallback(url);
    }

    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    const admin = await requireAdmin(req);
    if (admin instanceof Response) return admin;

    const body = (await req.json().catch(() => ({}))) as { action?: string; config?: Record<string, unknown> };
    switch (body.action) {
      case 'start':
        return await handleStart(admin.userId);
      case 'status':
        return await handleStatus();
      case 'initialize':
        return await handleInitialize();
      case 'configure':
        return await handleConfigure(body);
      case 'disconnect':
        return await handleDisconnect(admin.userId);
      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (err) {
    log({ event: 'unhandled_error', error: (err as Error).name });
    return json({ error: (err as Error).message }, 500);
  }
});
