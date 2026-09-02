/**
 * OAuth `state` nonce: HMAC-SHA256 signed, single-use semantics via short TTL.
 * Format: `<nonce>.<expiresAtMs>.<userId>.<hex-hmac>` where the HMAC covers
 * `<nonce>.<expiresAtMs>.<userId>`. The callback is invoked by the browser
 * redirect without a caller JWT, so the signed state is the authentication
 * for that endpoint (contracts/edge-functions.md §1).
 */

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return hex(signature);
}

export async function signState(
  secret: string,
  userId: string,
  ttlMs = 600_000,
  now: () => number = () => Date.now(),
): Promise<string> {
  const nonce = crypto.randomUUID();
  const expiresAt = now() + ttlMs;
  const payload = `${nonce}.${expiresAt}.${userId}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyState(
  secret: string,
  state: string,
  now: () => number = () => Date.now(),
): Promise<{ valid: boolean; userId?: string }> {
  const parts = state.split('.');
  if (parts.length !== 4) return { valid: false };
  const [nonce, expiresAtRaw, userId, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!nonce || !userId || !Number.isFinite(expiresAt)) return { valid: false };
  if (expiresAt <= now()) return { valid: false };

  const payload = `${nonce}.${expiresAtRaw}.${userId}`;
  const expected = await hmac(secret, payload);
  if (expected.length !== signature.length) return { valid: false };

  // Constant-time comparison.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0 ? { valid: true, userId } : { valid: false };
}
