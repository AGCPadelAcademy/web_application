/**
 * AccountingProvider — provider-neutral contract between AGC financial
 * workflows and an external accounting system (contracts/accounting-provider.md).
 *
 * No Bexio-specific enum values or payload shapes cross this boundary; the
 * adapter normalizes everything into the types below.
 */

export interface ExternalContactRef {
  externalId: string;
}

export interface ContactInput {
  firstName: string;
  lastName: string;
  email: string;
  address?: string;
  postcode?: string;
  city?: string;
  countryId?: number;
}

export interface InvoiceLineInput {
  text: string;
  amount: number;
  unitPrice: number;
}

export interface InvoiceInput {
  apiReference: string; // 'agc:booking:{uuid}' — FR-016
  contact: ExternalContactRef;
  title: string;
  lines: InvoiceLineInput[];
  currency: 'CHF';
  isValidFrom: string; // ISO date
  isValidTo: string; // ISO date (payment term from config)
}

export interface ExternalInvoiceRef {
  externalId: string;
}

export type ExternalInvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'cancelled'
  | 'unknown';

export interface ExternalInvoice {
  externalId: string;
  documentNr: string | null;
  status: ExternalInvoiceStatus;
  total: number;
  received: number;
  remaining: number;
  hasQrPaymentPart: boolean;
}

export interface ProviderHealth {
  ok: boolean;
  reason?: string;
  checkedAt: string;
}

export interface ProviderConfigStatus {
  complete: boolean;
  missing: string[];
}

export interface ProviderPdf {
  bytes: Uint8Array;
  fileName: string;
}

/** Authentication failed irrecoverably — integration must be re-authorized (FR-005). */
export class ProviderAuthError extends Error {
  override readonly name = 'ProviderAuthError';
}

/** Transient provider failure (429/5xx/network) after bounded retries — safe to requeue (FR-008). */
export class ProviderUnavailableError extends Error {
  override readonly name = 'ProviderUnavailableError';
}

/** Non-retryable client error (4xx other than 401/429) — indicates a bug or bad config. */
export class ProviderClientError extends Error {
  override readonly name = 'ProviderClientError';
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Required provider configuration (discovered IDs) is missing. */
export class ProviderConfigError extends Error {
  override readonly name = 'ProviderConfigError';
  constructor(
    message: string,
    readonly missing: string[],
  ) {
    super(message);
  }
}

export interface AccountingProvider {
  readonly name: string;

  healthCheck(): Promise<ProviderHealth>;
  getConfigStatus(): Promise<ProviderConfigStatus>;

  findContactByEmail(email: string): Promise<ExternalContactRef | null>;
  createContact(input: ContactInput): Promise<ExternalContactRef>;
  updateContact(ref: ExternalContactRef, input: ContactInput): Promise<void>;

  findInvoiceByApiReference(apiReference: string): Promise<ExternalInvoice | null>;
  createInvoice(input: InvoiceInput): Promise<ExternalInvoice>;
  issueInvoice(ref: ExternalInvoiceRef): Promise<ExternalInvoice>;
  getInvoice(ref: ExternalInvoiceRef): Promise<ExternalInvoice>;
  getInvoicePdf(ref: ExternalInvoiceRef): Promise<ProviderPdf>;
  cancelInvoice(ref: ExternalInvoiceRef): Promise<void>;
}
