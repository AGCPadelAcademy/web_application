/**
 * camp-submit-registration — parent registers a saved child (F1.25 US4/US5).
 * Contract: specs/features/010-padel-camps/contracts/edge-functions.md §1
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
  CampNotBillableError,
  createPostgrestRepo,
  issueInvoiceForCampRegistration,
  type BillingDocumentRow,
} from "../_shared/billing/financial-service.ts";
import {
  invoiceEmailHtml,
  invoiceEmailSubject,
  sendTransactionalEmail,
} from "../_shared/billing/mailer.ts";
import { canMutateOwnedResource, parseProfileAccess } from "../_shared/profile-access.ts";
import { isBillingProfileComplete, mapSubmitError } from "../_shared/camps/validate.ts";

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
  console.log(JSON.stringify({ component: "camp-submit-registration", ...event }));
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

async function resolveCaller(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return null;
  const rows = await dbSelect(
    "profiles",
    `id=eq.${user.id}&select=role,is_active,first_name,last_name,phone,address,postal_code,city,country_code,email,full_name`,
  );
  const access = parseProfileAccess(rows[0] as { role?: unknown; is_active?: unknown } | undefined);
  return { userId: user.id, profile: rows[0] ?? null, ...access };
}

async function insertNotification(row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications_log`, {
    method: "POST",
    headers,
    body: JSON.stringify(row),
  });
  if (!res.ok) log({ event: "notification_log_failed", status: res.status });
}

async function maybeEmailInvoicePdf(opts: {
  registrationId: string;
  userId: string;
  document: BillingDocumentRow;
  getPdf: () => Promise<{ bytes: Uint8Array; fileName: string }>;
}): Promise<void> {
  const subject = invoiceEmailSubject(opts.document.document_nr);
  try {
    const already = await dbSelect(
      "notifications_log",
      `camp_registration_id=eq.${opts.registrationId}&status=eq.sent&message_subject=like.${
        encodeURIComponent("Your AGC invoice")
      }*&select=id`,
    );
    if (already.length > 0) {
      log({ event: "invoice_email_skipped", registrationId: opts.registrationId, reason: "already_sent" });
      return;
    }
    const profiles = await dbSelect("profiles", `id=eq.${opts.userId}&select=email,full_name,first_name`);
    const profile = profiles[0];
    const to = typeof profile?.email === "string" ? profile.email : "";
    if (!to) return;
    const pdf = await opts.getPdf();
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim() || null;
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
        attachments: [{ filename: pdf.fileName || `${opts.document.document_nr ?? "invoice"}.pdf`, bytes: pdf.bytes }],
      },
      { sendgridKey: null, resendKey },
    );
    await insertNotification({
      camp_registration_id: opts.registrationId,
      notification_type: "email",
      recipient_type: "client",
      recipient_email: to,
      message_subject: subject,
      status: result.sent ? "sent" : "failed",
      error_message: result.error ?? null,
      sent_at: result.sent ? new Date().toISOString() : null,
    });
  } catch (err) {
    log({ event: "invoice_email_failed", error: (err as Error).name });
    try {
      await insertNotification({
        camp_registration_id: opts.registrationId,
        notification_type: "email",
        recipient_type: "client",
        message_subject: subject,
        status: "failed",
        error_message: (err as Error).message,
      });
    } catch { /* audit best-effort */ }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await resolveCaller(req);
    if (!caller) return json({ error: "unauthenticated" }, 401);
    if (!caller.isActive) return json({ error: "profile_inactive" }, 403);

    const body = (await req.json().catch(() => ({}))) as {
      camp_id?: string;
      child_id?: string;
      extra_ids?: string[];
      terms_version?: string;
      terms_accepted?: boolean;
    };
    if (!body.camp_id || !body.child_id) return json({ error: "camp_id and child_id required" }, 422);
    if (body.terms_accepted !== true || !body.terms_version) {
      return json({ error: "terms_required" }, 422);
    }

    const children = await dbSelect(
      "children",
      `id=eq.${body.child_id}&select=id,parent_id,archived_at`,
    );
    const child = children[0];
    if (!child) return json({ error: "not_found" }, 404);
    if (
      !canMutateOwnedResource(
        { role: caller.role, isActive: caller.isActive, exists: caller.exists },
        child.parent_id === caller.userId,
      )
    ) {
      return json({ error: "forbidden" }, 403);
    }
    if (child.archived_at) return json({ error: "child_archived" }, 409);
    if (!isBillingProfileComplete(caller.profile as Record<string, unknown> | null)) {
      return json({ error: "profile_incomplete" }, 409);
    }

    const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_camp_child`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_camp_id: body.camp_id,
        p_child_id: body.child_id,
        p_parent_id: caller.userId,
        p_extra_ids: Array.isArray(body.extra_ids) ? body.extra_ids : [],
        p_terms_version: body.terms_version,
      }),
    });
    if (!rpc.ok) {
      const text = await rpc.text().catch(() => "");
      const mapped = mapSubmitError(text);
      return json({ error: mapped.error }, mapped.status);
    }
    const registrationId = String(await rpc.json());
    const regs = await dbSelect(
      "camp_registrations",
      `id=eq.${registrationId}&select=id,camp_id,child_id,status,total_amount,currency`,
    );
    const registration = regs[0];

    let document: {
      id: string | null;
      document_nr: string | null;
      status: string;
      total: number;
      currency: string;
    } | null = null;
    let reused = false;

    try {
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
      const issued = await issueInvoiceForCampRegistration({
        provider,
        repo: createPostgrestRepo(SUPABASE_URL, SERVICE_ROLE_KEY),
        config,
      }, registrationId);
      reused = issued.reused;
      document = {
        id: issued.document.id ?? null,
        document_nr: issued.document.document_nr,
        status: issued.document.status,
        total: issued.document.total,
        currency: issued.document.currency,
      };
      await maybeEmailInvoicePdf({
        registrationId,
        userId: caller.userId,
        document: issued.document,
        getPdf: () => provider.getInvoicePdf({ externalId: issued.document.external_id }),
      });
    } catch (err) {
      if (err instanceof ProviderConfigError) {
        log({ event: "invoice_skipped", error: "integration_not_configured" });
      } else if (err instanceof ProviderAuthError || err instanceof ProviderUnavailableError) {
        return json({
          registration,
          document: null,
          reused: false,
          error: "provider_unavailable",
        }, 502);
      } else if (err instanceof ProviderClientError || err instanceof CampNotBillableError) {
        log({ event: "invoice_failed", error: err.name });
      } else {
        throw err;
      }
    }

    return json({ registration, document, reused });
  } catch (err) {
    log({ event: "unhandled_error", error: (err as Error).name, message: (err as Error).message });
    return json({ error: "internal_error" }, 500);
  }
});
