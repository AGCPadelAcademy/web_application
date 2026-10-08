# Contract: Collection channel port

**Feature**: `specs/features/011-membership-automatic-collection/spec.md` | **Date**: 2026-10-08

Server-side Deno port under `supabase/functions/_shared/billing/collection-channel.ts`. Domain code and the React app never call a bank, SIX, or Bexio for Direct Debit. The shipped implementation is `UnconfiguredCollectionChannel`.

## Port

```typescript
export type MandateChannelStatus =
  | 'proposal_sent'
  | 'active'
  | 'rejected'
  | 'revoked'
  | 'failed'
  | 'unsupported_bank';

export interface CollectionChannel {
  isConfigured(): boolean;
  proposeMandate(input: {
    subjectId: string;
    attemptNo: number;
    clientId: string;
    iban?: string;
  }): Promise<{
    status: MandateChannelStatus;
    externalMandateRef: string | null;
    externalBillerRef: string | null;
    failureReason: string | null;
    observedAt: string;
  }>;
  readMandate(externalMandateRef: string): Promise<{
    status: MandateChannelStatus;
    failureReason: string | null;
    observedAt: string;
  }>;
  submitCollection(input: {
    intentId: string;
    externalMandateRef: string;
    amount: string;
    currency: 'CHF';
  }): Promise<{
    externalCollectionRef: string;
    status: 'submitted' | 'failed' | 'rejected';
    failureReason: string | null;
    observedAt: string;
  }>;
  readCollection(externalCollectionRef: string): Promise<{
    status: 'submitted' | 'confirmed' | 'failed' | 'rejected';
    failureReason: string | null;
    observedAt: string;
  }>;
}
```

## Unconfigured adapter

- `isConfigured()` returns false.
- Every other method throws `collection_channel_not_configured` and performs no I/O.
- Callers treat that as: do not offer opt-in, do not insert a `proposal_sent` row, leave QR available.

## Rules

- No method accepts a bank password, e-banking session, or standing-order instruction.
- `observedAt` is stored on `channel_status_at`. A result older than the stored timestamp is ignored.
- A future configured adapter must keep these method names and status strings. It must read secrets from Vault inside the adapter, not from the client.
- Idempotency of proposals and collections is enforced by the database indexes in [data-model.md](../data-model.md) before the port is called a second time.
