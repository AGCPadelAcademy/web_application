/**
 * Unit tests for the transactional mailer (R-16).
 * Run with: deno test --allow-env --allow-net=none
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  bytesToBase64,
  invoiceBexioSendMessage,
  invoiceEmailHtml,
  invoiceEmailSubject,
  sendTransactionalEmail,
} from './mailer.ts';

Deno.test('bytesToBase64 round-trips ASCII', () => {
  assertEquals(bytesToBase64(new TextEncoder().encode('hello')), btoa('hello'));
});

Deno.test('invoiceEmailSubject includes the Bexio document number in English and German', () => {
  assertEquals(invoiceEmailSubject('RE-00001'), 'Your AGC invoice / Ihre AGC-Rechnung RE-00001');
  assertEquals(invoiceEmailSubject(null), 'Your AGC invoice / Ihre AGC-Rechnung');
});

Deno.test('invoiceEmailHtml includes English and German copy', () => {
  const html = invoiceEmailHtml({
    name: 'Josep',
    documentNr: 'RE-00001',
    total: 60,
    currency: 'CHF',
  });
  assertEquals(html.includes('Hello Josep,'), true);
  assertEquals(html.includes('Hallo Josep,'), true);
  assertEquals(html.includes('Your invoice (RE-00001)'), true);
  assertEquals(html.includes('Ihre Rechnung (RE-00001)'), true);
  assertEquals(html.includes('60.00 CHF'), true);
});

Deno.test('invoiceBexioSendMessage includes the required [Network Link] placeholder', () => {
  const message = invoiceBexioSendMessage({ name: 'Josep', documentNr: 'RE-00001' });
  assertEquals(message.includes('[Network Link]'), true);
  assertEquals(message.includes('RE-00001'), true);
  assertEquals(message.includes('Hallo Josep,'), true);
});

Deno.test('sendTransactionalEmail skips when no provider key is set', async () => {
  const result = await sendTransactionalEmail(
    { to: 'a@b.com', subject: 'x', html: '<p>x</p>' },
    { sendgridKey: null, resendKey: null },
  );
  assertEquals(result.sent, false);
  assertEquals(result.skipped, true);
});

Deno.test('sendTransactionalEmail posts to Resend with a PDF attachment', async () => {
  const captured: { url: string; body: Record<string, unknown> } = { url: '', body: {} };
  const fetchFn = ((url: string | URL, init?: RequestInit) => {
    captured.url = String(url);
    captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Promise.resolve(new Response('{}', { status: 200 }));
  }) as typeof fetch;

  const pdf = new Uint8Array([1, 2, 3]);
  const result = await sendTransactionalEmail(
    {
      to: 'josep@example.com',
      subject: 'Your AGC invoice RE-00001',
      html: '<p>hi</p>',
      attachments: [{ filename: 'RE-00001.pdf', bytes: pdf }],
    },
    { sendgridKey: null, resendKey: 're_test' },
    fetchFn,
  );

  assertEquals(result.sent, true);
  assertEquals(captured.url, 'https://api.resend.com/emails');
  assertEquals(captured.body.from, 'AGC Padel Academy <no-reply@agcpadelacademy.com>');
  assertEquals(captured.body.to, ['josep@example.com']);
  const attachments = captured.body.attachments as { filename: string; content: string }[];
  assertEquals(attachments[0].filename, 'RE-00001.pdf');
  assertEquals(attachments[0].content, bytesToBase64(pdf));
});
