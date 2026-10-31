/**
 * Production wiring for membership-collection-run.
 * Deploy with verify_jwt off, same as bexio-reconcile: the hourly job sends
 * x-scheduler-secret and no user JWT. The handler checks that secret.
 * The channel adapter shipped here is unconfigured, so polls and submits no-op
 * and QR invoices are still issued.
 */
import { UnconfiguredCollectionChannel } from '../_shared/billing/collection-channel.ts';
import { BexioClient } from '../_shared/billing/bexio/bexio-client.ts';
import { BexioAdapter } from '../_shared/billing/bexio/bexio-adapter.ts';
import type { BexioConfig } from '../_shared/billing/bexio/bexio-mappers.ts';
import { ProviderConfigError } from '../_shared/billing/accounting-provider.ts';
import {
  createMembershipInvoiceRepo,
  issueInvoiceForMembershipPeriod,
} from '../_shared/billing/financial-service.ts';
import { readSecret, writeSecret } from '../_shared/billing/vault.ts';
import {
  applyMandateObservation,
  applyMembershipDecision,
  insertPeriodDrafts,
  listChargeSources,
  listCopiedChargeIds,
  listMandatesToPoll,
  listRunnableIntents,
  listSubmittedCollections,
  loadMembershipIntent,
  schedulerAuthorized,
} from '../_shared/billing/membership-store.ts';
import { handleCollectionRun } from './index.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function loadConfig(): Promise<BexioConfig> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/billing_integrations?provider=eq.bexio&select=config,status`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  );
  if (!res.ok) throw new Error(`db select billing_integrations failed: ${res.status}`);
  const rows = await res.json() as Array<{ config: BexioConfig; status: string }>;
  const row = rows[0];
  if (!row || (row.status !== 'connected' && row.status !== 'degraded')) {
    throw new ProviderConfigError('bexio integration is not connected', ['status']);
  }
  return row.config ?? ({} as BexioConfig);
}

export function serveCollectionRun(): void {
  const channel = new UnconfiguredCollectionChannel();
  Deno.serve((req) => handleCollectionRun(req, {
    channel,
    authorize: (secret) => schedulerAuthorized(secret),
    listCharges: listChargeSources,
    listCopiedChargeIds,
    insertDrafts: insertPeriodDrafts,
    listIntents: listRunnableIntents,
    issueInvoice: async (intentId) => {
      const config = await loadConfig();
      const client = new BexioClient({
        clientId: Deno.env.get('BEXIO_CLIENT_ID') ?? '',
        clientSecret: Deno.env.get('BEXIO_CLIENT_SECRET') ?? '',
        refreshTokenName: 'bexio_refresh_token',
        accessCacheName: 'bexio_access_token_cache',
        readSecret,
        writeSecret,
      });
      await issueInvoiceForMembershipPeriod({
        provider: new BexioAdapter(client, config),
        repo: createMembershipInvoiceRepo(SUPABASE_URL, SERVICE_ROLE_KEY),
        config,
      }, intentId);
    },
    submitCollection: async () => {
      throw new Error('collection submit requires a configured channel');
    },
    listMandates: listMandatesToPoll,
    applyMandate: applyMandateObservation,
    listSubmitted: listSubmittedCollections,
    applyCollection: async (row, decision, requestStatus) => {
      const current = await loadMembershipIntent(row.intentId);
      await applyMembershipDecision({
        intentId: row.intentId,
        chargeIntentId: current?.chargeIntentId ?? row.chargeIntentId,
        subjectId: row.subjectId,
        clientId: row.clientId,
        decision,
        source: 'collection_channel',
        now: new Date(),
        requestId: row.requestId,
        requestStatus,
      });
    },
  }));
}
