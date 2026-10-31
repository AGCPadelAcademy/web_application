# Implementation Plan: Membership Automatic Collection (eBill Direct Debit) (F1.26)

**Branch**: `cursor/f126-billing-plan-tasks-8626` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/features/011-membership-automatic-collection/spec.md`

## Summary

Add an issuer-initiated Direct Debit collection channel for adult Membership periods. The client or an Admin chooses automatic collection in My Payments. AGC stores that choice, requests one mandate proposal through a provider-neutral channel port, and copies each F1.09 `membership_charge_intents` row into `membership_period_intents`. A membership month and a cancel fee are separate claims. Each gets one F1.03 invoice. The fee amount is copied from F1.09 and is not recalculated. When the mandate is active, one collection is submitted for that claim. Confirmed payment writes `paid_at` back on the charge intent and a signal F1.09 can read later. It does not activate, pause, or cancel the Membership. QR / bank transfer stays the fallback, including for the fee. The shipped channel adapter is unconfigured, so live bank debit waits until AKB confirms a contract. This feature does not choose the 1st, the 20th cutoff, the 10% rate, or the place end.

## Technical Context

**Language/Version**: JavaScript/JSX on React 18 + Vite 7; SQL/PL/pgSQL for migrations; Deno TypeScript in Supabase Edge Functions. Node `>=20.19`. No TypeScript migration.

**Primary Dependencies**: Existing stack only — Supabase JS 2.30, Supabase Auth/Postgres/RLS/Edge Functions, React Router 6, existing Radix/shadcn-style components, existing F1.03 `billing_*` spine and `FinancialService → AccountingProvider → BexioAdapter`. New server-side `CollectionChannel` port with an unconfigured adapter. Zero new npm packages. No SIX SDK.

**Storage**: Supabase PostgreSQL. New tables `collection_subjects`, `collection_methods`, `direct_debit_mandates`, `membership_period_intents`, `collection_requests`, `membership_payment_signals`. `membership_period_intents.charge_intent_id` references F1.09 `membership_charge_intents` when migration `0024` is already applied. Additive `membership_period_intent_id` on `billing_documents` / `billing_operations` / `billing_events`. Money is `numeric(10,2)` CHF. Optional IBAN column only.

**Testing**: Vitest 4 for the My Payments client and forbidden-copy guard; Deno tests for the channel port, mandate idempotency, collection idempotency, stale status, stop, and deactivation; SQL/RLS tests in `tests/sql/` for the new tables and partial unique indexes. Manual scenarios in [quickstart.md](quickstart.md).

**Target Platform**: Vercel-hosted SPA and Supabase Cloud; modern browsers.

**Project Type**: Existing web application (single SPA + managed Supabase backend).

**Performance Goals**: Opt-in request returns without a bank round-trip while the channel is unconfigured. A configured channel later confirms a paid period into `membership_payment_signals` within one hour via the hourly run. One invoice and one collection per period under retries.

**Constraints**: No Stripe, no SIX, no bank login storage, no second Membership state machine, no rewrite of lesson or camp QR billing. Secrets in Vault. English UI. Deactivated clients cannot start a new opt-in or a new collection. An already-submitted collection is allowed to finish.

**Scale/Scope**: Academy scale — tens of adult memberships, one period at a time per membership. One migration, two JWT Edge Functions, one hourly scheduler, extensions to `bexio-reconcile` and `billing-invoice-document`, a My Payments section, and one Admin tab.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle / constraint | Evaluation | Result |
|---|---|---|
| I. Understand before modifying | Reviewed the F1.26 spec and clarifications, constitution, F1.03 billing code and cron, F1.25 camp billing extension, F1.04 `is_active`, unused `memberships` documentation, My Payments | PASS |
| II. Spec-driven | Clarified spec precedes this plan. Tasks and implementation remain later gates. Work stays on the existing `cursor/feature-specification-automation-933f` branch | PASS |
| III. Incremental / backward compatible | New operational tables and additive billing columns. Lesson bookings, camp registrations, and the unused membership tables stay untouched | PASS |
| IV. Security-first | RLS select-only for clients; mutations in JWT Edge Functions; scheduler uses the existing Vault secret; no bank credentials; IBAN optional and not logged | PASS |
| V. Migration discipline | One forward migration `0025` after F1.09 `0024` and after remote numbering confirmation. Local head is `0023` until those files land. Money is `numeric`. Status values are CHECK constraints. No unrelated schema debt | PASS |
| VI. Documentation | Research, data model, contracts, and quickstart in this feature folder. Mermaid for the entity and state diagrams | PASS |
| VII. Simplicity / YAGNI | Reuse F1.03 invoicing and reconciliation. One unconfigured channel adapter instead of an unconfirmed AKB client. No cancel-collection API | PASS |
| Fixed stack | React, Supabase, Deno Edge Functions. No custom API server and no new payment vendor in this slice | PASS |
| Payments | Manual bank transfer remains the fallback. Direct Debit is an additional rail into the same paid meaning. No Stripe | PASS |
| Swiss PII | Client isolation. IBAN only if a future channel requires it. No full account numbers in logs | PASS |

**Pre-design gate: PASS.** The 2026-10-31 spec session closed the calendar. This plan consumes F1.09 charge intents and does not reopen the 1st, the 20th, or the 10%. The concrete bank adapter stays deferred until AKB confirms a contract (research R-04).

### Post-design re-check

Research R-01–R-10 and the Phase 1 artifacts keep every gate. `collection_subjects` is a correlation row, not an F1.09 Membership. The unconfigured adapter cannot move money. No constitution waiver is required.

## Project Structure

### Documentation (this feature)

```text
specs/features/011-membership-automatic-collection/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── collection-channel.md
│   ├── membership-billing.md
│   └── edge-functions.md
├── checklists/
│   └── requirements.md
└── tasks.md                         # updated in this planning pass
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 0025_f126_membership_automatic_collection.sql   # after F1.09 0024; confirm remote head first
└── functions/
    ├── _shared/
    │   └── billing/
    │       ├── collection-channel.ts                  # NEW port + unconfigured adapter
    │       ├── membership-mapper.ts                   # NEW intent → InvoiceInput
    │       ├── financial-service.ts                   # EXTENDED: issue invoice for a period intent
    │       └── reconciliation-service.ts              # EXTENDED: membership paid / reversal / duplicate receipt
    ├── membership-set-collection-method/index.ts      # NEW
    ├── membership-request-mandate/index.ts            # NEW
    ├── membership-collection-run/index.ts             # NEW hourly scheduler
    ├── billing-invoice-document/index.ts              # EXTENDED: membership_period_intent_id, qr_pay_hidden
    └── bexio-reconcile/index.ts                       # EXTENDED: membership-period documents

src/
├── lib/
│   ├── membershipCollection.js                        # NEW: read status, set method, request attempt
│   ├── membershipCollection.test.js                   # NEW
│   └── billing.js                                     # EXTENDED: document helper for a period intent
├── pages/
│   ├── PaymentsPage.jsx                               # EXTENDED: membership method, status, hide QR pay
│   └── AdminDashboardPage.jsx                         # EXTENDED: Collections tab
└── components/
    └── admin/
        └── MembershipCollectionsPanel.jsx             # NEW: status, reversals, duplicate receipts

tests/sql/
└── 0025_f126_membership_automatic_collection.test.sql
```

**Structure Decision**: Stay inside the existing SPA, `src/lib` service modules, migrations, and Edge Functions. Clients manage the collection method on My Payments. Admins get one tab on the existing dashboard. The bank port lives next to the F1.03 billing modules and is not callable from the browser.

## Phase 0: Research result

[research.md](research.md) resolves:

- Correlation tables instead of the unused `memberships` / `credits` tables
- A chargeable-period inbox filled from F1.09 charge intents, without a second calendar
- Additive F1.03 billing columns and `agc:membership-period:{id}` references
- An unconfigured `CollectionChannel` until AKB confirms a contract
- One in-flight mandate attempt, with an explicit new attempt after rejection or revocation
- One collection per period; stop and deactivation do not cancel an in-flight debit
- In-app QR pay hidden while a collection is submitted, without rewriting the invoice PDF
- Payment-confirmed and payment-reversed signals for F1.09
- An hourly collection run beside the existing six-hour reconciliation job
- RLS, Vault, and the current Vitest / Deno / SQL test split

No `NEEDS CLARIFICATION` remains.

## Phase 1: Design result

- [data-model.md](data-model.md) defines the tables, mandate and period states, RLS, the billing-subject check, and the migration.
- [contracts/collection-channel.md](contracts/collection-channel.md) defines the port and the unconfigured adapter.
- [contracts/membership-billing.md](contracts/membership-billing.md) defines the invoice mapper, idempotent issue, and reconciliation outcomes.
- [contracts/edge-functions.md](contracts/edge-functions.md) defines the two JWT functions, the hourly run, and the two extended functions.
- [quickstart.md](quickstart.md) defines the validation scenarios, including the Deno double for a configured channel.

## Implementation design

### 1. Migration

Create one migration only after checking remote numbering. Local history ends at `0023`. F1.09 reserves `0024_f109_adult_memberships.sql`. This feature’s file is `0025_f126_membership_automatic_collection.sql` and it references `membership_charge_intents`, so `0024` must be applied first. Renumber both if the remote head has moved.

1. Create the six tables, checks, and partial unique indexes in data-model.md.
2. Add `membership_period_intent_id` to the three billing tables and replace the exactly-one-subject check with the three-way form. Extend owner SELECT on `billing_documents`.
3. Enable RLS. Authenticated users get SELECT of their own rows; admins get SELECT of all. No authenticated INSERT/UPDATE/DELETE.
4. Register `membership-collection-run` in `pg_cron` hourly, calling the function with `billing_get_secret('bexio_scheduler_secret')` and `timeout_milliseconds := 60000`, following `0004_bexio_reconcile_cron.sql`. Do not change the `bexio-reconcile` schedule.

Do not modify `memberships`, `credits`, `bookings`, or camp tables.

### 2. Channel and billing

- Implement the port and `UnconfiguredCollectionChannel` as in the collection-channel contract.
- Add `issueInvoiceForMembershipPeriod` beside the camp issuer, including `api_reference` recovery.
- Extend reconciliation for membership documents: full payment signals once; partial payment does not; a second settlement sets `duplicate_receipt`; a reversal signals `payment_reversed`.
- Before issuing, the hourly run copies each F1.09 charge intent that has no `membership_period_intents` row yet. It copies `amount`, `currency`, and `period_key`, and stores `claim_kind` (`month` or `cancel_fee`). It does not invent a period and does not recompute 10%.
- The hourly run polls status and submits collections only for active mandates, active clients, and the automatic method. The fee uses that same path. It also issues the QR invoice when the method is `qr_invoice`, with no collection row.
- When a period intent becomes paid, the run or reconciliation sets `membership_charge_intents.paid_at` for its `charge_intent_id`. Paying the month does not delete or cancel the fee invoice.

### 3. My Payments

- List the signed-in client’s subjects, method, latest mandate status, and period status.
- Actions call the two JWT functions. Copy uses the contract table and must not mention Automatic transaction, standing approval, or a standing order.
- When `qr_pay_hidden` is true, do not show the pay action for that period. Lesson and camp rows on the same page stay as they are.

### 4. Admin Collections

- New dashboard tab. Read-only list of methods, mandate status, failed or rejected collections, reversals, and duplicate receipts.
- Admin may call the same JWT functions for a client. Deactivated clients still cannot opt in.

### 5. Test double

- Deno tests inject a configured `CollectionChannel` that returns scripted statuses. Production wiring always uses the unconfigured adapter until a later, contracted adapter is specified.
- Quickstart scenario 4 is the stand-in for a real Membership until F1.09 can insert subjects and intents.

## Complexity Tracking

No constitution violations. No waiver table.

## Risks

- F1.09 is specified and planned, and is not implemented yet. Until `membership_charge_intents` exists, the quickstart seed remains the test double. Implement F1.09 before this feature.
- A live eBill debit cannot be verified until a contracted adapter replaces the unconfigured one.
- An emailed Swiss QR slip can still be paid after the app hides the pay action. Duplicate settlement is recorded for Admins and is not refunded in this feature.
- Remote migration numbers may already be ahead of local `0023`. Confirm before adding `0025`. If F1.26 is applied while every charge stays unpaid, the next F1.09 1st creates the fee and stops further months. That is the F1.09 rule, not a second F1.26 policy.
