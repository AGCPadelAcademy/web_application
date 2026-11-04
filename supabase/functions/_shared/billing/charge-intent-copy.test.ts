import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { draftsFromCharges, monthPaymentLeavesFee } from './charge-intent-copy.ts';

const month = {
  id: 'charge-month',
  membershipId: 'membership-1',
  clientId: 'client-1',
  periodKey: '2026-08',
  kind: 'month' as const,
  amount: 200,
  currency: 'CHF' as const,
  displayLabel: 'Tuesday Adults',
};

const fee = {
  ...month,
  id: 'charge-fee',
  periodKey: '2026-08:fee',
  kind: 'cancel_fee' as const,
  amount: 20,
};

Deno.test('copies month and fee amounts unchanged and skips a second copy', () => {
  const first = draftsFromCharges([month, fee], new Set());
  assertEquals(first.map((row) => [row.periodKey, row.amount]), [
    ['2026-08', 200],
    ['2026-08:fee', 20],
  ]);
  const second = draftsFromCharges([month, fee], new Set(['charge-month', 'charge-fee']));
  assertEquals(second, []);
});

Deno.test('paying the month does not mark the fee paid', () => {
  assertEquals(monthPaymentLeavesFee(true, 'invoiced'), 'invoiced');
});
