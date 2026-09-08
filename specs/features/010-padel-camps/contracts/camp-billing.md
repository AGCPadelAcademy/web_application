# Contract: Camp billing mapper (internal)

**Feature**: `specs/features/010-padel-camps/spec.md` | **Date**: 2026-09-08

Internal Deno contract under `supabase/functions/_shared/billing/`. Reuses the F1.03 `AccountingProvider` interface unchanged (`contracts/accounting-provider.md` in `007-bexio-integration`). F1.25 adds a camp-specific mapper and repository reads; it does not change the provider interface.

## Camp invoice input

```typescript
export interface CampRegistrationRow {
  id: string;
  camp_id: string;
  child_id: string;
  parent_id: string;
  status: string;
  payment_status: string;
  camp_name: string;
  camp_start_date: string;   // ISO date
  camp_end_date: string;     // ISO date
  base_price: number;
  total_amount: number;
  currency: 'CHF';
}

export interface CampRegistrationExtraRow {
  name: string;
  price_amount: number;
}

export function campRegistrationToInvoiceInput(
  registration: CampRegistrationRow,
  extras: CampRegistrationExtraRow[],
  contact: ExternalContactRef,
  config: BexioConfig,
  now?: Date,
): InvoiceInput;
```

- `apiReference` = `agc:camp-registration:{registration.id}`.
- `title` = `{camp_name} — {start_date} → {end_date}`.
- `lines` = one `{ text: camp_name, amount: 1, unitPrice: base_price }` plus one line per selected extra `{ text: extra.name, amount: 1, unitPrice: extra.price_amount }`.
- `currency` = `'CHF'`; `isValidFrom` = today; `isValidTo` = today + `config.payment_term_days`.
- Tax uses `resolveSalesTaxId(config)` (0% go-live) — no camp-specific tax policy.

## Repository additions (service-role only)

```typescript
export interface CampBillingRepo {
  getCampRegistration(registrationId: string): Promise<CampRegistrationRow | null>;
  getCampRegistrationExtras(registrationId: string): Promise<CampRegistrationExtraRow[]>;
  findCampDocument(registrationId: string): Promise<BillingDocumentRow | null>;
  upsertCampDocument(row: BillingDocumentRow & { camp_registration_id: string }): Promise<BillingDocumentRow>;
  confirmCampRegistrationIfPending(registrationId: string, now: Date): Promise<boolean>;
}
```

## Confirmation email (idempotent)

```typescript
export interface CampConfirmationInput {
  to: string;
  parentName: string | null;
  childFirstName: string;
  childLastName: string;
  campName: string;
  startDate: string;
  endDate: string;
  scheduleText: string | null;
  total: number;
  currency: 'CHF';
  extras: CampRegistrationExtraRow[];
  practicalInfo: string | null;
}

export function campConfirmationSubject(campName: string): string;
export function campConfirmationHtml(input: CampConfirmationInput): string;
```

- Sent only after `confirmCampRegistrationIfPending` returns true.
- Idempotency: skip when `notifications_log` already has a `sent` row for this registration with the Camp confirmation subject.
- Failure is audited and never changes payment/registration state.

## Error & policy rules (binding)

1. Camp registration submission, cancellation, and conversion are server-orchestrated; the browser never writes `camp_registrations` directly.
2. Capacity and eligibility are enforced inside `register_camp_child` (single transaction, Camp row lock).
3. Invoice creation is idempotent per registration (local document anchor + `api_reference` search + deterministic operation key).
4. Logging is sanitized: no tokens, no full provider payloads, no child/parent PII beyond what the existing billing audit already records.
5. Paid or partially paid Camp invoices are never cancelled by this feature.
