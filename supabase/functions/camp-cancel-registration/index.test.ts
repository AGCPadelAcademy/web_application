/**
 * camp-cancel-registration unit tests (T040).
 * Run with: deno test --allow-env --allow-net=none
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canMutateOwnedResource, parseProfileAccess } from '../_shared/profile-access.ts';
import { mapCancelConflict } from '../_shared/camps/validate.ts';

Deno.test('owner-only unpaid cancel authorization', () => {
  const parent = parseProfileAccess({ role: 'student', is_active: true });
  assertEquals(canMutateOwnedResource(parent, true), true);
  assertEquals(canMutateOwnedResource(parent, false), false);
  const admin = parseProfileAccess({ role: 'admin', is_active: true });
  assertEquals(canMutateOwnedResource(admin, false), true);
});

Deno.test('paid invoices map to refund_agreement_required', () => {
  assertEquals(mapCancelConflict('paid'), { error: 'refund_agreement_required', status: 409 });
  assertEquals(mapCancelConflict('cancel_refused'), { error: 'cancel_refused', status: 409 });
});
