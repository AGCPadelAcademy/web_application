import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decideMembershipMoney, settleMembershipRail, shouldSubmitCollection } from './membership-collection-policy.ts';

Deno.test('failed collection is not paid and stop blocks a new submission', () => {
  const failed = decideMembershipMoney({
    invoiceStatus: 'issued',
    intentStatus: 'collection_submitted',
    hasConfirmedSignal: false,
    hasReversedSignal: false,
  });
  assertEquals(failed.signal, null);
  assertEquals(failed.setPaidAt, false);
  assertEquals(shouldSubmitCollection({
    method: 'qr_invoice',
    clientActive: true,
    mandateStatus: 'active',
    channelConfigured: true,
    intentStatus: 'collection_submitted',
    hasCollectionRequest: true,
    stopped: true,
  }), false);
  assertEquals(shouldSubmitCollection({
    method: 'automatic_collection',
    clientActive: false,
    mandateStatus: 'active',
    channelConfigured: true,
    intentStatus: 'invoiced',
    hasCollectionRequest: false,
    stopped: false,
  }), false);
});

Deno.test('reversal clears paid and a second settlement is a duplicate receipt', () => {
  const reversed = decideMembershipMoney({
    invoiceStatus: 'cancelled',
    intentStatus: 'paid',
    hasConfirmedSignal: true,
    hasReversedSignal: false,
  });
  assertEquals(reversed.signal, 'payment_reversed');
  assertEquals(reversed.clearPaidAt, true);
  assertEquals(reversed.intentStatus, 'reversed');
  const duplicate = decideMembershipMoney({
    invoiceStatus: 'paid',
    intentStatus: 'paid',
    hasConfirmedSignal: true,
    hasReversedSignal: false,
  });
  assertEquals(duplicate.duplicateReceipt, true);
  assertEquals(duplicate.signal, null);
});

Deno.test('the same payment rail does not look like a second settlement', () => {
  const replay = settleMembershipRail({
    invoiceStatus: 'paid',
    intentStatus: 'paid',
    hasConfirmedSignal: true,
    hasReversedSignal: false,
    confirmedSource: 'accounting_reconciliation',
    rail: 'accounting_reconciliation',
  });
  assertEquals(replay.duplicateReceipt, false);
  assertEquals(replay.signal, null);
  const otherRail = settleMembershipRail({
    invoiceStatus: 'paid',
    intentStatus: 'paid',
    hasConfirmedSignal: true,
    hasReversedSignal: false,
    confirmedSource: 'collection_channel',
    rail: 'accounting_reconciliation',
  });
  assertEquals(otherRail.duplicateReceipt, true);
  assertEquals(otherRail.signal, null);
});
