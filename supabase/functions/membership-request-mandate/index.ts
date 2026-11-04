import { canAdminister, parseProfileAccess } from '../_shared/profile-access.ts';
import {
  CollectionChannelNotConfiguredError,
  UnconfiguredCollectionChannel,
  type CollectionChannel,
} from '../_shared/billing/collection-channel.ts';
import { decideMandateAttempt, type MandateAttempt } from '../_shared/billing/mandate-attempts.ts';
import { callerIdFromRequest, insertMandateProposal, loadCollectionSubject } from '../_shared/billing/membership-store.ts';

export interface RequestMandateSubject {
  id: string;
  client_id: string;
  client_active: boolean;
  caller_role: string;
  caller_active: boolean;
  caller_exists: boolean;
  attempts: MandateAttempt[];
}

export interface RequestMandateDeps {
  channel: CollectionChannel;
  load(subjectId: string, callerId: string): Promise<RequestMandateSubject | null>;
  insertProposal(subjectId: string, attemptNo: number): Promise<void>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function handleRequestMandate(req: Request, deps: RequestMandateDeps): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { subject_id?: string; caller_id?: string };
  if (!body.subject_id || !body.caller_id) return json({ error: 'invalid_request' }, 422);
  const subject = await deps.load(body.subject_id, body.caller_id);
  if (!subject) return json({ error: 'not_found' }, 404);
  const access = parseProfileAccess({ role: subject.caller_role, is_active: subject.caller_active });
  if (subject.client_id !== body.caller_id && !canAdminister({ ...access, exists: subject.caller_exists })) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!subject.client_active) return json({ error: 'client_inactive' }, 409);
  const decision = decideMandateAttempt(subject.attempts, true);
  if (decision.action === 'reuse') {
    const reused = subject.attempts.find((attempt) => attempt.attemptNo === decision.attemptNo);
    if (reused?.status === 'proposal_sent') {
      return json({ attempt_no: decision.attemptNo, status: 'proposal_sent' });
    }
    return json({ error: 'new_attempt_not_allowed' }, 409);
  }
  if (decision.action === 'refuse') return json({ error: decision.reason }, 409);
  if (!deps.channel.isConfigured()) return json({ error: 'collection_channel_not_configured' }, 409);
  try {
    await deps.channel.proposeMandate({
      subjectId: subject.id,
      attemptNo: decision.attemptNo,
      clientId: subject.client_id,
    });
  } catch (error) {
    if (error instanceof CollectionChannelNotConfiguredError) {
      return json({ error: 'collection_channel_not_configured' }, 409);
    }
    throw error;
  }
  await deps.insertProposal(subject.id, decision.attemptNo);
  return json({ attempt_no: decision.attemptNo, status: 'proposal_sent' });
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    const callerId = await callerIdFromRequest(req);
    if (!callerId) return json({ error: 'unauthenticated' }, 401);
    const raw = await req.json().catch(() => ({})) as { subject_id?: string };
    return handleRequestMandate(new Request(req.url, {
      method: 'POST',
      body: JSON.stringify({ subject_id: raw.subject_id, caller_id: callerId }),
    }), {
      channel: new UnconfiguredCollectionChannel(),
      load: (subjectId, id) => loadCollectionSubject(subjectId, id),
      insertProposal: insertMandateProposal,
    });
  });
}
