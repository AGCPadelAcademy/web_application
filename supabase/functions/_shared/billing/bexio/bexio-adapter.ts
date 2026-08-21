/**
 * BexioAdapter — implements AccountingProvider against the Bexio API (T021).
 * Endpoint mapping: contracts/accounting-provider.md §Bexio endpoint mapping.
 * Uses BexioClient for auth/refresh/backoff; mappers for payload translation.
 */

import type {
  AccountingProvider,
  ContactInput,
  ExternalContactRef,
  ExternalInvoice,
  ExternalInvoiceRef,
  ExternalInvoiceStatus,
  InvoiceInput,
  ProviderConfigStatus,
  ProviderHealth,
  ProviderPdf,
} from '../accounting-provider.ts';
import type { BexioClient } from './bexio-client.ts';
import {
  contactToBexioPayload,
  invoiceToBexioPayload,
  type BexioConfig,
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

export class BexioAdapter implements AccountingProvider {
  readonly name = 'bexio';

  constructor(
    private readonly client: BexioClient,
    private readonly config: BexioConfig & { status_map?: Record<string, number> },
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
    if (matches.length === 1) return { externalId: String(matches[0].id) };
    return null;
  }

  async createContact(input: ContactInput): Promise<ExternalContactRef> {
    const created = await this.client.request<{ id: number }>('POST', '/2.0/contact', {
      body: contactToBexioPayload(input, this.config),
      correlationId: input.email,
    });
    return { externalId: String(created.id) };
  }

  async updateContact(ref: ExternalContactRef, input: ContactInput): Promise<void> {
    await this.client.request('POST', `/2.0/contact/${ref.externalId}`, {
      body: contactToBexioPayload(input, this.config),
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

  // T026 (US3) — implemented with the document-access story.
  getInvoicePdf(_ref: ExternalInvoiceRef): Promise<ProviderPdf> {
    throw new Error('getInvoicePdf is implemented in T026 (US3)');
  }

  // T040 (US5) — implemented with the cancellation story.
  cancelInvoice(_ref: ExternalInvoiceRef): Promise<void> {
    throw new Error('cancelInvoice is implemented in T040 (US5)');
  }

  /** Numeric-totals authority (R-07); status_map only for draft/cancelled. */
  private mapInvoice(raw: BexioInvoiceResponse): ExternalInvoice {
    const total = num(raw.total);
    const received = num(raw.total_received_payments);
    const remaining = num(raw.total_remaining_payments);
    const statusMap = this.config.status_map ?? {};

    let status: ExternalInvoiceStatus = 'unknown';
    if (received > 0 && remaining <= 0) status = 'paid';
    else if (received > 0) status = 'partially_paid';
    else if (statusMap.cancelled !== undefined && raw.kb_item_status_id === statusMap.cancelled) {
      status = 'cancelled';
    } else if (statusMap.draft !== undefined && raw.kb_item_status_id === statusMap.draft) {
      status = 'draft';
    } else if (raw.kb_item_status_id !== null && raw.kb_item_status_id !== undefined) {
      status = 'issued';
    }

    return {
      externalId: String(raw.id),
      documentNr: raw.document_nr ?? null,
      status,
      total,
      received,
      remaining,
      hasQrPaymentPart: raw.qr_invoice_id != null,
    };
  }
}
