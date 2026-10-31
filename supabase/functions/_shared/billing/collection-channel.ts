export type MandateChannelStatus =
  | 'proposal_sent'
  | 'active'
  | 'rejected'
  | 'revoked'
  | 'failed'
  | 'unsupported_bank';

export class CollectionChannelNotConfiguredError extends Error {
  readonly code = 'collection_channel_not_configured';
  constructor() {
    super('collection_channel_not_configured');
    this.name = 'CollectionChannelNotConfiguredError';
  }
}

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
    status: 'submitted' | 'failed';
    externalCollectionRef: string | null;
    failureReason: string | null;
    observedAt: string;
  }>;
  readCollection(externalCollectionRef: string): Promise<{
    status: 'submitted' | 'confirmed' | 'failed' | 'rejected';
    failureReason: string | null;
    observedAt: string;
  }>;
}

export class UnconfiguredCollectionChannel implements CollectionChannel {
  isConfigured(): boolean {
    return false;
  }

  proposeMandate(_input: {
    subjectId: string;
    attemptNo: number;
    clientId: string;
    iban?: string;
  }): Promise<never> {
    return Promise.reject(new CollectionChannelNotConfiguredError());
  }

  readMandate(_externalMandateRef: string): Promise<never> {
    return Promise.reject(new CollectionChannelNotConfiguredError());
  }

  submitCollection(_input: {
    intentId: string;
    externalMandateRef: string;
    amount: string;
    currency: 'CHF';
  }): Promise<never> {
    return Promise.reject(new CollectionChannelNotConfiguredError());
  }

  readCollection(_externalCollectionRef: string): Promise<never> {
    return Promise.reject(new CollectionChannelNotConfiguredError());
  }
}
