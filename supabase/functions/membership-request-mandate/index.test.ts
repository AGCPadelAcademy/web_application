import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { UnconfiguredCollectionChannel, type CollectionChannel } from '../_shared/billing/collection-channel.ts';
import {
  handleRequestMandate,
  type RequestMandateDeps,
  type RequestMandateSubject,
} from './index.ts';

function subject(overrides: Partial<RequestMandateSubject> = {}): RequestMandateSubject {
  return {
    id: 'subject-1',
    client_id: 'client-1',
    client_active: true,
    caller_role: 'student',
    caller_active: true,
    caller_exists: true,
    attempts: [],
    ...overrides,
  };
}

function configuredChannel(): CollectionChannel & { proposals: number } {
  const state = { proposals: 0 };
  return {
    get proposals() {
      return state.proposals;
    },
    isConfigured: () => true,
    proposeMandate: () => {
      state.proposals += 1;
      return Promise.resolve({
        status: 'proposal_sent' as const,
        externalMandateRef: null,
        externalBillerRef: null,
        failureReason: null,
        observedAt: '2026-09-01T00:00:00.000Z',
      });
    },
    readMandate: () => Promise.reject(new Error('unused')),
    submitCollection: () => Promise.reject(new Error('unused')),
    readCollection: () => Promise.reject(new Error('unused')),
  };
}

async function call(
  body: Record<string, string>,
  row: RequestMandateSubject | null,
  channel: CollectionChannel = new UnconfiguredCollectionChannel(),
) {
  const inserted: number[] = [];
  const deps: RequestMandateDeps = {
    channel,
    load: async () => row,
    insertProposal: async (_id, attemptNo) => {
      inserted.push(attemptNo);
    },
  };
  const response = await handleRequestMandate(new Request('http://local/mandate', {
    method: 'POST',
    body: JSON.stringify(body),
  }), deps);
  return { response, body: await response.json(), inserted };
}

Deno.test('a different client cannot request a mandate', async () => {
  const result = await call({ subject_id: 'subject-1', caller_id: 'other' }, subject());
  assertEquals(result.response.status, 403);
});

Deno.test('an inactive client is refused', async () => {
  const result = await call(
    { subject_id: 'subject-1', caller_id: 'client-1' },
    subject({ client_active: false, attempts: [{ attemptNo: 1, status: 'rejected' }] }),
  );
  assertEquals(result.response.status, 409);
  assertEquals(result.body.error, 'client_inactive');
});

Deno.test('an unconfigured channel does not create a proposal', async () => {
  const result = await call(
    { subject_id: 'subject-1', caller_id: 'client-1' },
    subject({ attempts: [{ attemptNo: 1, status: 'rejected' }] }),
  );
  assertEquals(result.response.status, 409);
  assertEquals(result.body.error, 'collection_channel_not_configured');
  assertEquals(result.inserted, []);
});

Deno.test('a proposal already in flight is returned without a second row', async () => {
  const result = await call(
    { subject_id: 'subject-1', caller_id: 'client-1' },
    subject({ attempts: [{ attemptNo: 1, status: 'proposal_sent' }] }),
  );
  assertEquals(result.response.status, 200);
  assertEquals(result.body.attempt_no, 1);
  assertEquals(result.inserted, []);
});

Deno.test('rejection plus an explicit request creates the next attempt once', async () => {
  const channel = configuredChannel();
  const result = await call(
    { subject_id: 'subject-1', caller_id: 'client-1' },
    subject({ attempts: [{ attemptNo: 1, status: 'rejected' }] }),
    channel,
  );
  assertEquals(result.response.status, 200);
  assertEquals(result.body.attempt_no, 2);
  assertEquals(result.inserted, [2]);
  assertEquals(channel.proposals, 1);
});
