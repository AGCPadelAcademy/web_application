export type MandateStatus =
  | 'not_requested'
  | 'proposal_sent'
  | 'active'
  | 'rejected'
  | 'revoked'
  | 'failed'
  | 'unsupported_bank';

export interface MandateAttempt {
  attemptNo: number;
  status: MandateStatus;
}

export type MandateDecision =
  | { action: 'reuse'; attemptNo: number }
  | { action: 'insert'; attemptNo: number }
  | { action: 'refuse'; reason: 'explicit_new_attempt_required' | 'new_attempt_not_allowed' | 'unsupported_bank' };

export function decideMandateAttempt(
  attempts: MandateAttempt[],
  explicitNewAttempt: boolean,
): MandateDecision {
  const latest = [...attempts].sort((a, b) => b.attemptNo - a.attemptNo)[0];
  const inFlight = attempts.find((attempt) => attempt.status === 'proposal_sent');
  if (inFlight) return { action: 'reuse', attemptNo: inFlight.attemptNo };
  if (!latest) return { action: 'insert', attemptNo: 1 };
  if (latest.status === 'unsupported_bank') return { action: 'refuse', reason: 'unsupported_bank' };
  if (latest.status === 'failed') return { action: 'reuse', attemptNo: latest.attemptNo };
  if (latest.status === 'rejected' || latest.status === 'revoked') {
    if (!explicitNewAttempt) return { action: 'refuse', reason: 'explicit_new_attempt_required' };
    return { action: 'insert', attemptNo: latest.attemptNo + 1 };
  }
  if (explicitNewAttempt) return { action: 'refuse', reason: 'new_attempt_not_allowed' };
  return { action: 'reuse', attemptNo: latest.attemptNo };
}
