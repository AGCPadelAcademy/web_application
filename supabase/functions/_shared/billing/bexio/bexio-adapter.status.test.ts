/**
 * Unit tests for numeric-totals invoice status (T030 / R-07).
 * Run with: deno test --allow-env --allow-net=none
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { BexioAdapter, deriveInvoiceStatus, isOverpaid } from './bexio-adapter.ts';
import type { BexioClient } from './bexio-client.ts';
import type { BexioConfig } from './bexio-mappers.ts';

const CONFIG = {
  bexio_user_id: 1,
  currency_id: 1,
  bank_account_id: 2,
  payment_type_id: 3,
  sales_account_id: 9,
  tax_id_sales: 14,
  unit_id: 5,
  language_id: 1,
  country_id_ch: 1,
  mwst_type: 0,
  mwst_is_net: false,
  payment_term_days: 30,
  template_slug: null,
  status_map: { draft: 7, cancelled: 16 },
} as BexioConfig;

Deno.test('deriveInvoiceStatus: received>0 and remaining<=0 → paid', () => {
  assertEquals(
    deriveInvoiceStatus({ total: 120, received: 120, remaining: 0, kbItemStatusId: 9 }),
    'paid',
  );
});

Deno.test('deriveInvoiceStatus: 0 < received < total → partially_paid', () => {
  assertEquals(
    deriveInvoiceStatus({ total: 120, received: 40, remaining: 80, kbItemStatusId: 9 }),
    'partially_paid',
  );
});

Deno.test('deriveInvoiceStatus: remaining<0 (overpayment) still paid', () => {
  assertEquals(
    deriveInvoiceStatus({ total: 120, received: 130, remaining: -10, kbItemStatusId: 9 }),
    'paid',
  );
  assertEquals(isOverpaid(130, 120), true);
  assertEquals(isOverpaid(120, 120), false);
});

Deno.test('deriveInvoiceStatus: status_map cancelled wins over unpaid issued', () => {
  assertEquals(
    deriveInvoiceStatus({
      total: 120,
      received: 0,
      remaining: 120,
      kbItemStatusId: 16,
      statusMap: CONFIG.status_map,
    }),
    'cancelled',
  );
});

Deno.test('deriveInvoiceStatus: status_map draft only when unpaid', () => {
  assertEquals(
    deriveInvoiceStatus({
      total: 120,
      received: 0,
      remaining: 120,
      kbItemStatusId: 7,
      statusMap: CONFIG.status_map,
    }),
    'draft',
  );
});

Deno.test('deriveInvoiceStatus: unknown kb_item_status_id with no receipt → issued', () => {
  assertEquals(
    deriveInvoiceStatus({ total: 120, received: 0, remaining: 120, kbItemStatusId: 9 }),
    'issued',
  );
});

Deno.test('getInvoice maps Bexio numeric totals through deriveInvoiceStatus', async () => {
  const adapter = new BexioAdapter(
    {
      request: async () => ({
        id: 42,
        document_nr: 'RE-00009',
        kb_item_status_id: 9,
        total: '120.00',
        total_received_payments: '120.00',
        total_remaining_payments: '0.00',
        qr_invoice_id: 1,
      }),
    } as unknown as BexioClient,
    CONFIG,
  );
  const invoice = await adapter.getInvoice({ externalId: '42' });
  assertEquals(invoice.status, 'paid');
  assertEquals(invoice.total, 120);
  assertEquals(invoice.received, 120);
  assertEquals(invoice.remaining, 0);
  assertEquals(invoice.hasQrPaymentPart, true);
});
