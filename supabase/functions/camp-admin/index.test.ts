/**
 * camp-admin validation + auth mapping tests (T012 / T048).
 * Run with: deno test --allow-env --allow-net=none
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canAdminister, parseProfileAccess } from '../_shared/profile-access.ts';
import { mapCampDbError, validateCampPayload, validateExtraPayload } from '../_shared/camps/validate.ts';

const validCamp = {
  name: 'Junior Camp',
  slug: 'junior-camp',
  start_date: '2026-10-12',
  end_date: '2026-10-16',
  price_amount: 349,
  max_capacity: 12,
};

Deno.test('non-admin cannot administer camps', () => {
  assertEquals(canAdminister(parseProfileAccess({ role: 'student', is_active: true })), false);
  assertEquals(canAdminister(parseProfileAccess({ role: 'admin', is_active: false })), false);
  assertEquals(canAdminister(parseProfileAccess({ role: 'admin', is_active: true })), true);
});

Deno.test('rejects invalid date order, negative price, and non-positive capacity', () => {
  assertEquals(validateCampPayload({ ...validCamp, end_date: '2026-10-01' }).ok, false);
  assertEquals(validateCampPayload({ ...validCamp, price_amount: -1 }).ok, false);
  assertEquals(validateCampPayload({ ...validCamp, max_capacity: 0 }).ok, false);
  assertEquals(validateCampPayload(validCamp).ok, true);
});

Deno.test('rejects extra with negative price', () => {
  assertEquals(validateExtraPayload({ name: 'Lunch', price_amount: -5 }).ok, false);
  assertEquals(validateExtraPayload({ name: 'Lunch', price_amount: 25 }).ok, true);
});

Deno.test('accepts an optional non-negative member price', () => {
  assertEquals(validateCampPayload({ ...validCamp, member_price_amount: 299 }).ok, true);
  assertEquals(validateCampPayload({ ...validCamp, member_price_amount: null }).ok, true);
  assertEquals(validateCampPayload({ ...validCamp, member_price_amount: -1 }).ok, false);
  assertEquals(validateCampPayload({ ...validCamp, member_price_amount: 'abc' }).ok, true);
});

Deno.test('maps waitlist and register SQL errors', () => {
  assertEquals(mapCampDbError('camp_waitlist_unavailable'), 'camp_waitlist_unavailable');
  assertEquals(mapCampDbError('{"message":"camp_full"}'), 'camp_full');
  assertEquals(mapCampDbError('duplicate_registration'), 'duplicate_registration');
  assertEquals(mapCampDbError('member_price_unavailable'), 'member_price_unavailable');
});
