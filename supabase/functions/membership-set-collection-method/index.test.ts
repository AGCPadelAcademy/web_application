import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { UnconfiguredCollectionChannel } from '../_shared/billing/collection-channel.ts';
import { handleSetCollectionMethod, type CollectionSubjectRow, type SetMethodDeps } from './index.ts';

function subject(overrides: Partial<CollectionSubjectRow> = {}): CollectionSubjectRow {
  return {
    id: 'subject-1',
    client_id: 'client-1',
    client_active: true,
    caller_role: 'student',
    caller_active: true,
    caller_exists: true,
    method: 'qr_invoice',
    attempts: [],
    ...overrides,
  };
}

function deps(row: CollectionSubjectRow | null): SetMethodDeps & { saved: string[] } {
  const saved: string[] = [];
  return {
    channel: new UnconfiguredCollectionChannel(),
    saved,
    load: async () => row,
    saveMethod: async (_id, method) => {
      saved.push(method);
    },
    insertProposal: async () => {},
  };
}

function call(body: Record<string, string>, row: CollectionSubjectRow | null) {
  const used = deps(row);
  return handleSetCollectionMethod(new Request('http://local/set', {
    method: 'POST',
    body: JSON.stringify(body),
  }), used).then(async (response) => ({ response, body: await response.json(), saved: used.saved }));
}

Deno.test('a different client is forbidden', async () => {
  const result = await call(
    { subject_id: 'subject-1', method: 'qr_invoice', caller_id: 'other' },
    subject(),
  );
  assertEquals(result.response.status, 403);
});

Deno.test('an inactive client cannot opt in', async () => {
  const result = await call(
    { subject_id: 'subject-1', method: 'automatic_collection', caller_id: 'client-1' },
    subject({ client_active: false }),
  );
  assertEquals(result.response.status, 409);
  assertEquals(result.body.error, 'client_inactive');
});

Deno.test('an unconfigured channel refuses opt-in and leaves QR', async () => {
  const result = await call(
    { subject_id: 'subject-1', method: 'automatic_collection', caller_id: 'client-1' },
    subject(),
  );
  assertEquals(result.response.status, 409);
  assertEquals(result.body.error, 'collection_channel_not_configured');
  assertEquals(result.body.method, 'qr_invoice');
  assertEquals(result.saved, []);
});

Deno.test('qr_invoice is stored with stopped_at', async () => {
  const result = await call(
    { subject_id: 'subject-1', method: 'qr_invoice', caller_id: 'client-1' },
    subject(),
  );
  assertEquals(result.response.status, 200);
  assertEquals(result.body.stopped_at, true);
  assertEquals(result.saved, ['qr_invoice']);
});
