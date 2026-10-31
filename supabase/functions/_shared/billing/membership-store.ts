import type { ChargeIntentSource, PeriodIntentDraft } from './charge-intent-copy.ts';
import type { MembershipMoneyDecision, PaymentRail } from './membership-collection-policy.ts';
import type { MandateStatus } from './mandate-attempts.ts';
import { readSecret } from './vault.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function headers(extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function rest(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: headers(init.headers as Record<string, string> | undefined),
  });
  if (!res.ok) throw new Error(`rest ${path} failed: ${res.status}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function callerIdFromRequest(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json() as { id?: string };
  return user.id ?? null;
}

export async function loadCollectionSubject(subjectId: string, callerId: string) {
  const subjects = await rest(
    `collection_subjects?id=eq.${subjectId}&select=id,client_id,profiles:client_id(is_active)`,
  ) as Array<{ id: string; client_id: string; profiles: { is_active: boolean } | { is_active: boolean }[] | null }>;
  const subject = subjects[0];
  if (!subject) return null;
  const callerRows = await rest(`profiles?id=eq.${callerId}&select=role,is_active`) as Array<{ role: string; is_active: boolean }>;
  const caller = callerRows[0];
  const methods = await rest(`collection_methods?subject_id=eq.${subjectId}&select=method`) as Array<{ method: 'automatic_collection' | 'qr_invoice' }>;
  const mandates = await rest(
    `direct_debit_mandates?subject_id=eq.${subjectId}&select=attempt_no,status&order=attempt_no.asc`,
  ) as Array<{ attempt_no: number; status: string }>;
  const profile = Array.isArray(subject.profiles) ? subject.profiles[0] : subject.profiles;
  return {
    id: subject.id,
    client_id: subject.client_id,
    client_active: profile?.is_active === true,
    caller_role: caller?.role ?? 'student',
    caller_active: caller?.is_active === true,
    caller_exists: Boolean(caller),
    method: methods[0]?.method ?? null,
    attempts: mandates.map((row) => ({
      attemptNo: row.attempt_no,
      status: row.status as MandateStatus,
    })),
  };
}

export async function saveCollectionMethod(
  subjectId: string,
  method: 'automatic_collection' | 'qr_invoice',
  stopped: boolean,
  updatedBy: string,
): Promise<void> {
  const existing = await rest(`collection_methods?subject_id=eq.${subjectId}&select=id`) as Array<{ id: string }>;
  const body = {
    subject_id: subjectId,
    method,
    stopped_at: stopped ? new Date().toISOString() : null,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };
  if (existing[0]) {
    await rest(`collection_methods?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    return;
  }
  await rest('collection_methods', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
}

export async function insertMandateProposal(subjectId: string, attemptNo: number): Promise<void> {
  await rest('direct_debit_mandates', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ subject_id: subjectId, attempt_no: attemptNo, status: 'proposal_sent' }),
  });
}

function secretsEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

export async function schedulerAuthorized(header: string | null): Promise<boolean> {
  const presented = (header ?? '').trim();
  if (!presented) return false;
  const stored = ((await readSecret('bexio_scheduler_secret')) ?? '').trim();
  if (!stored) return false;
  return secretsEqual(presented, stored);
}

export interface MembershipIntentSnapshot {
  status: string;
  chargeIntentId: string | null;
  subjectId: string;
  clientId: string;
  hasConfirmedSignal: boolean;
  hasReversedSignal: boolean;
  confirmedSource: PaymentRail | null;
}

export async function loadMembershipIntent(intentId: string): Promise<MembershipIntentSnapshot | null> {
  const intents = await rest(
    `membership_period_intents?id=eq.${intentId}&select=id,status,charge_intent_id,subject_id,collection_subjects(client_id)`,
  ) as Array<{
    status: string;
    charge_intent_id: string | null;
    subject_id: string;
    collection_subjects: { client_id: string } | { client_id: string }[] | null;
  }>;
  const intent = intents[0];
  if (!intent) return null;
  const subject = Array.isArray(intent.collection_subjects)
    ? intent.collection_subjects[0]
    : intent.collection_subjects;
  if (!subject?.client_id) return null;
  const signals = await rest(
    `membership_payment_signals?intent_id=eq.${intentId}&select=kind,source`,
  ) as Array<{ kind: string; source: PaymentRail }>;
  const confirmed = signals.find((row) => row.kind === 'payment_confirmed');
  return {
    status: intent.status,
    chargeIntentId: intent.charge_intent_id,
    subjectId: intent.subject_id,
    clientId: subject.client_id,
    hasConfirmedSignal: Boolean(confirmed),
    hasReversedSignal: signals.some((row) => row.kind === 'payment_reversed'),
    confirmedSource: confirmed?.source ?? null,
  };
}

export async function applyMembershipDecision(input: {
  intentId: string;
  chargeIntentId: string | null;
  subjectId: string;
  clientId: string;
  decision: MembershipMoneyDecision;
  source: PaymentRail;
  now: Date;
  requestId?: string;
  requestStatus?: string;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    status: input.decision.intentStatus,
    updated_at: input.now.toISOString(),
  };
  if (input.decision.setPaidAt) patch.paid_at = input.now.toISOString();
  if (input.decision.clearPaidAt) patch.paid_at = null;
  if (input.decision.duplicateReceipt) patch.duplicate_receipt = true;
  await rest(`membership_period_intents?id=eq.${input.intentId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (input.chargeIntentId && (input.decision.setPaidAt || input.decision.clearPaidAt)) {
    await rest(`membership_charge_intents?id=eq.${input.chargeIntentId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ paid_at: input.decision.setPaidAt ? input.now.toISOString() : null }),
    });
  }
  if (input.decision.signal) {
    await rest('membership_payment_signals', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        intent_id: input.intentId,
        subject_id: input.subjectId,
        client_id: input.clientId,
        kind: input.decision.signal,
        source: input.source,
        occurred_at: input.now.toISOString(),
      }),
    });
  }
  if (input.requestId && input.requestStatus) {
    await rest(`collection_requests?id=eq.${input.requestId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: input.requestStatus,
        updated_at: input.now.toISOString(),
      }),
    });
  }
}

interface ChargeRow {
  id: string;
  membership_id: string;
  kind: 'month' | 'cancel_fee';
  period_key: string;
  amount: number | string;
  currency: 'CHF';
  memberships: {
    user_id: string;
    groups: { name: string } | { name: string }[] | null;
  } | Array<{
    user_id: string;
    groups: { name: string } | { name: string }[] | null;
  }> | null;
}

export async function listChargeSources(): Promise<ChargeIntentSource[]> {
  const rows = await rest(
    'membership_charge_intents?select=id,membership_id,kind,period_key,amount,currency,memberships(user_id,groups(name))',
  ) as ChargeRow[];
  return rows.flatMap((row) => {
    const membership = Array.isArray(row.memberships) ? row.memberships[0] : row.memberships;
    if (!membership?.user_id) return [];
    const group = Array.isArray(membership.groups) ? membership.groups[0] : membership.groups;
    const label = group?.name || 'Membership';
    return [{
      id: row.id,
      membershipId: row.membership_id,
      clientId: membership.user_id,
      periodKey: row.period_key,
      kind: row.kind,
      amount: Number(row.amount),
      currency: 'CHF' as const,
      displayLabel: label,
    }];
  });
}

export async function listCopiedChargeIds(): Promise<string[]> {
  const rows = await rest(
    'membership_period_intents?charge_intent_id=not.is.null&select=charge_intent_id',
  ) as Array<{ charge_intent_id: string }>;
  return rows.map((row) => row.charge_intent_id);
}

async function upsertSubject(clientId: string, membershipRef: string, displayLabel: string): Promise<string> {
  const rows = await rest('collection_subjects?on_conflict=membership_ref', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      client_id: clientId,
      membership_ref: membershipRef,
      display_label: displayLabel,
    }),
  }) as Array<{ id: string }>;
  const id = rows[0]?.id;
  if (!id) throw new Error('collection subject was not saved');
  return id;
}

export async function insertPeriodDrafts(drafts: PeriodIntentDraft[]): Promise<void> {
  for (const draft of drafts) {
    const subjectId = await upsertSubject(draft.clientId, draft.membershipRef, draft.displayLabel);
    await rest('membership_period_intents?on_conflict=charge_intent_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        subject_id: subjectId,
        period_key: draft.periodKey,
        claim_kind: draft.claimKind,
        charge_intent_id: draft.chargeIntentId,
        amount: draft.amount,
        currency: 'CHF',
      }),
    });
  }
}

export interface RunnableIntent {
  id: string;
  method: 'automatic_collection' | 'qr_invoice' | null;
  clientActive: boolean;
  mandateStatus: string | null;
  intentStatus: string;
  hasCollectionRequest: boolean;
  stopped: boolean;
}

export async function listRunnableIntents(): Promise<RunnableIntent[]> {
  const rows = await rest(
    'membership_period_intents?select=id,status,collection_requests(id),collection_subjects(profiles:client_id(is_active),collection_methods(method,stopped_at),direct_debit_mandates(status,attempt_no))',
  ) as Array<{
    id: string;
    status: string;
    collection_requests: Array<{ id: string }> | null;
    collection_subjects: {
      profiles: { is_active: boolean } | { is_active: boolean }[] | null;
      collection_methods: { method: 'automatic_collection' | 'qr_invoice'; stopped_at: string | null } | Array<{ method: 'automatic_collection' | 'qr_invoice'; stopped_at: string | null }> | null;
      direct_debit_mandates: Array<{ status: string; attempt_no: number }> | null;
    } | null;
  }>;
  return rows.map((row) => {
    const subject = row.collection_subjects;
    const profile = Array.isArray(subject?.profiles) ? subject?.profiles[0] : subject?.profiles;
    const methodRow = Array.isArray(subject?.collection_methods)
      ? subject?.collection_methods[0]
      : subject?.collection_methods;
    const mandates = subject?.direct_debit_mandates ?? [];
    const latest = [...mandates].sort((a, b) => b.attempt_no - a.attempt_no)[0];
    return {
      id: row.id,
      method: methodRow?.method ?? null,
      clientActive: profile?.is_active === true,
      mandateStatus: latest?.status ?? null,
      intentStatus: row.status,
      hasCollectionRequest: (row.collection_requests ?? []).length > 0,
      stopped: Boolean(methodRow?.stopped_at),
    };
  });
}

export async function listMandatesToPoll(): Promise<Array<{
  id: string;
  externalRef: string | null;
  channelStatusAt: string | null;
}>> {
  const rows = await rest(
    'direct_debit_mandates?status=in.(proposal_sent,active)&external_mandate_ref=not.is.null&select=id,external_mandate_ref,channel_status_at',
  ) as Array<{ id: string; external_mandate_ref: string | null; channel_status_at: string | null }>;
  return rows.map((row) => ({
    id: row.id,
    externalRef: row.external_mandate_ref,
    channelStatusAt: row.channel_status_at,
  }));
}

export async function applyMandateObservation(
  id: string,
  status: string,
  observedAt: string,
  failureReason: string | null,
): Promise<void> {
  await rest(`direct_debit_mandates?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status,
      failure_reason: failureReason,
      channel_status_at: observedAt,
      updated_at: new Date().toISOString(),
    }),
  });
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
  confirmedSource: PaymentRail | null;
}

export async function listSubmittedCollections(): Promise<SubmittedCollectionRow[]> {
  const rows = await rest(
    'collection_requests?status=eq.submitted&select=id,intent_id,external_collection_ref,channel_status_at,membership_period_intents(status,charge_intent_id,subject_id,collection_subjects(client_id))',
  ) as Array<{
    id: string;
    intent_id: string;
    external_collection_ref: string | null;
    channel_status_at: string | null;
    membership_period_intents: {
      status: string;
      charge_intent_id: string | null;
      subject_id: string;
      collection_subjects: { client_id: string } | { client_id: string }[] | null;
    } | null;
  }>;
  const result: SubmittedCollectionRow[] = [];
  for (const row of rows) {
    const intent = row.membership_period_intents;
    if (!intent) continue;
    const subject = Array.isArray(intent.collection_subjects)
      ? intent.collection_subjects[0]
      : intent.collection_subjects;
    if (!subject?.client_id) continue;
    const signals = await rest(
      `membership_payment_signals?intent_id=eq.${row.intent_id}&select=kind,source`,
    ) as Array<{ kind: string; source: PaymentRail }>;
    const confirmed = signals.find((signal) => signal.kind === 'payment_confirmed');
    result.push({
      requestId: row.id,
      intentId: row.intent_id,
      externalRef: row.external_collection_ref,
      channelStatusAt: row.channel_status_at,
      intentStatus: intent.status,
      chargeIntentId: intent.charge_intent_id,
      subjectId: intent.subject_id,
      clientId: subject.client_id,
      hasConfirmedSignal: Boolean(confirmed),
      hasReversedSignal: signals.some((signal) => signal.kind === 'payment_reversed'),
      confirmedSource: confirmed?.source ?? null,
    });
  }
  return result;
}
