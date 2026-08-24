# Contract: AccountingProvider (internal abstraction)

**Feature**: `specs/features/007-bexio-integration/spec.md` | **Date**: 2026-08-20

Internal TypeScript (Deno) contract decoupling AGC financial workflows from Bexio (FR-014). Implemented under `supabase/functions/_shared/billing/`:

```
supabase/functions/_shared/billing/
├── financial-service.ts     # AGC-facing orchestration (knows bookings, users, money)
├── accounting-provider.ts   # the interface below
├── bexio/
│   ├── bexio-adapter.ts     # implements AccountingProvider
│   ├── bexio-client.ts      # fetch wrapper: auth, 401-refresh, 429/5xx backoff, sanitized logs
│   └── bexio-mappers.ts     # AGC ⇄ Bexio payload translation
└── vault.ts                 # token read/write helpers
```

## Interface

```typescript
export interface AccountingProvider {
  readonly name: string; // 'bexio'

  // Connection
  healthCheck(): Promise<ProviderHealth>;                    // { ok, reason?, checkedAt }
  getConfigStatus(): Promise<{ complete: boolean; missing: string[] }>;

  // Contacts (FR-009..FR-012)
  findContactByEmail(email: string): Promise<ExternalContactRef | null>;
  createContact(input: ContactInput): Promise<ExternalContactRef>;   // person type
  updateContact(ref: ExternalContactRef, input: ContactInput): Promise<void>;

  // Invoices (FR-013..FR-020)
  findInvoiceByApiReference(apiReference: string): Promise<ExternalInvoice | null>;
  createInvoice(input: InvoiceInput): Promise<ExternalInvoice>;      // draft
  issueInvoice(ref: ExternalInvoiceRef): Promise<ExternalInvoice>;   // draft → issued
  getInvoice(ref: ExternalInvoiceRef): Promise<ExternalInvoice>;     // status + totals
  getInvoicePdf(ref: ExternalInvoiceRef): Promise<ProviderPdf>;      // { bytes, fileName }
  sendInvoiceEmail(ref: ExternalInvoiceRef, input: InvoiceEmailInput): Promise<void>;
  cancelInvoice(ref: ExternalInvoiceRef): Promise<void>;             // issued → cancelled
}

export interface InvoiceInput {
  apiReference: string;            // 'agc:booking:{uuid}' — FR-016
  contact: ExternalContactRef;
  title: string;                   // e.g. '{lesson name} — {date}'
  lines: Array<{ text: string; amount: number; unitPrice: number; }>; // gross CHF from lessons.price_amount
  currency: 'CHF';
  isValidFrom: string;             // ISO date
  isValidTo: string;               // payment term from config
}

export interface ExternalInvoice {
  externalId: string;
  documentNr: string | null;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'cancelled' | 'unknown';
  total: number;                   // minor-unit-free decimal, CHF
  received: number;
  remaining: number;
  hasQrPaymentPart: boolean;       // qr_invoice_id present — health signal (FR-018)
}
```

**Status derivation** (research R-07): adapters compute `status` from `total_received_payments` / `total_remaining_payments` first; `kb_item_status_id` (via configured `status_map`) only distinguishes `cancelled` and `draft`. No Bexio enum value crosses this boundary — AGC sees only the normalized union above.

## Bexio endpoint mapping (BexioAdapter)

| Operation | Bexio call | Verified |
|---|---|---|
| token exchange/refresh | `POST https://auth.bexio.com/realms/bexio/protocol/openid-connect/token` | docs + live OIDC discovery (2026-08-21) |
| current user (setup) | `GET /3.0/users/me` | docs |
| find contact | `POST /2.0/contact/search` field `mail` | docs |
| create/update contact | `POST /2.0/contact`, `POST /2.0/contact/{id}` (`contact_type_id: 2`, `name_1` last, `name_2` first) | docs |
| find invoice by reference | `POST /2.0/kb_invoice/search` field `api_reference` | docs (supported field) |
| create invoice | `POST /2.0/kb_invoice` (positions `type: "KbPositionCustom"`, config IDs) | docs |
| issue invoice | `POST /2.0/kb_invoice/{id}/issue` (requires draft) | docs |
| get invoice | `GET /2.0/kb_invoice/{id}` (totals, `kb_item_status_id`, `qr_invoice_id`) | docs |
| invoice PDF | `GET /2.0/kb_invoice/{id}/pdf` (JSON `{ name, size, mime, content }` — `content` is base64) | docs |
| send invoice email | `POST /2.0/kb_invoice/{id}/send` (`recipient_email`, `subject`, `message` with `[Network Link]`, `attach_pdf: true`) | docs |
| cancel invoice | `POST /2.0/kb_invoice/{id}/cancel` (issued only) | docs |
| discovery (setup) | `/2.0/payment_type`, `/2.0/country`, `/2.0/language`, `/3.0/banking/accounts`, `/3.0/taxes?types=sales_tax&scope=active`, `/3.0/currencies`, document templates | docs |

## Error & policy rules (binding for all provider implementations)

1. **Auth**: on `401`, refresh once via `bexio-client` and retry the call once; second failure ⇒ `ProviderAuthError` ⇒ integration `requires_reauth` (FR-005). `invalid_grant` on refresh ⇒ same, no retry (FR-007).
2. **Rate limiting**: on `429`, honor `RateLimit-*`/`Retry-After` with exponential backoff + jitter; exhausted budget ⇒ `ProviderUnavailableError` ⇒ caller enqueues into `billing_operations` (FR-008, FR-030).
3. **Idempotency**: `createInvoice` MUST be preceded by `findInvoiceByApiReference` in the same orchestration step (research R-05); adapters never auto-create duplicates.
4. **Logging**: adapters log method, status code, correlation id (`api_reference` / idempotency key), and sanitized error class only — never tokens, headers, or full bodies (FR-032/FR-034).
5. **Cancellation**: `cancelInvoice` is exposed for admin-triggered use only (V1 hybrid per spec §Cancellation/Refunds); callers must confirm the invoice is `issued` and unpaid first.
