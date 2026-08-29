/**
 * BexioClient — authenticated HTTP client for the Bexio API (research R-01/R-10).
 *
 * Policy rules (binding, contracts/accounting-provider.md):
 *  - 401 → refresh the access token once (single-flight), retry the call once.
 *  - invalid_grant on refresh → ProviderAuthError + onAuthFailure callback
 *    (integration flips to requires_reauth, FR-005/FR-007).
 *  - 429 / 5xx / network → exponential backoff with jitter, honoring
 *    RateLimit-Reset / Retry-After, bounded to maxAttempts, then
 *    ProviderUnavailableError (caller enqueues into billing_operations).
 *  - Other 4xx → ProviderClientError, never retried (FR-006c).
 *  - Logs: method, path, status, correlation id only — never tokens, headers,
 *    or bodies (FR-032/FR-034).
 */

import {
  ProviderAuthError,
  ProviderClientError,
  ProviderUnavailableError,
} from '../accounting-provider.ts';

// New IdP (idp.bexio.com decommissioned 2025-03-31; see docs.bexio.com
// §Authentication → Migration from idp.bexio.com to auth.bexio.com).
const TOKEN_ENDPOINT = 'https://auth.bexio.com/realms/bexio/protocol/openid-connect/token';
const API_BASE = 'https://api.bexio.com';
const EXPIRY_MARGIN_MS = 60_000;

interface AccessTokenCache {
  access_token: string;
  expires_at: number; // epoch ms
}

export interface BexioClientDeps {
  clientId: string;
  clientSecret: string;
  refreshTokenName: string; // Vault secret name
  accessCacheName: string; // Vault secret name
  readSecret: (name: string) => Promise<string | null>;
  writeSecret: (name: string, value: string) => Promise<void>;
  onAuthFailure?: () => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  fetchFn?: typeof fetch;
  now?: () => number;
  maxAttempts?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function log(event: Record<string, unknown>): void {
  // Sanitized by construction: callers pass only method/path/status/correlation.
  console.log(JSON.stringify({ component: 'bexio-client', ...event }));
}

export class BexioClient {
  private refreshPromise: Promise<string> | null = null;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly maxAttempts: number;

  constructor(private readonly deps: BexioClientDeps) {
    this.sleep = deps.sleep ?? defaultSleep;
    this.fetchFn = deps.fetchFn ?? fetch;
    this.now = deps.now ?? (() => Date.now());
    this.maxAttempts = deps.maxAttempts ?? 3;
  }

  async getValidAccessToken(): Promise<string> {
    const cachedRaw = await this.deps.readSecret(this.deps.accessCacheName);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as AccessTokenCache;
        if (cached.access_token && cached.expires_at - EXPIRY_MARGIN_MS > this.now()) {
          return cached.access_token;
        }
      } catch {
        // Corrupt cache — fall through to refresh.
      }
    }
    return this.refreshSingleFlight();
  }

  private refreshSingleFlight(): Promise<string> {
    this.refreshPromise ??= this.refreshAccessToken().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshToken = await this.deps.readSecret(this.deps.refreshTokenName);
    if (!refreshToken) {
      if (this.deps.onAuthFailure) await this.deps.onAuthFailure();
      throw new ProviderAuthError('no refresh token stored — integration not connected');
    }

    const res = await this.fetchFn(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.deps.clientId,
        client_secret: this.deps.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      if (res.status === 400 && bodyText.includes('invalid_grant')) {
        log({ event: 'token_refresh_failed', reason: 'invalid_grant' });
        if (this.deps.onAuthFailure) await this.deps.onAuthFailure();
        throw new ProviderAuthError('refresh token rejected (invalid_grant) — re-authorization required');
      }
      log({ event: 'token_refresh_failed', status: res.status });
      throw new ProviderUnavailableError(`token refresh failed with status ${res.status}`);
    }

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const cache: AccessTokenCache = {
      access_token: tokens.access_token,
      expires_at: this.now() + (tokens.expires_in ?? 3600) * 1000,
    };
    // Bexio rotates the refresh token on every refresh — persist both (FR-004).
    await this.deps.writeSecret(this.deps.accessCacheName, JSON.stringify(cache));
    if (tokens.refresh_token) {
      await this.deps.writeSecret(this.deps.refreshTokenName, tokens.refresh_token);
    }
    log({ event: 'token_refreshed' });
    return tokens.access_token;
  }

  /** Invalidate the cached access token (forces refresh on next call). */
  async invalidateAccessTokenCache(): Promise<void> {
    await this.deps.writeSecret(
      this.deps.accessCacheName,
      JSON.stringify({ access_token: '', expires_at: 0 } satisfies AccessTokenCache),
    );
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: { body?: unknown; correlationId?: string; rawResponse?: boolean } = {},
  ): Promise<T> {
    let token = await this.getValidAccessToken();
    let refreshed = false;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      let res: Response;
      try {
        res = await this.fetchFn(`${API_BASE}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Accept-Language': 'en',
            ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        });
      } catch (err) {
        log({ event: 'request_network_error', method, path, attempt, correlationId: options.correlationId });
        if (attempt === this.maxAttempts) {
          throw new ProviderUnavailableError(`network error after ${attempt} attempts: ${(err as Error).name}`);
        }
        await this.sleep(this.backoffMs(attempt, null));
        continue;
      }

      log({ event: 'response', method, path, status: res.status, attempt, correlationId: options.correlationId });

      if (res.status === 401 && !refreshed) {
        refreshed = true;
        token = await this.refreshSingleFlight();
        continue;
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt === this.maxAttempts) {
          throw new ProviderUnavailableError(`bexio ${res.status} after ${attempt} attempts`);
        }
        await this.sleep(this.backoffMs(attempt, res));
        continue;
      }

      if (!res.ok) {
        // Non-retryable client error. Log field names only — never the body (FR-032).
        const text = await res.text().catch(() => '');
        let fields: string[] = [];
        try {
          const parsed = JSON.parse(text) as { errors?: Record<string, unknown> };
          if (parsed?.errors && typeof parsed.errors === 'object') {
            fields = Object.keys(parsed.errors);
          }
        } catch { /* not JSON */ }
        log({
          event: 'client_error',
          method,
          path,
          status: res.status,
          fields,
          correlationId: options.correlationId,
        });
        throw new ProviderClientError(`bexio request failed with status ${res.status}`, res.status);
      }

      if (options.rawResponse) {
        return res as unknown as T;
      }
      const text = await res.text();
      return (text ? JSON.parse(text) : null) as T;
    }

    throw new ProviderUnavailableError('request attempts exhausted');
  }

  /** Visible for testing. Backoff: Retry-After / RateLimit-Reset win; else exp + jitter. */
  backoffMs(attempt: number, res: Response | null): number {
    const retryAfter = res?.headers.get('Retry-After');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 60_000);
    }
    const reset = res?.headers.get('RateLimit-Reset');
    if (reset) {
      const seconds = Number(reset);
      if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60_000);
    }
    const base = Math.min(1000 * 2 ** (attempt - 1), 15_000);
    return base + Math.floor(Math.random() * 250);
  }
}
