import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { UnconfiguredCollectionChannel, type CollectionChannel } from '../_shared/billing/collection-channel.ts';
import type { ChargeIntentSource } from '../_shared/billing/charge-intent-copy.ts';
import {
  handleCollectionRun,
  type CollectionRunDeps,
  type SubmittedCollectionRow,
} from './index.ts';

const CHARGE: ChargeIntentSource = {
  id: 'charge-month',
  membershipId: 'membership-1',
  clientId: 'client-1',
  periodKey: '2026-08',
  kind: 'month',
  amount: 200,
  currency: 'CHF',
  displayLabel: 'Tuesday Adults',
};

const FEE: ChargeIntentSource = {
  ...CHARGE,
  id: 'charge-fee',
  periodKey: '2026-08:fee',
  kind: 'cancel_fee',
  amount: 20,
  displayLabel: 'Tuesday Adults',
};

function baseDeps(overrides: Partial<CollectionRunDeps> = {}): CollectionRunDeps & {
  issued: string[];
  submittedIds: string[];
  drafts: number;
} {
  const issued: string[] = [];
  const submittedIds: string[] = [];
  const state = { drafts: 0 };
  return {
    channel: new UnconfiguredCollectionChannel(),
    authorize: async () => true,
    listCharges: async () => [CHARGE, FEE],
    listCopiedChargeIds: async () => [],
    insertDrafts: async (drafts) => {
      state.drafts += drafts.length;
    },
    listIntents: async () => [{
      id: 'intent-1',
      method: 'qr_invoice',
      clientActive: true,
      mandateStatus: null,
      intentStatus: 'pending',
      hasCollectionRequest: false,
      stopped: true,
    }],
    issueInvoice: async (id) => {
      issued.push(id);
    },
    submitCollection: async (id) => {
      submittedIds.push(id);
    },
    listMandates: async () => [],
    applyMandate: async () => {},
    listSubmitted: async () => [],
    applyCollection: async () => {},
    issued,
    submittedIds,
    get drafts() {
      return state.drafts;
    },
    ...overrides,
  };
}

Deno.test('the scheduler secret is required', async () => {
  const deps = baseDeps({ authorize: async () => false });
  const response = await handleCollectionRun(new Request('http://local/run', { method: 'POST' }), deps);
  assertEquals(response.status, 401);
  assertEquals(deps.issued, []);
});

Deno.test('an unconfigured channel still copies and issues, and does not collect', async () => {
  const deps = baseDeps();
  const response = await handleCollectionRun(new Request('http://local/run', {
    method: 'POST',
    headers: { 'x-scheduler-secret': 'secret' },
  }), deps);
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.copied, 2);
  assertEquals(deps.issued, ['intent-1']);
  assertEquals(deps.submittedIds, []);
  assertEquals(body.submitted, 0);
});

Deno.test('a second copy does not insert the fee or the month again', async () => {
  const deps = baseDeps({
    listCopiedChargeIds: async () => ['charge-month', 'charge-fee'],
    listIntents: async () => [{
      id: 'intent-1',
      method: 'automatic_collection',
      clientActive: true,
      mandateStatus: 'active',
      intentStatus: 'invoiced',
      hasCollectionRequest: false,
      stopped: false,
    }],
  });
  const response = await handleCollectionRun(new Request('http://local/run', { method: 'POST' }), deps);
  const body = await response.json();
  assertEquals(body.copied, 0);
  assertEquals(deps.issued, []);
  assertEquals(deps.submittedIds, []);
});

Deno.test('a configured channel submits once and ignores a stale collection snapshot', async () => {
  const applied: string[] = [];
  const channel: CollectionChannel = {
    isConfigured: () => true,
    proposeMandate: () => Promise.reject(new Error('unused')),
    readMandate: () => Promise.resolve({
      status: 'active',
      failureReason: null,
      observedAt: '2026-08-01T00:00:00.000Z',
    }),
    submitCollection: () => Promise.reject(new Error('unused')),
    readCollection: () => Promise.resolve({
      status: 'confirmed',
      failureReason: null,
      observedAt: '2026-08-01T00:00:00.000Z',
    }),
  };
  const submitted: SubmittedCollectionRow = {
    requestId: 'request-1',
    intentId: 'intent-1',
    externalRef: 'col-1',
    channelStatusAt: '2026-09-01T00:00:00.000Z',
    intentStatus: 'collection_submitted',
    chargeIntentId: 'charge-month',
    subjectId: 'subject-1',
    clientId: 'client-1',
    hasConfirmedSignal: false,
    hasReversedSignal: false,
    confirmedSource: null,
  };
  const deps = baseDeps({
    channel,
    listMandates: async () => [{
      id: 'mandate-1',
      externalRef: 'man-1',
      channelStatusAt: '2026-09-01T00:00:00.000Z',
    }],
    listSubmitted: async () => [submitted],
    applyMandate: async () => {
      applied.push('mandate');
    },
    applyCollection: async (_row, decision) => {
      applied.push(decision.signal ?? 'none');
    },
    listIntents: async () => [{
      id: 'intent-1',
      method: 'automatic_collection',
      clientActive: true,
      mandateStatus: 'active',
      intentStatus: 'invoiced',
      hasCollectionRequest: false,
      stopped: false,
    }],
  });
  await handleCollectionRun(new Request('http://local/run', { method: 'POST' }), deps);
  assertEquals(deps.submittedIds, ['intent-1']);
  assertEquals(applied, []);
});
