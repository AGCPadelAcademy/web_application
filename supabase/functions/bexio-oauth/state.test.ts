/**
 * Unit tests for the OAuth state nonce (T011).
 * Run with: deno test --allow-env --allow-net=none
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { signState, verifyState } from './state.ts';

const SECRET = 'test-state-secret';
const USER = 'user-123';

Deno.test('sign/verify roundtrip succeeds and carries the user id', async () => {
  const state = await signState(SECRET, USER, 600_000, () => 1_000);
  const result = await verifyState(SECRET, state, () => 1_001);
  assert(result.valid);
  assertEquals(result.userId, USER);
});

Deno.test('tampered signature is rejected', async () => {
  const state = await signState(SECRET, USER, 600_000, () => 1_000);
  const tampered = `${state.slice(0, -2)}00`;
  const result = await verifyState(SECRET, tampered, () => 1_001);
  assertEquals(result.valid, false);
});

Deno.test('tampered payload is rejected', async () => {
  const state = await signState(SECRET, USER, 600_000, () => 1_000);
  const parts = state.split('.');
  parts[2] = 'attacker-id'; // swap user id without re-signing
  const result = await verifyState(SECRET, parts.join('.'), () => 1_001);
  assertEquals(result.valid, false);
});

Deno.test('expired state is rejected', async () => {
  const state = await signState(SECRET, USER, 600_000, () => 1_000);
  const result = await verifyState(SECRET, state, () => 1_000 + 600_001);
  assertEquals(result.valid, false);
});

Deno.test('wrong secret is rejected', async () => {
  const state = await signState(SECRET, USER, 600_000, () => 1_000);
  const result = await verifyState('other-secret', state, () => 1_001);
  assertEquals(result.valid, false);
});

Deno.test('malformed state is rejected', async () => {
  assertEquals((await verifyState(SECRET, 'not-a-state', () => 1_000)).valid, false);
  assertEquals((await verifyState(SECRET, '', () => 1_000)).valid, false);
});
