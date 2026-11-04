import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decideMandateAttempt } from './mandate-attempts.ts';

Deno.test('one in-flight proposal is reused', () => {
  assertEquals(
    decideMandateAttempt([{ attemptNo: 1, status: 'proposal_sent' }], false),
    { action: 'reuse', attemptNo: 1 },
  );
});

Deno.test('rejected or revoked needs an explicit next attempt', () => {
  assertEquals(
    decideMandateAttempt([{ attemptNo: 1, status: 'rejected' }], false),
    { action: 'refuse', reason: 'explicit_new_attempt_required' },
  );
  assertEquals(
    decideMandateAttempt([{ attemptNo: 1, status: 'revoked' }], true),
    { action: 'insert', attemptNo: 2 },
  );
});

Deno.test('failed retries the same attempt and unsupported bank is terminal', () => {
  assertEquals(
    decideMandateAttempt([{ attemptNo: 2, status: 'failed' }], false),
    { action: 'reuse', attemptNo: 2 },
  );
  assertEquals(
    decideMandateAttempt([{ attemptNo: 1, status: 'unsupported_bank' }], true),
    { action: 'refuse', reason: 'unsupported_bank' },
  );
});
