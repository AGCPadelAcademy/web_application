# Quickstart: Membership Automatic Collection (F1.26)

**Feature**: `specs/features/011-membership-automatic-collection/spec.md`
**Date**: 2026-10-08

Validation guide for after implementation. Commands assume the repo root. Live bank debit is not part of this guide: the shipped channel is unconfigured, so opt-in is refused and QR remains. Mandate and collection branches are proven with the Deno test double of `CollectionChannel`.

## Prerequisites

- Node `>=20.19`, npm dependencies installed.
- Deno available for `supabase/functions` tests.
- A Supabase target only when a migration is applied. Constitution: one production project is also the live target until a test project exists. Do not apply the migration unless that has been explicitly requested. Seed rows for a manual pass must be identifiable (label prefix `F126-TEST`) and removed afterward.
- No new environment variables for the unconfigured channel.

## Automated gate

```bash
npm run lint
npm test
npm run build
```

Deno tests for the new billing modules:

```bash
deno test supabase/functions/_shared/billing/collection-channel.test.ts supabase/functions/_shared/billing/membership-mapper.test.ts supabase/functions/_shared/billing/financial-service.membership.test.ts
```

SQL assertions, when a database with the migration is available:

```bash
# tests/sql/0020_f126_membership_automatic_collection.test.sql
```

Confirm the filename matches the migration number actually used.

## Scenario 1 — Opt-in refused while the channel is unconfigured

1. Sign in as an active client who has a `collection_subjects` row (seed or fixture).
2. Open My Payments.
3. Choose automatic collection.

Expected: the choice is refused, the stored method stays QR / invoice, no `direct_debit_mandates` row is created, and the screen does not tell the client to enable Automatic transaction, standing approval, or a standing order.

## Scenario 2 — Decline keeps QR

1. Set the method to QR / invoice.
2. Open the Membership period invoice action.

Expected: QR pay is offered. No collection request exists.

## Scenario 3 — Isolation

1. As client A, request client B’s subject id on `membership-set-collection-method`.
2. As client A, select client B’s mandate through the client API.

Expected: the function returns 403. The select returns no row.

## Scenario 4 — Configured-channel double (Deno, not production)

Using the test double that reports configured:

1. Opt in twice. Expect one `proposal_sent` attempt.
2. Move that attempt to `rejected`, call `membership-request-mandate` once, then call it again. Expect exactly two attempts, the second still `proposal_sent`.
3. Mark the mandate `active`, run the collection job twice for one intent. Expect one invoice document and one `collection_requests` row.
4. Confirm the collection. Expect the intent `paid` and one `payment_confirmed` signal. Expect no Membership lifecycle write.
5. Stop auto-pay after a second intent already has `submitted`. Expect that request to remain, and a third intent to get an invoice without a new collection.
6. Set `profiles.is_active` false before a new opt-in and before a new period. Expect 409 and no new collection. An already `submitted` request may still confirm.

## Scenario 5 — QR hidden and duplicate receipt

1. With the test double, leave a collection `submitted`.
2. Open My Payments for that period.

Expected: the pay action is hidden. `qr_pay_hidden` is true on the document function.

3. Mark both the collection confirmed and the billing document paid.

Expected: the intent is paid once, `duplicate_receipt` is true, and one `payment_confirmed` row exists. Admin Collections shows the duplicate. There is no refund action.

## Scenario 6 — Lesson and camp unchanged

1. Open an unpaid lesson and an unpaid camp registration on My Payments.

Expected: both still offer the QR invoice. Neither creates a `collection_requests` row when the Membership job runs.

## Scenario 7 — Admin

1. As Admin, set automatic collection for a client. With the unconfigured channel, expect the same refusal as Scenario 1.
2. As Admin, open Collections.

Expected: mandate status, failed collections, reversals, and duplicate receipts for every client are visible. A non-admin does not see other clients.

## Out of this guide

- A real eBill mandate approval at a bank.
- F1.09 creating a Group fixed place or moving a Membership to Active when it reads `membership_payment_signals`.
- Kids semester and camp registration collection.
