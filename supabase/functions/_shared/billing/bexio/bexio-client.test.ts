/**
 * Unit tests for BexioClient (T009). Run with: deno test --allow-env --allow-net=none
 * All network access is mocked via an injected fetchFn; sleep is instant.
 */

import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { BexioClient } from './bexio-client.ts';
import { ProviderAuthError, ProviderUnavailableError } from '../accounting-provider.ts';

interface MockVault {
  store: Map<string, string>;
  readSecret: (name: string) => Promise<string | null>;
  writeSecret: (name: string, value: string) => Promise<void>;
}

function makeVault(initial: Record<string, string> = {}): MockVault {
  const store = new Map(Object.entries(initial));
  return {
    store,
    readSecret: (name) => Promise.resolve(store.get(name) ?? null),
    writeSecret: (name, value) => {
      store.set(name, value);
      return Promise.resolve();
    },
  };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const BASE_DEPS = {
  clientId: 'test-client',
  clientSecret: 'test-secret',
  refreshTokenName: 'bexio_refresh_token',
  accessCacheName: 'bexio_access_token_cache',
  sleep: () => Promise.resolve(),
  now: () => 1_000_000,
};

Deno.test('returns cached access token when still valid', async () => {
  const vault = makeVault({
    bexio_access_token_cache: JSON.stringify({ access_token: 'cached-token', expires_at: 1_000_000 + 3_600_000 }),
  });
  const fetches: string[] = [];
  const client = new BexioClient({
    ...BASE_DEPS,
    ...vault,
    fetchFn: (input) => {
      fetches.push(String(input));
      return Promise.resolve(jsonResponse(200, { ok: true }));
    },
  });

  const result = await client.request<{ ok: boolean }>('GET', '/3.0/users/me');
  assertEquals(result.ok, true);
  assertEquals(fetches.length, 1);
  assertStringIncludes(fetches[0], 'api.bexio.com');
});

Deno.test('401 triggers a single token refresh and one retry', async () => {
  const vault = makeVault({ bexio_refresh_token: 'refresh-1' });
  const calls: string[] = [];
  const client = new BexioClient({
    ...BASE_DEPS,
    ...vault,
    fetchFn: (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('auth.bexio.com')) {
        return Promise.resolve(
          jsonResponse(200, { access_token: 'fresh-token', refresh_token: 'refresh-2', expires_in: 3600 }),
        );
      }
      // First API call 401s, second succeeds.
      return Promise.resolve(calls.filter((u) => u.includes('api.bexio.com')).length === 1
        ? jsonResponse(401, {})
        : jsonResponse(200, { ok: true }));
    },
  });

  const result = await client.request<{ ok: boolean }>('GET', '/2.0/kb_invoice/1');
  assertEquals(result.ok, true);
  assertEquals(calls.filter((u) => u.includes('api.bexio.com')).length, 2);
  // Two token-endpoint calls: initial acquisition (no cached token) + the
  // single refresh after the 401. The retry itself must not refresh again.
  assertEquals(calls.filter((u) => u.includes('auth.bexio.com')).length, 2);
});

Deno.test('refresh rotates the stored refresh token (FR-004)', async () => {
  const vault = makeVault({ bexio_refresh_token: 'refresh-1' });
  const client = new BexioClient({
    ...BASE_DEPS,
    ...vault,
    fetchFn: (input) =>
      String(input).includes('auth.bexio.com')
        ? Promise.resolve(
          jsonResponse(200, { access_token: 'a', refresh_token: 'refresh-2', expires_in: 3600 }),
        )
        : Promise.resolve(jsonResponse(200, {})),
  });

  await client.request('GET', '/3.0/users/me');
  assertEquals(vault.store.get('bexio_refresh_token'), 'refresh-2');
});

Deno.test('invalid_grant on refresh raises ProviderAuthError and calls onAuthFailure', async () => {
  const vault = makeVault({ bexio_refresh_token: 'revoked' });
  let authFailureCalled = false;
  const client = new BexioClient({
    ...BASE_DEPS,
    ...vault,
    onAuthFailure: () => {
      authFailureCalled = true;
      return Promise.resolve();
    },
    fetchFn: () => Promise.resolve(jsonResponse(400, { error: 'invalid_grant' })),
  });

  await assertRejects(() => client.request('GET', '/3.0/users/me'), ProviderAuthError);
  assert(authFailureCalled);
});

Deno.test('429 is retried honoring RateLimit-Reset, then succeeds', async () => {
  const vault = makeVault({
    bexio_access_token_cache: JSON.stringify({ access_token: 't', expires_at: 1_000_000 + 3_600_000 }),
  });
  let apiCalls = 0;
  const client = new BexioClient({
    ...BASE_DEPS,
    ...vault,
    fetchFn: () => {
      apiCalls++;
      return Promise.resolve(
        apiCalls === 1
          ? jsonResponse(429, {}, { 'RateLimit-Reset': '1' })
          : jsonResponse(200, { ok: true }),
      );
    },
  });

  const result = await client.request<{ ok: boolean }>('GET', '/2.0/kb_invoice/1');
  assertEquals(result.ok, true);
  assertEquals(apiCalls, 2);
});

Deno.test('persistent 5xx exhausts attempts and raises ProviderUnavailableError', async () => {
  const vault = makeVault({
    bexio_access_token_cache: JSON.stringify({ access_token: 't', expires_at: 1_000_000 + 3_600_000 }),
  });
  const client = new BexioClient({
    ...BASE_DEPS,
    ...vault,
    maxAttempts: 3,
    fetchFn: () => Promise.resolve(jsonResponse(503, {})),
  });

  await assertRejects(() => client.request('GET', '/2.0/kb_invoice/1'), ProviderUnavailableError);
});

Deno.test('missing refresh token raises ProviderAuthError (not connected)', async () => {
  const vault = makeVault();
  const client = new BexioClient({
    ...BASE_DEPS,
    ...vault,
    fetchFn: () => Promise.resolve(jsonResponse(200, {})),
  });

  await assertRejects(() => client.request('GET', '/3.0/users/me'), ProviderAuthError);
});
