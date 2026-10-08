# Implementation Plan: Membership Automatic Collection (eBill Direct Debit) (F1.26)

**Branch**: `cursor/feature-specification-automation-933f` | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/features/011-membership-automatic-collection/spec.md`

## Summary

Add an issuer-initiated Direct Debit collection channel for adult Membership periods. The client or an Admin chooses automatic collection in My Payments. AGC stores that choice, requests one mandate proposal through a provider-neutral channel port, issues the period invoice through the existing F1.03 billing spine, and submits one collection when the mandate is active. Confirmed payment writes a signal F1.09 can read later. QR / bank transfer stays the fallback. The shipped channel adapter is unconfigured, so live bank debit waits until AKB confirms a contract. This feature does not implement Membership lifecycle, Group fixed-place, or the unused `memberships` table.

## Technical Context

**Language/Version**: JavaScript/JSX on React 18 + Vite 7; SQL/PL/pgSQL for migrations; Deno TypeScript in Supabase Edge Functions. Node `>=20.19`. No TypeScript migration.

**Primary Dependencies**: Existing stack only — Supabase JS 2.30, Supabase Auth/Postgres/RLS/Edge Functions, React Router 6, existing Radix/shadcn-style components, existing F1.03 `billing_*` spine and `FinancialService → AccountingProvider → BexioAdapter`. New server-side `CollectionChannel` port with an unconfigured adapter. Zero new npm packages. No SIX SDK.

**Storage**: Supabase PostgreSQL. New tables `collection_subjects`, `collection_methods`, `direct_debit_mandates`, `membership_period_intents`, `collection_requests`, `membership_payment_signals`. Additive `membership_period_intent_id` on `billing_documents` / `billing_operations` / `billing_events`. Money is `numeric(10,2)` CHF. Optional IBAN column only.

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
| V. Migration discipline | One forward migration after remote numbering confirmation. Money is `numeric`. Status values are CHECK constraints. No unrelated schema debt | PASS |
| VI. Documentation | Research, data model, contracts, and quickstart in this feature folder. Mermaid for the entity and state diagrams | PASS |
| VII. Simplicity / YAGNI | Reuse F1.03 invoicing and reconciliation. One unconfigured channel adapter instead of an unconfirmed AKB client. No cancel-collection API | PASS |
| Fixed stack | React, Supabase, Deno Edge Functions. No custom API server and no new payment vendor in this slice | PASS |
| Payments | Manual bank transfer remains the fallback. Direct Debit is an additional rail into the same paid meaning. No Stripe | PASS |
| Swiss PII | Client isolation. IBAN only if a future channel requires it. No full account numbers in logs | PASS |

**Pre-design gate: PASS.** No unresolved clarifications. The concrete bank adapter is intentionally deferred until AKB confirms a contract (research R-04).

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
└── tasks.md                         # created later by /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 0020_f126_membership_automatic_collection.sql   # tentative; confirm remote history first
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
└── 0020_f126_membership_automatic_collection.test.sql
```

**Structure Decision**: Stay inside the existing SPA, `src/lib` service modules, migrations, and Edge Functions. Clients manage the collection method on My Payments. Admins get one tab on the existing dashboard. The bank port lives next to the F1.03 billing modules and is not callable from the browser.

## Phase 0: Research result

[research.md](research.md) resolves:

- Correlation tables instead of the unused `memberships` / `credits` tables
- A chargeable-period inbox without a Membership lifecycle
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

Create one migration only after checking remote numbering. Local history ends at `0019`, so the tentative file is `0020_f126_membership_automatic_collection.sql`.

1. Create the six tables, checks, and partial unique indexes in data-model.md.
2. Add `membership_period_intent_id` to the three billing tables and replace the exactly-one-subject check with the three-way form. Extend owner SELECT on `billing_documents`.
3. Enable RLS. Authenticated users get SELECT of their own rows; admins get SELECT of all. No authenticated INSERT/UPDATE/DELETE.
4. Register `membership-collection-run` in `pg_cron` hourly, calling the function with `billing_get_secret('bexio_scheduler_secret')` and `timeout_milliseconds := 60000`, following `0004_bexio_reconcile_cron.sql`. Do not change the `bexio-reconcile` schedule.

Do not modify `memberships`, `credits`, `bookings`, or camp tables.

### 2. Channel and billing

- Implement the port and `UnconfiguredCollectionChannel` as in the collection-channel contract.
- Add `issueInvoiceForMembershipPeriod` beside the camp issuer, including `api_reference` recovery.
- Extend reconciliation for membership documents: full payment signals once; partial payment does not; a second settlement sets `duplicate_receipt`; a reversal signals `payment_reversed`.
- The hourly run polls status and submits collections only for active mandates, active clients, and the automatic method. It also issues the QR invoice when the method is `qr_invoice`, with no collection row.

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

- F1.09 is not implemented. End-to-end collection against a real Group fixed-place cannot be demonstrated. The quickstart seed is the test double.
- A live eBill debit cannot be verified until a contracted adapter replaces the unconfigured one.
- An emailed Swiss QR slip can still be paid after the app hides the pay action. Duplicate settlement is recorded for Admins and is not refunded in this feature.
- Remote migration numbers may already be ahead of local `0019`. Confirm before adding `0020`.
