import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { membershipPeriodToInvoiceInput } from './membership-mapper.ts';

const CONFIG = {
  bexio_user_id: 1,
  currency_id: 1,
  bank_account_id: 2,
  payment_type_id: 3,
  sales_account_id: 9,
  tax_id_sales: 14,
  taxes_sales: [{ id: 14, value: 0 }],
  unit_id: 5,
  mwst_type: 0,
  mwst_is_net: false,
  payment_term_days: 10,
};

Deno.test('maps one CHF line and copies the fee amount', () => {
  const input = membershipPeriodToInvoiceInput({
    id: 'intent-1',
    subject_id: 'subject-1',
    client_id: 'client-1',
    membership_ref: 'membership-1',
    period_key: '2026-08:fee',
    claim_kind: 'cancel_fee',
    charge_intent_id: 'charge-1',
    display_label: 'Tuesday Adults',
    amount: 20,
    currency: 'CHF',
    status: 'pending',
  }, { externalId: 'contact-1' }, CONFIG, new Date('2026-09-01T00:00:00.000Z'));

  assertEquals(input.apiReference, 'agc:membership-period:intent-1');
  assertEquals(input.lines.length, 1);
  assertEquals(input.lines[0].unitPrice, 20);
  assertEquals(input.currency, 'CHF');
  assertEquals(input.taxId, 14);
  assertEquals(input.title, 'Tuesday Adults — 2026-08:fee');
});
