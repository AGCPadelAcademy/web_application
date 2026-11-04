import { canAdminister, parseProfileAccess } from '../_shared/profile-access.ts';
import {
  CollectionChannelNotConfiguredError,
  UnconfiguredCollectionChannel,
  type CollectionChannel,
} from '../_shared/billing/collection-channel.ts';
import { decideMandateAttempt, type MandateAttempt } from '../_shared/billing/mandate-attempts.ts';
import { callerIdFromRequest, insertMandateProposal, loadCollectionSubject, saveCollectionMethod } from '../_shared/billing/membership-store.ts';

export interface CollectionSubjectRow {
  id: string;
  client_id: string;
  client_active: boolean;
  caller_role: string;
  caller_active: boolean;
  caller_exists: boolean;
  method: 'automatic_collection' | 'qr_invoice' | null;
  attempts: MandateAttempt[];
}

export interface SetMethodDeps {
  channel: CollectionChannel;
  load(subjectId: string, callerId: string): Promise<CollectionSubjectRow | null>;
  saveMethod(subjectId: string, method: 'automatic_collection' | 'qr_invoice', stopped: boolean): Promise<void>;
  insertProposal(subjectId: string, attemptNo: number): Promise<void>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleSetCollectionMethod(req: Request, deps: SetMethodDeps): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { subject_id?: string; method?: string; caller_id?: string };
  const callerId = body.caller_id ?? '';
  if (!callerId || !body.subject_id || (body.method !== 'automatic_collection' && body.method !== 'qr_invoice')) {
    return json({ error: 'invalid_request' }, 422);
  }
  const subject = await deps.load(body.subject_id, callerId);
  if (!subject) return json({ error: 'not_found' }, 404);
  const access = parseProfileAccess({ role: subject.caller_role, is_active: subject.caller_active });
  const isOwner = subject.client_id === callerId;
  if (!isOwner && !canAdminister({ ...access, exists: subject.caller_exists })) {
    return json({ error: 'forbidden' }, 403);
  }
  if (body.method === 'automatic_collection' && !subject.client_active) {
    return json({ error: 'client_inactive' }, 409);
  }
  if (body.method === 'automatic_collection' && !deps.channel.isConfigured()) {
    return json({ error: 'collection_channel_not_configured', method: 'qr_invoice' }, 409);
  }
  if (body.method === 'qr_invoice') {
    await deps.saveMethod(subject.id, 'qr_invoice', true);
    return json({ method: 'qr_invoice', stopped_at: true });
  }
  const decision = decideMandateAttempt(subject.attempts, false);
  if (decision.action === 'refuse') return json({ error: decision.reason }, 409);
  await deps.saveMethod(subject.id, 'automatic_collection', false);
  if (decision.action === 'insert') {
    try {
      await deps.channel.proposeMandate({
        subjectId: subject.id,
        attemptNo: decision.attemptNo,
        clientId: subject.client_id,
      });
      await deps.insertProposal(subject.id, decision.attemptNo);
    } catch (error) {
      if (error instanceof CollectionChannelNotConfiguredError) {
        return json({ error: 'collection_channel_not_configured', method: 'qr_invoice' }, 409);
      }
      throw error;
    }
  }
  return json({ method: 'automatic_collection', attempt: decision });
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    const callerId = await callerIdFromRequest(req);
    if (!callerId) return json({ error: 'unauthenticated' }, 401);
    const raw = await req.json().catch(() => ({})) as { subject_id?: string; method?: string };
    return handleSetCollectionMethod(new Request(req.url, {
      method: 'POST',
      body: JSON.stringify({ ...raw, caller_id: callerId }),
    }), {
      channel: new UnconfiguredCollectionChannel(),
      load: (subjectId, id) => loadCollectionSubject(subjectId, id),
      saveMethod: (subjectId, method, stopped) => saveCollectionMethod(subjectId, method, stopped, callerId),
      insertProposal: insertMandateProposal,
    });
  });
}
