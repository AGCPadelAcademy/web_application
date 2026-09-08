/**
 * Unit tests for camp-mapper (T034). Run with: deno test --allow-env --allow-net=none
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { campRegistrationToInvoiceInput } from './camp-mapper.ts';
import { resolveSalesTaxId } from './bexio/tax-selection.ts';

const CONFIG = {
  bexio_user_id: 1,
  currency_id: 1,
  bank_account_id: 2,
  payment_type_id: 3,
  sales_account_id: 9,
  tax_id_sales: 14,
  unit_id: 5,
  mwst_type: 0,
  mwst_is_net: false,
  payment_term_days: 14,
};

const REGISTRATION = {
  id: 'r0000000-0000-4000-8000-000000000001',
  camp_id: 'c0000000-0000-4000-8000-000000000001',
  child_id: 'k0000000-0000-4000-8000-000000000001',
  parent_id: 'p0000000-0000-4000-8000-000000000001',
  status: 'pending_payment',
  payment_status: 'pending',
  camp_name: 'Junior Camp',
  camp_start_date: '2026-10-12',
  camp_end_date: '2026-10-16',
  base_price: 349,
  total_amount: 374,
  currency: 'CHF' as const,
};

const NOW = new Date('2026-09-08T12:00:00Z');

Deno.test('maps Camp base line plus extras, CHF total, api_reference, payment term', () => {
  const input = campRegistrationToInvoiceInput(
    REGISTRATION,
    [{ name: 'Lunch', price_amount: 25 }],
    { externalId: 'contact-1' },
    CONFIG,
    NOW,
  );

  assertEquals(input.apiReference, `agc:camp-registration:${REGISTRATION.id}`);
  assertEquals(input.title, 'Junior Camp — 2026-10-12 → 2026-10-16');
  assertEquals(input.currency, 'CHF');
  assertEquals(input.isValidFrom, '2026-09-08');
  assertEquals(input.isValidTo, '2026-09-22');
  assertEquals(input.lines, [
    { text: 'Junior Camp', amount: 1, unitPrice: 349 },
    { text: 'Lunch', amount: 1, unitPrice: 25 },
  ]);
});

Deno.test('uses the same 0% tax selection as lesson invoices (no camp-specific tax)', () => {
  assertEquals(resolveSalesTaxId(CONFIG), CONFIG.tax_id_sales);
});
