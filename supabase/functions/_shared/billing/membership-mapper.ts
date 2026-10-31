import type { ExternalContactRef, InvoiceInput } from './accounting-provider.ts';
import type { BexioConfig } from './bexio/bexio-mappers.ts';
import { resolveSalesTaxId } from './bexio/tax-selection.ts';

export interface MembershipPeriodIntentRow {
  id: string;
  subject_id: string;
  client_id: string;
  membership_ref: string;
  period_key: string;
  claim_kind: 'month' | 'cancel_fee';
  charge_intent_id: string | null;
  display_label: string;
  amount: number;
  currency: 'CHF';
  status: string;
}

export function membershipPeriodToInvoiceInput(
  intent: MembershipPeriodIntentRow,
  contact: ExternalContactRef,
  config: BexioConfig,
  now: Date = new Date(),
): InvoiceInput & { taxId: number } {
  const validTo = new Date(now);
  validTo.setUTCDate(validTo.getUTCDate() + config.payment_term_days);
  return {
    apiReference: `agc:membership-period:${intent.id}`,
    contact,
    title: `${intent.display_label} — ${intent.period_key}`,
    lines: [{
      text: intent.display_label,
      amount: 1,
      unitPrice: Number(intent.amount),
    }],
    currency: 'CHF',
    isValidFrom: now.toISOString().slice(0, 10),
    isValidTo: validTo.toISOString().slice(0, 10),
    taxId: resolveSalesTaxId(config),
  };
}
