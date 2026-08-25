/**
 * bexio-reconcile — scheduled payment sync + retry queue (US4).
 * Contract: specs/features/007-bexio-integration/contracts/edge-functions.md §4.
 *
 * POST {}
 *   → 200 { checked, confirmed, retried, failed_operations }
 *   → 401 unauthenticated
 *   → 503 { error: "requires_reauth" }
 *
 * Auth: x-scheduler-secret (Vault) OR admin JWT. verify_jwt is off so the
 * pg_cron/pg_net job can call without a user token (research R-09).
 */

import {
  ProviderAuthError,
  ProviderConfigError,
} from './accounting-provider.ts';
import { BexioClient } from './bexio-client.ts';
import { BexioAdapter } from './bexio-adapter.ts';
import type { BexioConfig } from './bexio-mappers.ts';
import { readSecret, writeSecret } from './vault.ts';
import { createPostgrestRepo } from './financial-service.ts';
import {
  createPostgrestReconcileRepo,
  runReconciliation,
} from './reconciliation-service.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLIENT_ID = Deno.env.get('BEXIO_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('BEXIO_CLIENT_SECRET') ?? '';
const SCHEDULER_SECRET_NAME = 'bexio_scheduler_secret';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-scheduler-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ component: 'bexio-reconcile', ...event }));
}

function secretsEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

async function dbSelect(table: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`db select ${table} failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>[];
}

async function isAdminJwt(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return false;
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return false;
  const rows = await dbSelect('profiles', `id=eq.${user.id}&select=role`);
  return rows[0]?.role === 'admin';
}

async function isScheduler(req: Request): Promise<boolean> {
  const header = (req.headers.get('x-scheduler-secret') ?? '').trim();
  if (!header) return false;
  const stored = ((await readSecret(SCHEDULER_SECRET_NAME)) ?? '').trim();
  if (!stored) return false;
  return secretsEqual(header, stored);
}

async function loadConfig(): Promise<BexioConfig> {
  const rows = await dbSelect('billing_integrations', 'provider=eq.bexio&select=config,status');
  const row = rows[0];
  if (!row || (row.status !== 'connected' && row.status !== 'degraded')) {
    throw new ProviderConfigError('bexio integration is not connected', ['status']);
  }
  return (row.config ?? {}) as unknown as BexioConfig;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const allowed = (await isScheduler(req)) || (await isAdminJwt(req));
    if (!allowed) return json({ error: 'unauthenticated' }, 401);

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
    const result = await runReconciliation({
      provider,
      repo: createPostgrestReconcileRepo(SUPABASE_URL, SERVICE_ROLE_KEY),
      billingRepo: createPostgrestRepo(SUPABASE_URL, SERVICE_ROLE_KEY),
      config,
    });

    if (result.requires_reauth) {
      return json({ error: 'requires_reauth' }, 503);
    }
    return json({
      checked: result.checked,
      confirmed: result.confirmed,
      retried: result.retried,
      failed_operations: result.failed_operations,
    });
  } catch (err) {
    if (err instanceof ProviderConfigError) {
      return json({ error: 'integration_not_configured', missing: err.missing }, 409);
    }
    if (err instanceof ProviderAuthError) {
      return json({ error: 'requires_reauth' }, 503);
    }
    log({ event: 'unhandled_error', error: (err as Error).name });
    return json({ error: 'internal_error' }, 500);
  }
});
