export interface CollectionPolicyInput {
  method: 'automatic_collection' | 'qr_invoice' | null;
  clientActive: boolean;
  mandateStatus: string | null;
  channelConfigured: boolean;
  intentStatus: string;
  hasCollectionRequest: boolean;
  stopped: boolean;
}

export function shouldSubmitCollection(input: CollectionPolicyInput): boolean {
  return input.method === 'automatic_collection'
    && input.clientActive
    && !input.stopped
    && input.mandateStatus === 'active'
    && input.channelConfigured
    && !input.hasCollectionRequest
    && input.intentStatus !== 'paid'
    && input.intentStatus !== 'reversed';
}

export interface MembershipMoneyDecision {
  intentStatus: string;
  signal: 'payment_confirmed' | 'payment_reversed' | null;
  duplicateReceipt: boolean;
  setPaidAt: boolean;
  clearPaidAt: boolean;
}

export function decideMembershipMoney(input: {
  invoiceStatus: 'paid' | 'partially_paid' | 'issued' | 'cancelled' | 'reversed';
  intentStatus: string;
  hasConfirmedSignal: boolean;
  hasReversedSignal: boolean;
}): MembershipMoneyDecision {
  if (input.invoiceStatus === 'partially_paid' || input.invoiceStatus === 'issued') {
    return {
      intentStatus: input.intentStatus,
      signal: null,
      duplicateReceipt: false,
      setPaidAt: false,
      clearPaidAt: false,
    };
  }
  if (input.invoiceStatus === 'paid') {
    if (input.intentStatus === 'paid' || input.hasConfirmedSignal) {
      return {
        intentStatus: 'paid',
        signal: null,
        duplicateReceipt: true,
        setPaidAt: false,
        clearPaidAt: false,
      };
    }
    return {
      intentStatus: 'paid',
      signal: 'payment_confirmed',
      duplicateReceipt: false,
      setPaidAt: true,
      clearPaidAt: false,
    };
  }
  if (input.intentStatus === 'paid' || input.hasConfirmedSignal) {
    return {
      intentStatus: 'reversed',
      signal: input.hasReversedSignal ? null : 'payment_reversed',
      duplicateReceipt: false,
      setPaidAt: false,
      clearPaidAt: true,
    };
  }
  return {
    intentStatus: input.intentStatus === 'collection_submitted' ? 'collection_failed' : input.intentStatus,
    signal: null,
    duplicateReceipt: false,
    setPaidAt: false,
    clearPaidAt: false,
  };
}

export function isQrPayHidden(collectionStatus: string | null): boolean {
  return collectionStatus === 'submitted';
}

export type PaymentRail = 'collection_channel' | 'accounting_reconciliation';

/** A repeat read of the same rail is not a second settlement. The other rail is. */
export function settleMembershipRail(input: {
  invoiceStatus: 'paid' | 'partially_paid' | 'issued' | 'cancelled' | 'reversed';
  intentStatus: string;
  hasConfirmedSignal: boolean;
  hasReversedSignal: boolean;
  confirmedSource: PaymentRail | null;
  rail: PaymentRail;
}): MembershipMoneyDecision {
  const decision = decideMembershipMoney(input);
  if (decision.duplicateReceipt && input.confirmedSource === input.rail) {
    return { ...decision, duplicateReceipt: false };
  }
  return decision;
}

/** Ignore a channel snapshot older than the status already stored. */
export function acceptChannelObservation(observedAt: string, channelStatusAt: string | null): boolean {
  if (!channelStatusAt) return true;
  const observed = Date.parse(observedAt);
  const known = Date.parse(channelStatusAt);
  if (Number.isNaN(observed) || Number.isNaN(known)) return false;
  return observed >= known;
}
