/**
 * Transactional email via the academy's existing providers (research R-16).
 * Same order as notify-payment-verification: SendGrid if set, else Resend.
 * Secrets: SENDGRID_API_KEY / RESEND_API_KEY. From: no-reply@agcpadelacademy.com
 */

const FROM_EMAIL = 'no-reply@agcpadelacademy.com';
const FROM_NAME = 'AGC Padel Academy';

export interface EmailAttachment {
  filename: string;
  bytes: Uint8Array;
  contentType?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function sendTransactionalEmail(
  input: SendEmailInput,
  env: { sendgridKey?: string | null; resendKey?: string | null } = {
    sendgridKey: (Deno.env.get('SENDGRID_API_KEY') ?? '').trim() || null,
    resendKey: (Deno.env.get('RESEND_API_KEY') ?? '').trim() || null,
  },
  fetchFn: typeof fetch = fetch,
): Promise<SendEmailResult> {
  if (env.sendgridKey) {
    return sendSendGrid(input, env.sendgridKey, fetchFn);
  }
  if (env.resendKey) {
    return sendResend(input, env.resendKey, fetchFn);
  }
  return { sent: false, skipped: true, error: 'No email API key configured (SENDGRID_API_KEY / RESEND_API_KEY missing)' };
}

async function sendSendGrid(
  input: SendEmailInput,
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<SendEmailResult> {
  const payload: Record<string, unknown> = {
    personalizations: [{ to: [{ email: input.to }] }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: input.subject,
    content: [{ type: 'text/html', value: input.html }],
  };
  if (input.attachments?.length) {
    payload.attachments = input.attachments.map((att) => ({
      content: bytesToBase64(att.bytes),
      filename: att.filename,
      type: att.contentType ?? 'application/pdf',
      disposition: 'attachment',
    }));
  }
  const res = await fetchFn('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => `status ${res.status}`);
    return { sent: false, error };
  }
  return { sent: true };
}

async function sendResend(
  input: SendEmailInput,
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<SendEmailResult> {
  const payload: Record<string, unknown> = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    ...(input.text ? { text: input.text } : {}),
  };
  if (input.attachments?.length) {
    payload.attachments = input.attachments.map((att) => ({
      filename: att.filename,
      content: bytesToBase64(att.bytes),
    }));
  }
  const res = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.text().catch(() => `status ${res.status}`);
    return { sent: false, error };
  }
  return { sent: true };
}

export const INVOICE_EMAIL_SUBJECT_PREFIX = 'Your AGC invoice / Ihre AGC-Rechnung';

/** Prefix used to match both the current bilingual subject and the older English-only subject. */
export const INVOICE_EMAIL_SUBJECT_IDEMPOTENCY_PREFIX = 'Your AGC invoice';

export function invoiceEmailSubject(documentNr: string | null | undefined): string {
  return documentNr
    ? `${INVOICE_EMAIL_SUBJECT_PREFIX} ${documentNr}`
    : INVOICE_EMAIL_SUBJECT_PREFIX;
}

export function invoiceEmailHtml(opts: {
  name?: string | null;
  documentNr: string | null;
  total: number;
  currency?: string;
}): string {
  const name = opts.name?.trim() || '';
  const helloEn = name ? `Hello ${name},` : 'Hello,';
  const helloDe = name ? `Hallo ${name},` : 'Hallo,';
  const nr = opts.documentNr ? ` (${opts.documentNr})` : '';
  const amount = `${opts.total.toFixed(2)} ${opts.currency ?? 'CHF'}`;
  return `<p>${helloEn}</p>
<p>Your invoice${nr} for <strong>${amount}</strong> is attached as a PDF.</p>
<p>Please pay by bank transfer using the Swiss QR code on the last page of the PDF. You can also open the invoice anytime under My Payments in the AGC Padel Academy app.</p>
<p>Thank you,<br/>AGC Padel Academy</p>
<hr />
<p>${helloDe}</p>
<p>Ihre Rechnung${nr} über <strong>${amount}</strong> ist als PDF angehängt.</p>
<p>Bitte überweisen Sie den Betrag mit dem Swiss-QR-Code auf der letzten Seite der PDF. Sie können die Rechnung auch jederzeit unter «My Payments» in der AGC Padel Academy App öffnen.</p>
<p>Vielen Dank,<br/>AGC Padel Academy</p>`;
}

/** Bexio send-by-email body. The literal "[Network Link]" placeholder is required by the API. */
export function invoiceBexioSendMessage(opts: {
  name?: string | null;
  documentNr: string | null;
}): string {
  const name = opts.name?.trim() || '';
  const helloEn = name ? `Hello ${name},` : 'Hello,';
  const helloDe = name ? `Hallo ${name},` : 'Hallo,';
  const nr = opts.documentNr ? ` (${opts.documentNr})` : '';
  return `${helloEn}

Your AGC Padel Academy invoice${nr} is ready. The PDF is attached; please pay using the Swiss QR code on the last page.

You can also open the invoice anytime under My Payments in the AGC Padel Academy app.

---

${helloDe}

Ihre AGC Padel Academy Rechnung${nr} ist bereit. Die PDF ist angehängt; bitte zahlen Sie mit dem Swiss-QR-Code auf der letzten Seite.

Sie können die Rechnung auch jederzeit unter «My Payments» in der AGC Padel Academy App öffnen.

[Network Link]

Thank you / Vielen Dank,
AGC Padel Academy`;
}
