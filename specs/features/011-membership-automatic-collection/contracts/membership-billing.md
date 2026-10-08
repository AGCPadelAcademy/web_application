# Contract: Membership-period billing

**Feature**: `specs/features/011-membership-automatic-collection/spec.md` | **Date**: 2026-10-08

Internal Deno contract. Reuses the F1.03 `AccountingProvider` unchanged. Adds a mapper and repository reads. Does not call the collection channel.

## Invoice input

```typescript
export interface MembershipPeriodIntentRow {
  id: string;
  subject_id: string;
  client_id: string;
  membership_ref: string;
  period_key: string;
  display_label: string;
  amount: number;
  currency: 'CHF';
  status: string;
}

export function membershipPeriodToInvoiceInput(
  intent: MembershipPeriodIntentRow,
  contact: ExternalContactRef,
  config: BexioConfig,
  now?: Date,
): InvoiceInput;
```

- `apiReference` = `agc:membership-period:{intent.id}`.
- `title` = `{display_label} — {period_key}`.
- One line: `{ text: display_label, amount: 1, unitPrice: intent.amount }`.
- `currency` = `'CHF'`. Tax uses the existing `resolveSalesTaxId(config)`.
- The payer contact is the client profile already mapped by F1.03. No second Bexio contact.

## Issue

`issueInvoiceForMembershipPeriod(intentId)` follows `issueInvoiceForCampRegistration`:

1. Return the existing document when `membership_period_intent_id` already has one.
2. Recover a lost response by `api_reference` before creating another Bexio invoice.
3. Record a `billing_operations` row of kind `invoice_issue` with `membership_period_intent_id`.
4. On success, set the intent status to `invoiced` only from `pending`. Do not set `paid`.

## Reconciliation

When `bexio-reconcile` sees a Membership-period document:

- `paid` and not already signaled: set intent `paid`, `paid_at`, insert `payment_confirmed` with source `accounting_reconciliation` if that kind does not exist.
- `partially_paid`: leave the intent unpaid.
- A payment that arrives when the intent is already `paid`: set `duplicate_receipt = true`. Do not insert a second signal.
- A later reversal to unpaid: set intent `reversed`, insert `payment_reversed`, and leave `consumed_at` null.

## Collection submit order

Invoice first, collection second. The run always issues the invoice for a chargeable intent. It submits a collection only when the mandate is active, the method is automatic, the client is active, and the channel is configured. Otherwise the intent stays `invoiced` and My Payments offers QR pay.
