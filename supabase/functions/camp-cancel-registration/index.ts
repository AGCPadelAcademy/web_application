/**
 * camp-cancel-registration — unpaid cancel by the registering parent (F1.25 US6).
 * Contract: specs/features/010-padel-camps/contracts/edge-functions.md §2
 */

import {
  ProviderAuthError,
  ProviderClientError,
  ProviderConfigError,
  ProviderUnavailableError,
} from "../_shared/billing/accounting-provider.ts";
import { BexioClient } from "../_shared/billing/bexio/bexio-client.ts";
import { BexioAdapter } from "../_shared/billing/bexio/bexio-adapter.ts";
import type { BexioConfig } from "../_shared/billing/bexio/bexio-mappers.ts";
import { readSecret, writeSecret } from "../_shared/billing/vault.ts";
import {
  cancelInvoiceForCampRegistration,
  createPostgrestRepo,
  InvoiceCancelConflictError,
} from "../_shared/billing/financial-service.ts";
import { canMutateOwnedResource, parseProfileAccess } from "../_shared/profile-access.ts";
import { mapCancelConflict } from "../_shared/camps/validate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLIENT_ID = Deno.env.get("BEXIO_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("BEXIO_CLIENT_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function log(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ component: "camp-cancel-registration", ...event }));
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function dbSelect(table: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers });
  if (!res.ok) throw new Error(`db select ${table} failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthenticated" }, 401);
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: "unauthenticated" }, 401);
    const user = (await userRes.json()) as { id?: string };
    if (!user.id) return json({ error: "unauthenticated" }, 401);
    const profiles = await dbSelect("profiles", `id=eq.${user.id}&select=role,is_active`);
    const access = parseProfileAccess(profiles[0] as { role?: unknown; is_active?: unknown } | undefined);

    const body = (await req.json().catch(() => ({}))) as { registration_id?: string };
    if (!body.registration_id) return json({ error: "registration_id required" }, 422);

    const regs = await dbSelect(
      "camp_registrations",
      `id=eq.${body.registration_id}&select=id,parent_id,status,payment_status`,
    );
    const registration = regs[0];
    if (!registration) return json({ error: "not_found" }, 404);
    if (
      !canMutateOwnedResource(
        { role: access.role, isActive: access.isActive, exists: access.exists },
        registration.parent_id === user.id,
      )
    ) {
      return json({ error: "forbidden" }, 403);
    }

    const configRows = await dbSelect("billing_integrations", "provider=eq.bexio&select=config,status");
    const row = configRows[0];
    if (!row || (row.status !== "connected" && row.status !== "degraded")) {
      throw new ProviderConfigError("bexio integration is not connected", ["status"]);
    }
    const config = (row.config ?? {}) as unknown as BexioConfig;
    const client = new BexioClient({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      refreshTokenName: "bexio_refresh_token",
      accessCacheName: "bexio_access_token_cache",
      readSecret,
      writeSecret,
    });
    const provider = new BexioAdapter(client, config);
    const result = await cancelInvoiceForCampRegistration({
      provider,
      repo: createPostgrestRepo(SUPABASE_URL, SERVICE_ROLE_KEY),
      config,
    }, body.registration_id);

    return json({
      outcome: result.outcome,
      reused: result.reused,
      document: result.document
        ? {
          id: result.document.id ?? null,
          document_nr: result.document.document_nr,
          status: result.document.status,
          total: result.document.total,
          currency: result.document.currency,
        }
        : null,
    });
  } catch (err) {
    if (err instanceof InvoiceCancelConflictError) {
      const mapped = mapCancelConflict(err.code);
      return json({ error: mapped.error }, mapped.status);
    }
    if (err instanceof ProviderConfigError) {
      return json({ error: "integration_not_configured" }, 409);
    }
    if (err instanceof ProviderAuthError || err instanceof ProviderUnavailableError) {
      return json({ error: "provider_unavailable", outcome: "cancelled" }, 502);
    }
    if (err instanceof ProviderClientError) {
      return json({ error: "cancel_refused" }, 409);
    }
    log({ event: "unhandled_error", error: (err as Error).name, message: (err as Error).message });
    return json({ error: "internal_error" }, 500);
  }
});
