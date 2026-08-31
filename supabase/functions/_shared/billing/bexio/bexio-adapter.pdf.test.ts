/**
 * Unit tests for BexioAdapter.getInvoicePdf (T026 / R-11).
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

Deno.test('getInvoicePdf decodes official Bexio { content, name } payload (R-11)', async () => {
  const pdfBody = '%PDF-1.4 test';
  const adapter = adapterWithRequest(async (method, path) => {
    assertEquals(method, 'GET');
    assertEquals(path, '/2.0/kb_invoice/42/pdf');
    return { content: btoa(pdfBody), name: 'RE-00001.pdf', mime: 'application/pdf', size: 13 };
  });

  const pdf = await adapter.getInvoicePdf({ externalId: '42' });
  assertEquals(pdf.fileName, 'RE-00001.pdf');
  assertEquals(new TextDecoder().decode(pdf.bytes), pdfBody);
});

Deno.test('getInvoicePdf accepts a legacy { data, name } payload', async () => {
  const pdfBody = '%PDF-1.4 legacy';
  const adapter = adapterWithRequest(async () => ({ data: btoa(pdfBody), name: 'RE-00002.pdf' }));
  const pdf = await adapter.getInvoicePdf({ externalId: '42' });
  assertEquals(pdf.fileName, 'RE-00002.pdf');
  assertEquals(new TextDecoder().decode(pdf.bytes), pdfBody);
});

Deno.test('getInvoicePdf rejects a payload without content or data', async () => {
  const adapter = adapterWithRequest(async () => ({ name: 'RE-00001.pdf' }));
  await assertRejects(
    () => adapter.getInvoicePdf({ externalId: '42' }),
    ProviderClientError,
  );
});

Deno.test('sendInvoiceEmail posts attach_pdf to /kb_invoice/{id}/send (R-16)', async () => {
  let captured: { method?: unknown; path?: unknown; body?: Record<string, unknown> } = {};
  const adapter = adapterWithRequest(async (method, path, options) => {
    captured = { method, path, body: (options as { body?: Record<string, unknown> }).body };
    return { success: true };
  });

  await adapter.sendInvoiceEmail(
    { externalId: '42' },
    {
      recipientEmail: 'josep@example.com',
      subject: 'Your AGC invoice RE-00001',
      message: 'Please find the document at [Network Link]',
    },
  );

  assertEquals(captured.method, 'POST');
  assertEquals(captured.path, '/2.0/kb_invoice/42/send');
  assertEquals(captured.body?.recipient_email, 'josep@example.com');
  assertEquals(captured.body?.attach_pdf, true);
  assertEquals(captured.body?.mark_as_open, true);
  assertEquals(String(captured.body?.message).includes('[Network Link]'), true);
});
