/**
 * Vault access helpers (research R-02).
 *
 * Edge Functions cannot reach the `vault` schema through PostgREST, so all
 * secret reads/writes go through the SECURITY DEFINER RPCs created in
 * migration 0003 (billing_get_secret / billing_put_secret / billing_delete_secret),
 * callable only by the service role. Secret VALUES must never be logged.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function callSecretRpc<T>(fn: string, payload: Record<string, string>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`vault rpc ${fn} failed with status ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function readSecret(name: string): Promise<string | null> {
  return await callSecretRpc<string | null>('billing_get_secret', { p_name: name });
}

export async function writeSecret(name: string, value: string): Promise<void> {
  await callSecretRpc<string>('billing_put_secret', { p_name: name, p_secret: value });
}

export async function deleteSecret(name: string): Promise<void> {
  await callSecretRpc<null>('billing_delete_secret', { p_name: name });
}
