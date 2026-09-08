/**
 * Camp registration → InvoiceInput mapper (F1.25).
 * Contract: specs/features/010-padel-camps/contracts/camp-billing.md
 */

import type { ExternalContactRef, InvoiceInput } from './accounting-provider.ts';
import type { BexioConfig } from './bexio/bexio-mappers.ts';

export interface CampRegistrationRow {
  id: string;
  camp_id: string;
  child_id: string;
  parent_id: string;
  status: string;
  payment_status: string;
  camp_name: string;
  camp_start_date: string;
  camp_end_date: string;
  camp_schedule_text?: string | null;
  child_first_name?: string;
  child_last_name?: string;
  parent_full_name?: string;
  parent_email?: string;
  base_price: number;
  extras_total?: number;
  total_amount: number;
  currency: 'CHF' | string;
  practical_info?: string | null;
}

export interface CampRegistrationExtraRow {
  name: string;
  price_amount: number;
}

export function campRegistrationToInvoiceInput(
  registration: CampRegistrationRow,
  extras: CampRegistrationExtraRow[],
  contact: ExternalContactRef,
  config: BexioConfig,
  now: Date = new Date(),
): InvoiceInput {
  const isValidFrom = now.toISOString().slice(0, 10);
  const validTo = new Date(now);
  validTo.setUTCDate(validTo.getUTCDate() + config.payment_term_days);

  const title = `${registration.camp_name} — ${registration.camp_start_date} → ${registration.camp_end_date}`;
  const lines = [
    {
      text: registration.camp_name,
      amount: 1,
      unitPrice: Number(registration.base_price),
    },
    ...extras.map((extra) => ({
      text: extra.name,
      amount: 1,
      unitPrice: Number(extra.price_amount),
    })),
  ];

  return {
    apiReference: `agc:camp-registration:${registration.id}`,
    contact,
    title,
    lines,
    currency: 'CHF',
    isValidFrom,
    isValidTo: validTo.toISOString().slice(0, 10),
  };
}
