import { draftsFromCharges, type ChargeIntentSource, type PeriodIntentDraft } from '../_shared/billing/charge-intent-copy.ts';
import { CollectionChannelNotConfiguredError, type CollectionChannel } from '../_shared/billing/collection-channel.ts';
import {
  acceptChannelObservation,
  settleMembershipRail,
  shouldSubmitCollection,
  type MembershipMoneyDecision,
} from '../_shared/billing/membership-collection-policy.ts';

export interface CollectionIntentRow {
  id: string;
  method: 'automatic_collection' | 'qr_invoice' | null;
  clientActive: boolean;
  mandateStatus: string | null;
  intentStatus: string;
  hasCollectionRequest: boolean;
  stopped: boolean;
}

export interface MandatePollRow {
  id: string;
  externalRef: string | null;
  channelStatusAt: string | null;
}

export interface SubmittedCollectionRow {
  requestId: string;
  intentId: string;
  externalRef: string | null;
  channelStatusAt: string | null;
  intentStatus: string;
  chargeIntentId: string | null;
  subjectId: string;
  clientId: string;
  hasConfirmedSignal: boolean;
  hasReversedSignal: boolean;
  confirmedSource: 'collection_channel' | 'accounting_reconciliation' | null;
}

export interface CollectionRunDeps {
  channel: CollectionChannel;
  authorize(secret: string | null): Promise<boolean>;
  listCharges(): Promise<ChargeIntentSource[]>;
  listCopiedChargeIds(): Promise<string[]>;
  insertDrafts(drafts: PeriodIntentDraft[]): Promise<void>;
  listIntents(): Promise<CollectionIntentRow[]>;
  issueInvoice(intentId: string): Promise<void>;
  submitCollection(intentId: string): Promise<void>;
  listMandates(): Promise<MandatePollRow[]>;
  applyMandate(id: string, status: string, observedAt: string, failureReason: string | null): Promise<void>;
  listSubmitted(): Promise<SubmittedCollectionRow[]>;
  applyCollection(
    row: SubmittedCollectionRow,
    decision: MembershipMoneyDecision,
    requestStatus: string,
  ): Promise<void>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const FAILED_COLLECTION: MembershipMoneyDecision = {
  intentStatus: 'collection_failed',
  signal: null,
  duplicateReceipt: false,
  setPaidAt: false,
  clearPaidAt: false,
};

export async function handleCollectionRun(req: Request, deps: CollectionRunDeps): Promise<Response> {
  const allowed = await deps.authorize(req.headers.get('x-scheduler-secret'));
  if (!allowed) return json({ error: 'unauthorized' }, 401);

  let polled = 0;
  if (deps.channel.isConfigured()) {
    for (const mandate of await deps.listMandates()) {
      if (!mandate.externalRef) continue;
      try {
        const observed = await deps.channel.readMandate(mandate.externalRef);
        if (!acceptChannelObservation(observed.observedAt, mandate.channelStatusAt)) continue;
        await deps.applyMandate(mandate.id, observed.status, observed.observedAt, observed.failureReason);
        polled += 1;
      } catch (error) {
        if (error instanceof CollectionChannelNotConfiguredError) break;
        throw error;
      }
    }
  }

  const charges = await deps.listCharges();
  const copied = new Set(await deps.listCopiedChargeIds());
  const drafts = draftsFromCharges(charges, copied);
  await deps.insertDrafts(drafts);

  const intents = await deps.listIntents();
  let issued = 0;
  let submitted = 0;
  let failed = 0;
  for (const intent of intents) {
    try {
      if (intent.intentStatus === 'pending') {
        await deps.issueInvoice(intent.id);
        issued += 1;
      }
      if (shouldSubmitCollection({ ...intent, channelConfigured: deps.channel.isConfigured() })) {
        await deps.submitCollection(intent.id);
        submitted += 1;
      }
    } catch (error) {
      if (error instanceof CollectionChannelNotConfiguredError) continue;
      failed += 1;
    }
  }

  if (deps.channel.isConfigured()) {
    for (const row of await deps.listSubmitted()) {
      if (!row.externalRef) continue;
      try {
        const observed = await deps.channel.readCollection(row.externalRef);
        if (!acceptChannelObservation(observed.observedAt, row.channelStatusAt)) continue;
        if (observed.status === 'confirmed') {
          const decision = settleMembershipRail({
            invoiceStatus: 'paid',
            intentStatus: row.intentStatus,
            hasConfirmedSignal: row.hasConfirmedSignal,
            hasReversedSignal: row.hasReversedSignal,
            confirmedSource: row.confirmedSource,
            rail: 'collection_channel',
          });
          await deps.applyCollection(row, decision, 'confirmed');
        } else if (observed.status === 'failed' || observed.status === 'rejected') {
          await deps.applyCollection(row, FAILED_COLLECTION, observed.status);
        }
        polled += 1;
      } catch (error) {
        if (error instanceof CollectionChannelNotConfiguredError) break;
        throw error;
      }
    }
  }

  return json({ copied: drafts.length, considered: intents.length, issued, submitted, failed, polled });
}

if (import.meta.main) {
  const { serveCollectionRun } = await import('./serve.ts');
  serveCollectionRun();
}
