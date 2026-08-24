/**
 * BexioAdapter — implements AccountingProvider against the Bexio API (T021).
 * Endpoint mapping: contracts/accounting-provider.md §Bexio endpoint mapping.
 * Uses BexioClient for auth/refresh/backoff; mappers for payload translation.
 */

import {
  ProviderClientError,
  type AccountingProvider,
  type ContactInput,
  type ExternalContactRef,
  type ExternalInvoice,
  type ExternalInvoiceRef,
  type ExternalInvoiceStatus,
  type InvoiceInput,
  type ProviderConfigStatus,
  type ProviderHealth,
  type ProviderPdf,
  type InvoiceEmailInput,
} from '../accounting-provider.ts';
import type { BexioClient } from './bexio-client.ts';
import {
  contactToBexioPayload,
  invoiceToBexioPayload,
  normalizeBexioCountries,
  resolveBexioCountryId,
  type BexioConfig,
  type BexioContactPayload,
  type BexioCountryRef,
} from './bexio-mappers.ts';

interface BexioInvoiceResponse {
  id: number;
  document_nr?: string | null;
  kb_item_status_id?: number | null;
  total?: string | null;
  total_received_payments?: string | null;
  total_remaining_payments?: string | null;
  qr_invoice_id?: number | null;
}

function num(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Numeric-totals authority (research R-07). `status_map` is only for cancelled/draft. */
export function deriveInvoiceStatus(input: {
  total: number;
  received: number;
  remaining: number;
  kbItemStatusId?: number | null;
  statusMap?: Record<string, number>;
}): ExternalInvoiceStatus {
  const statusMap = input.statusMap ?? {};
  if (statusMap.cancelled !== undefined && input.kbItemStatusId === statusMap.cancelled) {
    return 'cancelled';
  }
  if (input.received > 0 && input.remaining <= 0) return 'paid';
  if (input.received > 0) return 'partially_paid';
  if (statusMap.draft !== undefined && input.kbItemStatusId === statusMap.draft) {
    return 'draft';
  }
  if (input.kbItemStatusId !== null && input.kbItemStatusId !== undefined) return 'issued';
  return 'unknown';
}

export function isOverpaid(received: number, total: number): boolean {
  return received - total > 0.009;
}

function decodeBase64Pdf(encoded: string): Uint8Array {
  const cleaned = encoded.replace(/\s/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class BexioAdapter implements AccountingProvider {
  readonly name = 'bexio';
  private countriesCache: BexioCountryRef[] | null = null;

  constructor(
    private readonly client: BexioClient,
    private readonly config: BexioConfig,
  ) {}

  async healthCheck(): Promise<ProviderHealth> {
    try {
      await this.client.request('GET', '/3.0/users/me');
      return { ok: true, checkedAt: new Date().toISOString() };
    } catch (err) {
      return { ok: false, reason: (err as Error).name, checkedAt: new Date().toISOString() };
    }
  }

  getConfigStatus(): Promise<ProviderConfigStatus> {
    const required = [
      'bexio_user_id',
      'currency_id',
      'bank_account_id',
      'payment_type_id',
      'sales_account_id',
      'tax_id_sales',
      'unit_id',
    ] as const;
    const missing = required.filter(
      (k) => this.config[k] === null || this.config[k] === undefined,
    );
    return Promise.resolve({ complete: missing.length === 0, missing });
  }

  // --- Contacts (FR-009..FR-012) -------------------------------------------

  async findContactByEmail(email: string): Promise<ExternalContactRef | null> {
    const matches = await this.client.request<{ id: number }[]>(
      'POST',
      '/2.0/contact/search',
      { body: [{ field: 'mail', value: email, criteria: '=' }], correlationId: email },
    );
    // R-04: exactly one match → adopt; multiple → caller creates a new contact
    // and logs an observability warning for manual merge in Bexio.
    console.log(JSON.stringify({
      component: 'bexio-adapter',
      event: 'contact_search',
      matchCount: matches.length,
    }));
    if (matches.length === 1) return { externalId: String(matches[0].id) };
    return null;
  }

  async createContact(input: ContactInput): Promise<ExternalContactRef> {
    const created = await this.client.request<{ id: number }>('POST', '/2.0/contact', {
      body: await this.contactPayload(input),
      correlationId: input.email,
    });
    return { externalId: String(created.id) };
  }

  async updateContact(ref: ExternalContactRef, input: ContactInput): Promise<void> {
    await this.client.request('POST', `/2.0/contact/${ref.externalId}`, {
      body: await this.contactPayload(input),
      correlationId: input.email,
    });
  }

  // --- Invoices (FR-013..FR-020) -------------------------------------------

  async findInvoiceByApiReference(apiReference: string): Promise<ExternalInvoice | null> {
    const matches = await this.client.request<BexioInvoiceResponse[]>(
      'POST',
      '/2.0/kb_invoice/search',
      {
        body: [{ field: 'api_reference', value: apiReference, criteria: '=' }],
        correlationId: apiReference,
      },
    );
    if (matches.length === 0) return null;
    return this.mapInvoice(matches[0]);
  }

  async createInvoice(input: InvoiceInput): Promise<ExternalInvoice> {
    const created = await this.client.request<BexioInvoiceResponse>('POST', '/2.0/kb_invoice', {
      body: invoiceToBexioPayload(input, this.config),
      correlationId: input.apiReference,
    });
    return this.mapInvoice(created);
  }

  async issueInvoice(ref: ExternalInvoiceRef): Promise<ExternalInvoice> {
    await this.client.request('POST', `/2.0/kb_invoice/${ref.externalId}/issue`, {
      correlationId: ref.externalId,
    });
    // The issue endpoint returns only a success flag — fetch the full invoice.
    return this.getInvoice(ref);
  }

  async getInvoice(ref: ExternalInvoiceRef): Promise<ExternalInvoice> {
    const raw = await this.client.request<BexioInvoiceResponse>(
      'GET',
      `/2.0/kb_invoice/${ref.externalId}`,
      { correlationId: ref.externalId },
    );
    return this.mapInvoice(raw);
  }

  async getInvoicePdf(ref: ExternalInvoiceRef): Promise<ProviderPdf> {
    // Official Bexio PDF body is `{ name, size, mime, content }` (base64).
    // `data` is accepted as a defensive alias; missing both is a client-mapping error.
    const payload = await this.client.request<{
      content?: string;
      data?: string;
      name?: string;
    }>(
      'GET',
      `/2.0/kb_invoice/${ref.externalId}/pdf`,
      { correlationId: ref.externalId },
    );
    const encoded = payload?.content ?? payload?.data;
    if (!encoded) {
      console.log(JSON.stringify({
        component: 'bexio-adapter',
        event: 'pdf_payload_missing',
        keys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
        correlationId: ref.externalId,
      }));
      throw new ProviderClientError('bexio invoice PDF payload missing content', 422);
    }
    const bytes = decodeBase64Pdf(encoded);
    return {
      bytes,
      fileName: payload.name || `invoice-${ref.externalId}.pdf`,
    };
  }

  async sendInvoiceEmail(ref: ExternalInvoiceRef, input: InvoiceEmailInput): Promise<void> {
    // Bexio requires the literal placeholder "[Network Link]" in `message`.
    await this.client.request('POST', `/2.0/kb_invoice/${ref.externalId}/send`, {
      body: {
        recipient_email: input.recipientEmail,
        subject: input.subject,
        message: input.message,
        mark_as_open: true,
        attach_pdf: true,
      },
      correlationId: ref.externalId,
    });
  }

  // T040 (US5) — implemented with the cancellation story.
  cancelInvoice(_ref: ExternalInvoiceRef): Promise<void> {
    throw new Error('cancelInvoice is implemented in T040 (US5)');
  }

  private async contactPayload(input: ContactInput): Promise<BexioContactPayload> {
    const payload = contactToBexioPayload(input, this.config);
    if (payload.country_id || !input.countryCode) return payload;
    const countries = await this.ensureCountries();
    const countryId = resolveBexioCountryId(input.countryCode, countries);
    return countryId ? { ...payload, country_id: countryId } : payload;
  }

  private async ensureCountries(): Promise<BexioCountryRef[]> {
    if (this.config.countries?.length) return this.config.countries;
    if (this.countriesCache) return this.countriesCache;
    const rows = await this.client.request<{
      id: number;
      name: string;
      name_short?: string;
      iso3166_alpha2?: string;
    }[]>('GET', '/2.0/country');
    this.countriesCache = normalizeBexioCountries(rows);
    return this.countriesCache;
  }

  /** Numeric-totals authority (R-07); status_map only for draft/cancelled. */
  private mapInvoice(raw: BexioInvoiceResponse): ExternalInvoice {
    const total = num(raw.total);
    const received = num(raw.total_received_payments);
    const remaining = num(raw.total_remaining_payments);
    return {
      externalId: String(raw.id),
      documentNr: raw.document_nr ?? null,
      status: deriveInvoiceStatus({
        total,
        received,
        remaining,
        kbItemStatusId: raw.kb_item_status_id,
        statusMap: this.config.status_map,
      }),
      total,
      received,
      remaining,
      hasQrPaymentPart: raw.qr_invoice_id != null,
    };
  }
}
