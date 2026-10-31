import { supabase } from '@/lib/customSupabaseClient';

export const FORBIDDEN_COLLECTION_PHRASES = [
  'Automatic transaction',
  'standing approval',
  'standing order',
];

export const COLLECTION_COPY = {
  unavailable: 'Automatic collection is unavailable. Pay by invoice.',
  waiting: 'Waiting for bank mandate approval',
  unsupported: 'Auto-pay is unavailable at your bank. Pay by invoice.',
  invoice: 'Pay by invoice',
  submitted: 'Automatic collection has been sent. Pay by invoice is hidden until it finishes.',
};

async function invokeCollection(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in.');
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
    throw new Error(detail || 'Collection request failed');
  }
  return data;
}

export function setCollectionMethod(subjectId, method) {
  return invokeCollection('membership-set-collection-method', {
    subject_id: subjectId,
    method,
  });
}

export function requestNewMandate(subjectId) {
  return invokeCollection('membership-request-mandate', { subject_id: subjectId });
}

export async function listCollectionSubjects() {
  const { data, error } = await supabase
    .from('collection_subjects')
    .select('id, display_label, client_id, collection_methods(method, stopped_at), direct_debit_mandates(attempt_no, status), membership_period_intents(id, period_key, claim_kind, amount, status, duplicate_receipt, collection_requests(status))')
    .order('display_label', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
