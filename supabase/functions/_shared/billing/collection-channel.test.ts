import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  CollectionChannelNotConfiguredError,
  UnconfiguredCollectionChannel,
} from './collection-channel.ts';

Deno.test('unconfigured channel performs no I/O and refuses every call', async () => {
  const channel = new UnconfiguredCollectionChannel();
  assertEquals(channel.isConfigured(), false);
  await assertRejects(() => channel.proposeMandate({
    subjectId: 's',
    attemptNo: 1,
    clientId: 'c',
  }), CollectionChannelNotConfiguredError);
  await assertRejects(() => channel.readMandate('ref'), CollectionChannelNotConfiguredError);
  await assertRejects(() => channel.submitCollection({
    intentId: 'i',
    externalMandateRef: 'm',
    amount: '10.00',
    currency: 'CHF',
  }), CollectionChannelNotConfiguredError);
  await assertRejects(() => channel.readCollection('ref'), CollectionChannelNotConfiguredError);
});
