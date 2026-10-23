import { supabase } from '@/lib/customSupabaseClient';

// Client helpers for F1.26 membership collection.
// Reads are owner-or-admin under RLS. Writes go through the JWT Edge Functions.
// IBAN is never selected. Lesson and camp billing stay in src/lib/billing.js.

export const COLLECTION_METHODS = Object.freeze({
  AUTOMATIC: 'automatic_collection',
  QR: 'qr_invoice',
});

export const FORBIDDEN_COLLECTION_PHRASES = Object.freeze([
  'Automatic transaction',
  'standing approval',
  'standing order',
]);

export const COLLECTION_COPY = Object.freeze({
  proposalSent: 'Waiting for bank mandate approval',
  unsupportedBank: 'Auto-pay is unavailable at your bank. Pay by invoice.',
  payByInvoice: 'Pay by invoice',
  collectionSubmitted: 'Automatic collection has been sent. Pay by invoice is hidden until it finishes.',
  channelNotConfigured: 'Automatic collection is unavailable. Pay by invoice.',
  mandateActive: 'Direct Debit mandate is active. This does not mark a period paid.',
  mandateRejected: 'The mandate was rejected. Pay by invoice.',
  mandateRevoked: 'The mandate was revoked. Pay by invoice.',
  mandateFailed: 'The mandate request failed. Pay by invoice.',
  notPaidNote: 'A proposal or an active mandate does not mark a period paid.',
});

export const COLLECTION_ERROR_COPY = Object.freeze({
  collection_channel_not_configured: COLLECTION_COPY.channelNotConfigured,
  client_inactive: 'This client is inactive. Automatic collection stays off.',
  explicit_new_attempt_required: 'Request a new mandate. The previous mandate stays rejected or revoked.',
  new_attempt_not_allowed: 'A new mandate can be requested only after rejection or revocation.',
});

const MANDATE_COPY = Object.freeze({
  proposal_sent: COLLECTION_COPY.proposalSent,
  unsupported_bank: COLLECTION_COPY.unsupportedBank,
  active: COLLECTION_COPY.mandateActive,
  rejected: COLLECTION_COPY.mandateRejected,
  revoked: COLLECTION_COPY.mandateRevoked,
  failed: COLLECTION_COPY.mandateFailed,
});

const SUBJECT_COLUMNS = `
  id,
  client_id,
  membership_ref,
  display_label,
  collection_methods (method, stopped_at, updated_at),
  direct_debit_mandates (status, attempt_no, failure_reason, requested_at),
  membership_period_intents (
    id,
    period_key,
    amount,
    currency,
    status,
    paid_at,
    duplicate_receipt,
    created_at,
    collection_requests (status, failure_reason, submitted_at),
    membership_payment_signals (kind, source, occurred_at)
  )
`;

export function assertCollectionCopyAllowed(text) {
  const value = String(text ?? '');
  const lower = value.toLowerCase();
  for (const phrase of FORBIDDEN_COLLECTION_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      throw new Error(`Collection copy must not include “${phrase}”.`);
    }
  }
  return value;
}

for (const phrase of [...Object.values(COLLECTION_COPY), ...Object.values(COLLECTION_ERROR_COPY)]) {
  assertCollectionCopyAllowed(phrase);
}

function asList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function isCollectionSchemaMissing(error) {
  if (!error) return false;
  const code = String(error.code || '');
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST204') return true;
  const message = String(error.message || '');
  return /does not exist|schema cache|could not find the table/i.test(message);
}

export function latestMandate(mandates) {
  const rows = asList(mandates);
  if (rows.length === 0) return null;
  return rows.slice().sort((a, b) => (b?.attempt_no ?? 0) - (a?.attempt_no ?? 0))[0];
}

export function subjectMethod(subject) {
  const row = asList(subject?.collection_methods)[0];
  return row?.method === COLLECTION_METHODS.AUTOMATIC
    ? COLLECTION_METHODS.AUTOMATIC
    : COLLECTION_METHODS.QR;
}

export function collectionStatusCopy({
  method,
  mandateStatus,
  collectionStatus,
  channelConfigured = true,
} = {}) {
  if (collectionStatus === 'submitted') return COLLECTION_COPY.collectionSubmitted;
  if (channelConfigured === false) return COLLECTION_COPY.channelNotConfigured;
  if (mandateStatus === 'unsupported_bank') return COLLECTION_COPY.unsupportedBank;
  if (method === COLLECTION_METHODS.AUTOMATIC && mandateStatus && MANDATE_COPY[mandateStatus]) {
    return MANDATE_COPY[mandateStatus];
  }
  return COLLECTION_COPY.payByInvoice;
}

export function isMembershipQrPayHidden(intent, documentFlag = false) {
  if (documentFlag === true) return true;
  if (intent?.status === 'collection_submitted') return true;
  return asList(intent?.collection_requests).some((row) => row?.status === 'submitted');
}

export function buildSubjectCollectionView(subject, { channelConfigured = true } = {}) {
  const method = subjectMethod(subject);
  const mandate = latestMandate(subject?.direct_debit_mandates);
  const mandateStatus = mandate?.status || null;
  const periods = asList(subject?.membership_period_intents)
    .slice()
    .sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')))
    .map((intent) => {
      const submitted = isMembershipQrPayHidden(intent);
      return {
        id: intent.id,
        periodKey: intent.period_key,
        amountLabel: intent.amount != null ? `${intent.amount} ${intent.currency || 'CHF'}` : null,
        status: intent.status,
        paid: intent.status === 'paid',
        qrPayHidden: submitted,
        showInvoice: !submitted && Boolean(intent.status) && intent.status !== 'pending',
        copy: collectionStatusCopy({
          method,
          mandateStatus,
          collectionStatus: submitted ? 'submitted' : null,
          channelConfigured,
        }),
      };
    });

  return {
    id: subject.id,
    clientId: subject.client_id,
    clientName: subject.profile?.full_name || subject.profile?.email || null,
    label: subject.display_label,
    method,
    mandateStatus,
    failureReason: mandate?.failure_reason || null,
    canRequestNewMandate: subject.profile?.is_active !== false
      && (mandateStatus === 'rejected' || mandateStatus === 'revoked'),
    statusCopy: collectionStatusCopy({ method, mandateStatus, channelConfigured }),
    inactive: subject.profile?.is_active === false,
    periods,
  };
}

export function adminCollectionLists(subjects = []) {
  const failed = [];
  const reversals = [];
  const duplicates = [];

  for (const subject of subjects) {
    const view = buildSubjectCollectionView(subject);
    for (const intent of asList(subject.membership_period_intents)) {
      const base = {
        subjectId: subject.id,
        label: view.label,
        client: view.clientName || subject.client_id,
        period: intent.period_key,
      };
      for (const request of asList(intent.collection_requests)) {
        if (request?.status === 'failed' || request?.status === 'rejected') {
          failed.push({
            ...base,
            status: request.status,
            failureReason: request.failure_reason || null,
          });
        }
      }
      const reversedSignal = asList(intent.membership_payment_signals)
        .some((signal) => signal?.kind === 'payment_reversed');
      if (intent.status === 'reversed' || reversedSignal) {
        reversals.push({ ...base, status: 'reversed' });
      }
      if (intent.duplicate_receipt === true) {
        duplicates.push(base);
      }
    }
  }

  return { failed, reversals, duplicates };
}

async function invokeCollection(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in.');
  }

  const { data, error } = await supabase.functions.invoke(name, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body,
  });

  if (error) {
    let detail = error.message;
    const response = error.context;
    if (response && typeof response.json === 'function') {
      try {
        const parsed = await response.json();
        detail = parsed?.error || parsed?.message || detail;
      } catch { /* body already consumed or not JSON */ }
    }
    const code = typeof detail === 'string' ? detail : 'collection_request_failed';
    const mapped = new Error(COLLECTION_ERROR_COPY[code] || code || 'Collection request failed');
    mapped.code = code;
    throw mapped;
  }
  return data;
}

export function setCollectionMethod(subjectId, method) {
  if (!subjectId || (method !== COLLECTION_METHODS.AUTOMATIC && method !== COLLECTION_METHODS.QR)) {
    return Promise.reject(new Error('Choose automatic collection or pay by invoice.'));
  }
  return invokeCollection('membership-set-collection-method', {
    subject_id: subjectId,
    method,
  });
}

export function requestNewMandate(subjectId) {
  if (!subjectId) {
    return Promise.reject(new Error('A membership is required.'));
  }
  return invokeCollection('membership-request-mandate', {
    subject_id: subjectId,
  });
}

async function attachProfiles(subjects) {
  const clientIds = [...new Set(subjects.map((subject) => subject.client_id).filter(Boolean))];
  if (clientIds.length === 0) return subjects;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, is_active')
    .in('id', clientIds);
  if (error || !data) return subjects;

  const byId = new Map(data.map((profile) => [profile.id, profile]));
  return subjects.map((subject) => ({
    ...subject,
    profile: byId.get(subject.client_id) || null,
  }));
}

export async function listCollectionSubjects() {
  const { data, error } = await supabase
    .from('collection_subjects')
    .select(SUBJECT_COLUMNS)
    .order('display_label', { ascending: true });

  if (error) {
    if (isCollectionSchemaMissing(error)) return { available: false, subjects: [] };
    throw new Error(error.message || 'Could not load membership collection.');
  }

  const subjects = await attachProfiles(data || []);
  return { available: true, subjects };
}

export async function isCollectionDataAvailable() {
  const { error } = await supabase
    .from('collection_subjects')
    .select('id')
    .limit(1);
  return !isCollectionSchemaMissing(error);
}
