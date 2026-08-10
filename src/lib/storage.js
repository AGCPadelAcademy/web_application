import { supabase } from '@/lib/customSupabaseClient';

export const PAYMENT_PROOFS_BUCKET = 'payment-proofs';

// 24h — bucket is private; every view goes through a short-lived signed URL.
const SIGNED_URL_TTL_SECONDS = 86400;

export async function getSignedProofUrl(fileUrl) {
  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(fileUrl, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw error || new Error('Could not create signed URL');
  }
  return data.signedUrl;
}
