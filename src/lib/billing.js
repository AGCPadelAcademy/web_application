import { supabase } from '@/lib/customSupabaseClient';

// Billing integration client helpers (spec: 007-bexio-integration).
// Follows the same invoke pattern as requestInvoice in src/lib/bookings.js:
// explicit session token + unwrapping the function's real error body.

async function invokeBillingFunction(name, body) {
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
    throw new Error(detail || 'Billing request failed');
  }
  return data;
}

export const getBexioStatus = () => invokeBillingFunction('bexio-oauth', { action: 'status' });

export const startBexioConnection = () => invokeBillingFunction('bexio-oauth', { action: 'start' });

export const disconnectBexio = () => invokeBillingFunction('bexio-oauth', { action: 'disconnect' });

export const initializeBexioConfig = () => invokeBillingFunction('bexio-oauth', { action: 'initialize' });

export const saveBexioConfig = (config) =>
  invokeBillingFunction('bexio-oauth', { action: 'configure', config });

// Issue (or idempotently reuse) the Bexio invoice for a booking (US2).
// The idempotency key is deterministic per contract §2 — the server
// recomputes and validates it, so a replayed call never duplicates.
export const issueBexioInvoice = (bookingId) =>
  invokeBillingFunction('billing-issue-invoice', {
    booking_id: bookingId,
    idempotency_key: `booking:${bookingId}:invoice:v1`,
  });

export const cancelBexioInvoice = (bookingId) =>
  invokeBillingFunction('billing-cancel-invoice', {
    booking_id: bookingId,
    idempotency_key: `booking:${bookingId}:invoice_cancel:v1`,
  });

export const runBexioReconciliation = () =>
  invokeBillingFunction('bexio-reconcile', {});

// Fetch the Bexio PDF as a blob URL for in-app preview (US3).
// functions.invoke JSON-parses the body, so this uses a raw fetch instead.
export async function fetchInvoicePdfBlob(bookingId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${supabaseUrl}/functions/v1/billing-invoice-document`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ booking_id: bookingId }),
  });

  if (!res.ok) {
    let detail = `Invoice document request failed (${res.status})`;
    try {
      const parsed = await res.json();
      detail = parsed?.message || parsed?.error || detail;
    } catch { /* body is not JSON */ }
    throw new Error(detail);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Public cutover flag (FR-017): true when the Bexio integration is connected.
// Fail-safe: on any read error we return false so the legacy invoice path
// keeps working (spec Edge Cases — integration must not break bookings).
export async function isBexioBillingEnabled() {
  const { data, error } = await supabase
    .from('billing_public_config')
    .select('integration_enabled')
    .maybeSingle();
  if (error) {
    console.warn('billing_public_config read failed; falling back to legacy billing', error);
    return false;
  }
  return data?.integration_enabled === true;
}
