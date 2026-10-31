export interface ChargeIntentSource {
  id: string;
  membershipId: string;
  clientId: string;
  periodKey: string;
  kind: 'month' | 'cancel_fee';
  amount: number;
  currency: 'CHF';
  displayLabel: string;
}

export interface PeriodIntentDraft {
  chargeIntentId: string;
  membershipRef: string;
  clientId: string;
  periodKey: string;
  claimKind: 'month' | 'cancel_fee';
  amount: number;
  currency: 'CHF';
  displayLabel: string;
}

export function draftsFromCharges(
  charges: ChargeIntentSource[],
  alreadyCopiedIds: Set<string>,
): PeriodIntentDraft[] {
  return charges
    .filter((charge) => !alreadyCopiedIds.has(charge.id))
    .map((charge) => ({
      chargeIntentId: charge.id,
      membershipRef: charge.membershipId,
      clientId: charge.clientId,
      periodKey: charge.periodKey,
      claimKind: charge.kind,
      amount: Number(charge.amount),
      currency: 'CHF',
      displayLabel: charge.displayLabel,
    }));
}

export function monthPaymentLeavesFee(monthPaid: boolean, feeStatus: string): string {
  if (!monthPaid) return feeStatus;
  return feeStatus;
}
