# Contract: Membership-period billing

**Feature**: `specs/features/011-membership-automatic-collection/spec.md` | **Date**: 2026-10-31

Internal Deno contract. Reuses the F1.03 `AccountingProvider` unchanged. Adds a mapper and repository reads. Does not call the collection channel.

## Invoice input

```typescript
export interface MembershipPeriodIntentRow {
  id: string;
  subject_id: string;
  client_id: string;
  membership_ref: string;
  period_key: string;
  claim_kind: 'month' | 'cancel_fee';
  charge_intent_id: string | null;
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
- `unitPrice` is the copied intent amount. A `cancel_fee` line uses that amount and does not multiply by 0.10 again.
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

- `paid` and not already signaled: set intent `paid`, `paid_at`, set `membership_charge_intents.paid_at` when `charge_intent_id` is set, insert `payment_confirmed` with source `accounting_reconciliation` if that kind does not exist. Paying a `month` claim does not change the `cancel_fee` claim.
- `partially_paid`: leave the intent unpaid.
- A payment that arrives when the intent is already `paid`: set `duplicate_receipt = true`. Do not insert a second signal.
- A later reversal to unpaid: set intent `reversed`, insert `payment_reversed`, and leave `consumed_at` null.

## Collection submit order

Copy first, invoice second, collection third. The run copies unlinked F1.09 charge intents, then issues one invoice per intent, including a cancel fee. It submits a collection only when the mandate is active, the method is automatic, the client is active, and the channel is configured. Otherwise the intent stays `invoiced` and My Payments offers QR pay. The fee uses that same fallback.
