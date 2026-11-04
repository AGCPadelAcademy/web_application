import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  acceptChannelObservation,
  decideMembershipMoney,
  shouldSubmitCollection,
} from './membership-collection-policy.ts';

const ready = {
  method: 'automatic_collection' as const,
  clientActive: true,
  mandateStatus: 'active',
  channelConfigured: true,
  intentStatus: 'invoiced',
  hasCollectionRequest: false,
  stopped: false,
};

Deno.test('submits one collection only when the mandate is active', () => {
  assertEquals(shouldSubmitCollection(ready), true);
  assertEquals(shouldSubmitCollection({ ...ready, hasCollectionRequest: true }), false);
  assertEquals(shouldSubmitCollection({ ...ready, channelConfigured: false }), false);
});

Deno.test('paying once signals and a repeat does not signal again', () => {
  assertEquals(decideMembershipMoney({
    invoiceStatus: 'paid',
    intentStatus: 'invoiced',
    hasConfirmedSignal: false,
    hasReversedSignal: false,
  }).signal, 'payment_confirmed');
  const again = decideMembershipMoney({
    invoiceStatus: 'paid',
    intentStatus: 'paid',
    hasConfirmedSignal: true,
    hasReversedSignal: false,
  });
  assertEquals(again.signal, null);
  assertEquals(again.duplicateReceipt, true);
});

Deno.test('a stale decision does not treat partial payment as paid', () => {
  const partial = decideMembershipMoney({
    invoiceStatus: 'partially_paid',
    intentStatus: 'invoiced',
    hasConfirmedSignal: false,
    hasReversedSignal: false,
  });
  assertEquals(partial.setPaidAt, false);
  assertEquals(partial.signal, null);
});

Deno.test('a channel snapshot older than channel_status_at is ignored', () => {
  assertEquals(acceptChannelObservation('2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z'), false);
  assertEquals(acceptChannelObservation('2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z'), true);
  assertEquals(acceptChannelObservation('2026-09-02T00:00:00.000Z', null), true);
});
