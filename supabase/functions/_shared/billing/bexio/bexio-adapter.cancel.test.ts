/**
 * Unit tests for BexioAdapter.cancelInvoice (T040).
 * Run with: deno test --allow-env --allow-net=none
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { BexioAdapter } from './bexio-adapter.ts';
import type { BexioClient } from './bexio-client.ts';
import type { BexioConfig } from './bexio-mappers.ts';
import { ProviderClientError } from '../accounting-provider.ts';

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
} as BexioConfig;

function adapterWithRequest(request: (...args: unknown[]) => Promise<unknown>): BexioAdapter {
  return new BexioAdapter({ request } as unknown as BexioClient, CONFIG);
}

Deno.test('cancelInvoice GETs the invoice then POSTs /cancel when unpaid', async () => {
  const calls: { method: unknown; path: unknown }[] = [];
  const adapter = adapterWithRequest(async (method, path) => {
    calls.push({ method, path });
    if (method === 'GET') {
      return {
        id: 42,
        document_nr: 'RE-00001',
        kb_item_status_id: 9,
        total: '120.00',
        total_received_payments: '0.00',
        total_remaining_payments: '120.00',
      };
    }
    return { success: true };
  });

  await adapter.cancelInvoice({ externalId: '42' });
  assertEquals(calls[0], { method: 'GET', path: '/2.0/kb_invoice/42' });
  assertEquals(calls[1], { method: 'POST', path: '/2.0/kb_invoice/42/cancel' });
});

Deno.test('cancelInvoice does not POST when Bexio already shows paid', async () => {
  const calls: unknown[] = [];
  const adapter = adapterWithRequest(async (method, path) => {
    calls.push({ method, path });
    return {
      id: 42,
      kb_item_status_id: 9,
      total: '120.00',
      total_received_payments: '120.00',
      total_remaining_payments: '0.00',
    };
  });

  await assertRejects(
    () => adapter.cancelInvoice({ externalId: '42' }),
    ProviderClientError,
  );
  assertEquals(calls.length, 1);
});
