/**
 * camp-admin — Camp configuration, waitlist, registrations, export (F1.25).
 * Contract: specs/features/010-padel-camps/contracts/edge-functions.md §3
 */

import {
  type AccountingProvider,
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
  CampNotBillableError,
  createPostgrestRepo,
  issueInvoiceForCampRegistration,
} from "../_shared/billing/financial-service.ts";
import { canAdminister, parseProfileAccess } from "../_shared/profile-access.ts";
import { mapCampDbError, validateCampPayload, validateExtraPayload } from "../_shared/camps/validate.ts";

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
  console.log(JSON.stringify({ component: "camp-admin", ...event }));
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

async function dbWrite(path: string, method: string, body?: unknown, extra = ""): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${extra}`, {
    method,
    headers: { ...headers, Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const mapped = mapCampDbError(text);
    const err = new Error(mapped || `db write ${path} failed: ${res.status}`);
    (err as Error & { code?: string }).code = mapped ?? undefined;
    throw err;
  }
  return (await res.json().catch(() => [])) as Record<string, unknown>[];
}

async function resolveCaller(
  req: Request,
): Promise<{ userId: string; role: string; isActive: boolean; exists: boolean } | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return null;
  const rows = await dbSelect("profiles", `id=eq.${user.id}&select=role,is_active`);
  const access = parseProfileAccess(rows[0] as { role?: unknown; is_active?: unknown } | undefined);
  return { userId: user.id, role: access.role, isActive: access.isActive, exists: access.exists };
}

function childAgeAt(startDate: string | null, dob: string | null): number | null {
  if (!startDate || !dob) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const born = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(born.getTime())) return null;
  let age = start.getUTCFullYear() - born.getUTCFullYear();
  const m = start.getUTCMonth() - born.getUTCMonth();
  if (m < 0 || (m === 0 && start.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

function remainingPlaces(capacity: number, active: number): number {
  return Math.max(capacity - active, 0);
}

async function loadConfig(): Promise<BexioConfig> {
  const rows = await dbSelect("billing_integrations", "provider=eq.bexio&select=config,status");
  const row = rows[0];
  if (!row || (row.status !== "connected" && row.status !== "degraded")) {
    throw new ProviderConfigError("bexio integration is not connected", ["status"]);
  }
  return (row.config ?? {}) as unknown as BexioConfig;
}

function makeProvider(config: BexioConfig): AccountingProvider {
  const client = new BexioClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    refreshTokenName: "bexio_refresh_token",
    accessCacheName: "bexio_access_token_cache",
    readSecret,
    writeSecret,
  });
  return new BexioAdapter(client, config);
}

async function rpcRegister(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_camp_child`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(mapCampDbError(text) || "register_failed"), {
      code: mapCampDbError(text),
    });
  }
  const id = await res.json();
  return String(id);
}

function authorizedRegistrationRow(
  camp: Record<string, unknown>,
  row: Record<string, unknown>,
  remaining: number,
): Record<string, unknown> {
  const extras = Array.isArray(row.camp_registration_extras)
    ? (row.camp_registration_extras as { name?: string }[]).map((e) => e.name).filter(Boolean)
    : [];
  const docs = row.billing_documents;
  const doc = Array.isArray(docs) ? docs[0] : docs;
  const document = (doc ?? null) as { status?: string; document_nr?: string } | null;
  return {
    registration_id: row.id,
    camp_name: camp.name,
    child_first_name: row.child_first_name,
    child_last_name: row.child_last_name,
    child_age: childAgeAt(String(row.camp_start_date ?? camp.start_date ?? ""), row.child_date_of_birth as string | null),
    parent_full_name: row.parent_full_name,
    parent_phone: row.parent_phone,
    parent_email: row.parent_email,
    padel_level: row.padel_level,
    extras,
    total_amount: row.total_amount,
    currency: row.currency,
    payment_status: row.payment_status,
    document_status: document?.status ?? null,
    document_nr: document?.document_nr ?? null,
    registration_date: row.created_at,
    remaining_places: remaining,
    status: row.status,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await resolveCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);
    if (!canAdminister({ role: caller.role, isActive: caller.isActive, exists: caller.exists })) {
      return json({ error: "forbidden" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "upsert_camp") {
      const parsed = validateCampPayload(body.camp);
      if (!parsed.ok) return json({ error: parsed.error }, 422);
      const row = { ...parsed.camp, updated_at: new Date().toISOString() };
      const saved = parsed.camp.id
        ? await dbWrite("camps", "PATCH", row, `?id=eq.${parsed.camp.id}`)
        : await dbWrite("camps", "POST", row);
      return json({ camp: saved[0] ?? row });
    }

    if (action === "upsert_extra") {
      const campId = typeof body.camp_id === "string" ? body.camp_id : "";
      if (!campId) return json({ error: "camp_id required" }, 422);
      const parsed = validateExtraPayload(body.extra);
      if (!parsed.ok) return json({ error: parsed.error }, 422);
      const row = { ...parsed.extra, camp_id: campId, updated_at: new Date().toISOString() };
      const saved = parsed.extra.id
        ? await dbWrite("camp_extras", "PATCH", row, `?id=eq.${parsed.extra.id}`)
        : await dbWrite("camp_extras", "POST", row);
      return json({ extra: saved[0] ?? row });
    }

    if (action === "remove_extra") {
      const extraId = typeof body.extra_id === "string" ? body.extra_id : "";
      if (!extraId) return json({ error: "extra_id required" }, 422);
      await dbWrite("camp_extras", "DELETE", undefined, `?id=eq.${extraId}`);
      return json({ removed: true });
    }

    if (action === "list_camps") {
      const camps = await dbSelect("camps", "select=*&order=start_date.desc");
      const extras = await dbSelect("camp_extras", "select=*&order=sort_order.asc");
      return json({
        camps: camps.map((camp) => ({
          ...camp,
          extras: extras.filter((e) => e.camp_id === camp.id),
        })),
      });
    }

    if (action === "list_registrations" || action === "export_registrations") {
      const campId = typeof body.camp_id === "string" ? body.camp_id : "";
      if (!campId) return json({ error: "camp_id required" }, 422);
      const camps = await dbSelect("camps", `id=eq.${campId}&select=*`);
      const camp = camps[0];
      if (!camp) return json({ error: "not_found" }, 404);
      const statusFilter = typeof body.status === "string" && body.status
        ? `&status=eq.${encodeURIComponent(body.status)}`
        : "";
      const rows = await dbSelect(
        "camp_registrations",
        `camp_id=eq.${campId}${statusFilter}&select=*,camp_registration_extras(name,price_amount),billing_documents(status,document_nr)&order=created_at.asc`,
      );
      const activeRows = statusFilter
        ? await dbSelect(
            "camp_registrations",
            `camp_id=eq.${campId}&or=(status.eq.pending_payment,status.eq.confirmed)&select=id`,
          )
        : rows.filter((r) => r.status === "pending_payment" || r.status === "confirmed");
      const remaining = remainingPlaces(Number(camp.max_capacity), activeRows.length);
      const registrations = rows.map((row) => authorizedRegistrationRow(camp, row, remaining));
      return json({ registrations, remaining_places: remaining });
    }

    if (action === "list_waitlist") {
      const campId = typeof body.camp_id === "string" ? body.camp_id : "";
      if (!campId) return json({ error: "camp_id required" }, 422);
      const entries = await dbSelect(
        "camp_waitlist_entries",
        `camp_id=eq.${campId}&select=id,camp_id,child_id,parent_id,status,created_at&order=created_at.asc`,
      );
      return json({ entries });
    }

    if (action === "convert_waitlist") {
      const entryId = typeof body.entry_id === "string" ? body.entry_id : "";
      if (!entryId) return json({ error: "entry_id required" }, 422);
      const entries = await dbSelect("camp_waitlist_entries", `id=eq.${entryId}&select=*`);
      const entry = entries[0];
      if (!entry) return json({ error: "not_found" }, 404);
      if (entry.status !== "active") return json({ error: "not_found", message: "entry is not active" }, 409);

      const registrationId = await rpcRegister({
        p_camp_id: entry.camp_id,
        p_child_id: entry.child_id,
        p_parent_id: entry.parent_id,
        p_extra_ids: [],
        p_terms_version: "admin-convert",
      });

      let document = null;
      try {
        const config = await loadConfig();
        const issued = await issueInvoiceForCampRegistration({
          provider: makeProvider(config),
          repo: createPostgrestRepo(SUPABASE_URL, SERVICE_ROLE_KEY),
          config,
        }, registrationId);
        document = {
          id: issued.document.id ?? null,
          document_nr: issued.document.document_nr,
          status: issued.document.status,
          total: issued.document.total,
          currency: issued.document.currency,
        };
      } catch (err) {
        if (err instanceof ProviderConfigError) {
          log({ event: "convert_invoice_skipped", error: "integration_not_configured" });
        } else if (
          err instanceof ProviderAuthError ||
          err instanceof ProviderUnavailableError ||
          err instanceof ProviderClientError ||
          err instanceof CampNotBillableError
        ) {
          log({ event: "convert_invoice_enqueued_or_failed", error: err.name });
        } else {
          throw err;
        }
      }

      await dbWrite("camp_waitlist_entries", "PATCH", {
        status: "converted",
        updated_at: new Date().toISOString(),
      }, `?id=eq.${entryId}`);

      return json({ registration_id: registrationId, document });
    }

    return json({ error: "unknown_action" }, 422);
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code) return json({ error: code }, 409);
    log({ event: "unhandled_error", error: (err as Error).name, message: (err as Error).message });
    return json({ error: "internal_error" }, 500);
  }
});
