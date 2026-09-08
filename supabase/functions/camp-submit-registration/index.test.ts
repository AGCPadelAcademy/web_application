/**
 * camp-submit-registration unit tests (T028).
 * Run with: deno test --allow-env --allow-net=none
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { canMutateOwnedResource, parseProfileAccess } from '../_shared/profile-access.ts';
import { isBillingProfileComplete, mapSubmitError } from '../_shared/camps/validate.ts';

Deno.test('inactive or non-owner parent is refused', () => {
  const inactive = parseProfileAccess({ role: 'student', is_active: false });
  assertEquals(canMutateOwnedResource(inactive, true), false);
  const other = parseProfileAccess({ role: 'student', is_active: true });
  assertEquals(canMutateOwnedResource(other, false), false);
  assertEquals(canMutateOwnedResource(other, true), true);
});

Deno.test('profile completeness gate matches lesson billing fields', () => {
  assertEquals(isBillingProfileComplete({
    first_name: 'A',
    last_name: 'B',
    phone: '+41',
    address: 'x',
    postal_code: '8000',
    city: 'Zürich',
    country_code: 'CH',
  }), true);
  assertEquals(isBillingProfileComplete({
    first_name: 'A',
    last_name: 'B',
    phone: '',
    address: 'x',
    postal_code: '8000',
    city: 'Zürich',
    country_code: 'CH',
  }), false);
});

Deno.test('maps register_camp_child errors to 409 codes', () => {
  for (const code of [
    'camp_full',
    'camp_closed',
    'camp_not_published',
    'age_out_of_range',
    'duplicate_registration',
  ]) {
    assertEquals(mapSubmitError(code), { error: code, status: 409 });
  }
  assertEquals(mapSubmitError('terms missing').error, 'register_failed');
});
