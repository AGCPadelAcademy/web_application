import { describe, it, expect, beforeAll } from 'vitest';

// Integration test for the atomic invoice-number allocator (migration 0005).
// Requires a dedicated TEST Supabase project — never run against production.
//
// Setup:
//   1. Create a separate Supabase project for testing.
//   2. Apply migrations 0001–0007 to it.
//   3. Provide env vars (locally via .env.test, in CI via GitHub secrets):
//        SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY
//
// Without these env vars the suite is skipped, so `npm test` stays hermetic.

const TEST_URL = process.env.SUPABASE_TEST_URL;
const TEST_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const runIfConfigured = TEST_URL && TEST_KEY ? describe : describe.skip;

runIfConfigured('next_invoice_number RPC (integration)', () => {
  // Client is created lazily inside beforeAll: Vitest still invokes
  // describe.skip callbacks during collection, so top-level setup would run
  // (and fail) even when the suite is skipped.
  let supabase;
  beforeAll(async () => {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(TEST_URL, TEST_KEY);
  });

  const dateKey = `TEST/${Date.now()}`;

  it('allocates strictly sequential numbers per date key', async () => {
    const results = [];
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase.rpc('next_invoice_number', { p_date_key: dateKey });
      expect(error).toBeNull();
      results.push(data);
    }
    expect(results).toEqual([1, 2, 3]);
  });

  it('does not collide under concurrent calls', async () => {
    const concurrentKey = `${dateKey}-concurrent`;
    const calls = Array.from({ length: 10 }, () =>
      supabase.rpc('next_invoice_number', { p_date_key: concurrentKey })
    );
    const results = await Promise.all(calls);
    const values = results.map((r) => r.data).sort((a, b) => a - b);
    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
