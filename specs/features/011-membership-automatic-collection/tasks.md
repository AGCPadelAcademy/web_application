# Tasks: Membership Automatic Collection (eBill Direct Debit) (F1.26)

**Input**: Design documents from `/specs/features/011-membership-automatic-collection/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/collection-channel.md, contracts/membership-billing.md, contracts/edge-functions.md, quickstart.md

**Tests**: Included — spec FR-031 requires automated coverage of mandate uniqueness, duplicate-collection prevention, QR fallback, reversal visibility, authorization isolation, and the payment-confirmed signal.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently. Story numbers map to `spec.md` (US1–US5).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 from spec.md (Setup, Foundational, and Polish have no story label)
- Every task names its exact file path

## Path Conventions

- Frontend: `src/` (React SPA)
- Backend: `supabase/functions/` (Deno Edge Functions), `supabase/migrations/` (SQL)
- SQL/RLS tests: `tests/sql/`
- Frontend unit tests: `src/**/*.test.js`; Deno unit tests: `supabase/functions/**/*.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the feature branch, migration number, and function folders before any behavior change

- [ ] T001 Confirm branch `cursor/feature-specification-automation-933f` and the next free migration number against the remote Supabase project before creating `supabase/migrations/0020_f126_membership_automatic_collection.sql` (local history ends at `0019`; plan.md §Risks)
- [ ] T002 [P] Create Edge Function directories `supabase/functions/membership-set-collection-method/`, `supabase/functions/membership-request-mandate/`, and `supabase/functions/membership-collection-run/` per plan.md §Project Structure
- [ ] T003 [P] Confirm the existing quality gate still runs with no new npm packages: `npm run lint`, `npm test`, `npm run build`, and `deno test` under `supabase/functions/` (constitution; plan.md Technical Context)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Operational schema, billing-spine columns, RLS, and the unconfigured collection port that every story uses

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Write `supabase/migrations/0020_f126_membership_automatic_collection.sql` creating `collection_subjects`, `collection_methods`, `direct_debit_mandates`, `membership_period_intents`, `collection_requests`, and `membership_payment_signals` with columns, CHECKs, FKs to `profiles`, and the partial unique indexes in `specs/features/011-membership-automatic-collection/data-model.md` (no FK to `public.memberships` or `public.credits`)
- [ ] T005 In `supabase/migrations/0020_f126_membership_automatic_collection.sql`, add nullable `membership_period_intent_id` to `billing_documents`, `billing_operations`, and `billing_events`; unique on the document column; replace `billing_documents_exactly_one_subject_check` with the three-way check among `booking_id`, `camp_registration_id`, and `membership_period_intent_id`; extend the document owner SELECT policy through the intent’s subject `client_id` (data-model.md §Billing spine)
- [ ] T006 In `supabase/migrations/0020_f126_membership_automatic_collection.sql`, enable RLS on the six new tables with SELECT for `is_admin()` or the owning client and no authenticated INSERT, UPDATE, or DELETE (data-model.md §RLS)
- [ ] T007 In `supabase/migrations/0020_f126_membership_automatic_collection.sql`, schedule `membership-collection-run` hourly via `pg_cron` / `pg_net` using Vault `bexio_scheduler_secret` and `timeout_milliseconds := 60000`, following `supabase/migrations/0004_bexio_reconcile_cron.sql`, without changing the `bexio-reconcile` schedule (research R-09)
- [ ] T008 [P] Write static SQL assertions in `tests/sql/0020_f126_membership_automatic_collection.test.sql` for the six tables, partial unique indexes, RLS enabled, no authenticated write policies, and the three-subject billing check; do not apply the migration (quickstart.md Prerequisites)
- [ ] T009 [P] Write failing Deno tests in `supabase/functions/_shared/billing/collection-channel.test.ts` for `isConfigured() === false`, no I/O, and `collection_channel_not_configured` from `proposeMandate`, `readMandate`, `submitCollection`, and `readCollection` (contracts/collection-channel.md)
- [ ] T010 Implement `UnconfiguredCollectionChannel` in `supabase/functions/_shared/billing/collection-channel.ts` so `supabase/functions/_shared/billing/collection-channel.test.ts` passes (contracts/collection-channel.md)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Client or Admin chooses automatic collection (Priority: P1) 🎯 MVP

**Goal**: An authorized client or an Admin stores automatic collection versus QR / invoice for a subject. Unconfigured channel refuses opt-in. Nothing is marked paid.

**Independent Test**: As the subject’s client, choose automatic collection and get a refusal while the channel is unconfigured, with QR still stored. Decline on another subject and QR remains. As Admin, call the same function for a client. As a different client, the call is 403. Screen copy does not say Automatic transaction, standing approval, or standing order (spec US1).

### Tests for User Story 1

- [ ] T011 [P] [US1] Write failing Deno tests in `supabase/functions/membership-set-collection-method/index.test.ts` for 403 non-owner, 409 `client_inactive`, 409 `collection_channel_not_configured` leaving method `qr_invoice`, successful `qr_invoice` with `stopped_at`, and no period status change (contracts/edge-functions.md)
- [ ] T012 [P] [US1] Write failing Vitest tests in `src/lib/membershipCollection.test.js` for the `membership-set-collection-method` JSON body and for rejection of the phrases “Automatic transaction”, “standing approval”, and “standing order”

### Implementation for User Story 1

- [ ] T013 [US1] Implement `supabase/functions/membership-set-collection-method/index.ts`: JWT via `auth.getUser`, owner or `canAdminister` from `supabase/functions/_shared/profile-access.ts`, service-role writes, and the response table in contracts/edge-functions.md (no mandate insert while the channel is unconfigured)
- [ ] T014 [US1] Implement `setCollectionMethod` in `src/lib/membershipCollection.js` using the explicit session JWT invoke pattern from `src/lib/billing.js`
- [ ] T015 [US1] Add the signed-in client’s collection-method control to `src/pages/PaymentsPage.jsx`, reading `collection_subjects` and `collection_methods` under RLS and showing the unconfigured-channel copy from contracts/edge-functions.md
- [ ] T016 [US1] Add `src/components/admin/MembershipCollectionsPanel.jsx` and register a Collections tab in `src/pages/AdminDashboardPage.jsx` so an Admin can set the method for a client through `src/lib/membershipCollection.js`

**Checkpoint**: User Story 1 is functional — the choice is stored, opt-in is refused while the channel is unconfigured, and QR payment remains

---

## Phase 4: User Story 2 - One Direct Debit mandate proposal and status (Priority: P1)

**Goal**: A configured channel creates one proposal per attempt. Retries correlate. After rejection or revocation, an explicit request creates the next attempt. Status is honest. Proposal and active mandate do not mark a period paid.

**Independent Test**: With the Deno channel double, opt in once and again and still have one `proposal_sent` row. After `rejected` or `revoked`, one explicit request adds a second attempt and a repeat does not add a third. `unsupported_bank` does not create another proposal (spec US2; quickstart Scenario 4).

### Tests for User Story 2

- [ ] T017 [P] [US2] Write failing Deno tests in `supabase/functions/_shared/billing/mandate-attempts.test.ts` for one in-flight `proposal_sent`, retry correlation, explicit next attempt only from `rejected` or `revoked`, terminal `unsupported_bank`, and `failed` retrying the same attempt (data-model.md state machine)

### Implementation for User Story 2

- [ ] T018 [US2] Implement the attempt rules in `supabase/functions/_shared/billing/mandate-attempts.ts` so `supabase/functions/_shared/billing/mandate-attempts.test.ts` passes
- [ ] T019 [US2] Implement `supabase/functions/membership-request-mandate/index.ts` per contracts/edge-functions.md, using `supabase/functions/_shared/billing/mandate-attempts.ts` and `supabase/functions/_shared/billing/collection-channel.ts`
- [ ] T020 [US2] Extend `supabase/functions/membership-set-collection-method/index.ts` so a configured channel creates the first `proposal_sent` attempt and a repeat while `proposal_sent` does not insert another row; production wiring still uses `UnconfiguredCollectionChannel`
- [ ] T021 [US2] Add `requestNewMandate` to `src/lib/membershipCollection.js` and cover its request body in `src/lib/membershipCollection.test.js`
- [ ] T022 [US2] Show the latest mandate status on `src/pages/PaymentsPage.jsx` using the English copy table in contracts/edge-functions.md, without treating `proposal_sent` or `active` as paid

**Checkpoint**: User Stories 1 and 2 work — one proposal attempt is tracked and a new attempt requires an explicit request

---

## Phase 5: User Story 3 - Period collection, invoice, and payment-confirmed signal (Priority: P1)

**Goal**: Each chargeable intent gets one F1.03 invoice and, when the mandate is active, one collection. Confirmation writes one `payment_confirmed` signal and does not change Membership lifecycle.

**Independent Test**: With the channel double, run the job twice for one active-mandate intent and get one `billing_documents` row and one `collection_requests` row. Confirming the collection marks the intent paid and inserts one signal. Issuing the invoice alone leaves the intent unpaid (spec US3; quickstart Scenario 4).

### Tests for User Story 3

- [ ] T023 [P] [US3] Write failing Deno tests in `supabase/functions/_shared/billing/membership-mapper.test.ts` for `apiReference` `agc:membership-period:{id}`, one CHF line, and the existing tax helper (contracts/membership-billing.md)
- [ ] T024 [P] [US3] Write failing Deno tests in `supabase/functions/_shared/billing/financial-service.membership.test.ts` that a second `issueInvoiceForMembershipPeriod` call does not create a second document and that issue does not set the intent `paid`
- [ ] T025 [P] [US3] Write failing Deno tests in `supabase/functions/_shared/billing/membership-collection-policy.test.ts` for one collection per intent, one `payment_confirmed` signal, and ignoring a channel timestamp older than `channel_status_at`

### Implementation for User Story 3

- [ ] T026 [US3] Implement `membershipPeriodToInvoiceInput` in `supabase/functions/_shared/billing/membership-mapper.ts` so `supabase/functions/_shared/billing/membership-mapper.test.ts` passes
- [ ] T027 [US3] Add `issueInvoiceForMembershipPeriod` to `supabase/functions/_shared/billing/financial-service.ts`, reusing the camp issuer’s document, operation, and `api_reference` recovery layers (contracts/membership-billing.md)
- [ ] T028 [US3] Implement the pure submit/signal decisions in `supabase/functions/_shared/billing/membership-collection-policy.ts` so `supabase/functions/_shared/billing/membership-collection-policy.test.ts` passes
- [ ] T029 [US3] Implement `supabase/functions/membership-collection-run/index.ts`: scheduler secret `bexio_scheduler_secret`, issue every not-yet-invoiced intent, submit a collection only when the policy allows it, and poll `submitted` rows (contracts/edge-functions.md)
- [ ] T030 [US3] Extend `supabase/functions/_shared/billing/reconciliation-service.ts` so a fully paid membership-period document inserts `payment_confirmed` with source `accounting_reconciliation` once, and `partially_paid` leaves the intent unpaid (contracts/membership-billing.md)
- [ ] T031 [US3] Extend `supabase/functions/bexio-reconcile/index.ts` to load documents with `membership_period_intent_id` and pass them through the reconciliation change in `supabase/functions/_shared/billing/reconciliation-service.ts` without changing lesson or camp confirmation behavior

**Checkpoint**: User Stories 1–3 work — one invoice, one collection, and one payment signal for a period

---

## Phase 6: User Story 4 - Honest fallback to QR / invoice (Priority: P2)

**Goal**: When automatic collection is unavailable, the client pays the F1.03 invoice by QR. After a collection is `submitted`, the in-app pay action is hidden. Lesson and camp invoices stay unchanged.

**Independent Test**: Not opted-in, unsupported bank, missing mandate, and unconfigured channel still offer QR. A `submitted` collection hides the Membership pay action and returns `qr_pay_hidden: true`. A lesson invoice and a camp invoice on My Payments are unchanged (spec US4; quickstart Scenarios 5 and 6).

### Tests for User Story 4

- [ ] T032 [P] [US4] Extend `src/lib/billing.test.js` so a membership document posts `membership_period_intent_id` and honors `qr_pay_hidden`, and so the existing lesson and camp document calls stay unchanged

### Implementation for User Story 4

- [ ] T033 [US4] Add the membership-period document helper to `src/lib/billing.js`, posting `{ "membership_period_intent_id": "..." }` to `billing-invoice-document`
- [ ] T034 [US4] Extend `supabase/functions/billing-invoice-document/index.ts` to accept exactly one of booking id, camp registration id, or `membership_period_intent_id`, enforce owner-or-admin, and return `"qr_pay_hidden": true` when a `collection_requests` row for that intent is `submitted` (contracts/edge-functions.md)
- [ ] T035 [US4] In `src/pages/PaymentsPage.jsx`, hide the Membership period pay action when `qr_pay_hidden` is true and show the fallback copy from contracts/edge-functions.md; leave the lesson and camp blocks in that file unchanged

**Checkpoint**: QR fallback and the hidden in-flight pay action work without changing lesson or camp payments

---

## Phase 7: User Story 5 - Failed collection, reclaim, and stop (Priority: P2)

**Goal**: A failed collection does not mark the period paid. A reversal is visible to Admins and clears paid. Stop and deactivation block later submissions only. An already submitted collection may finish.

**Independent Test**: Simulate failed collection, reversal, in-app stop, and deactivation with the channel double. No signal on failure. One `payment_reversed` signal and `duplicate_receipt` when both rails settle. A `submitted` request remains after stop or deactivation, and the next period gets no new collection (spec US5; quickstart Scenarios 4 and 5).

### Tests for User Story 5

- [ ] T036 [P] [US5] Write failing Deno tests in `supabase/functions/_shared/billing/membership-collection-policy.failure.test.ts` for failed collection not paid, in-flight request kept after stop and after `profiles.is_active = false`, no new submission in those cases, reversal clearing paid, and a second settlement setting `duplicate_receipt` without a second `payment_confirmed`

### Implementation for User Story 5

- [ ] T037 [US5] Extend `supabase/functions/_shared/billing/membership-collection-policy.ts` and `supabase/functions/membership-collection-run/index.ts` so stop and deactivation skip new submissions and do not cancel a `submitted` collection (research R-06)
- [ ] T038 [US5] Extend `supabase/functions/_shared/billing/reconciliation-service.ts` so a reversal sets the intent `reversed` and inserts one `payment_reversed` signal, and a second settlement sets `duplicate_receipt` without a second `payment_confirmed` (contracts/membership-billing.md)
- [ ] T039 [US5] Extend `src/components/admin/MembershipCollectionsPanel.jsx` with read-only lists of failed or rejected collections, reversals, and duplicate receipts for every client; keep non-admin reads on own rows only via RLS

**Checkpoint**: Failure, reversal, stop, and deactivation match the 2026-10-07 clarifications

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Gate the slice without applying the migration or calling a bank

- [ ] T040 [P] Run `npm run lint`, `npm test`, `npm run build`, and `deno test` on `supabase/functions/_shared/billing/collection-channel.test.ts`, `supabase/functions/_shared/billing/mandate-attempts.test.ts`, `supabase/functions/_shared/billing/membership-mapper.test.ts`, `supabase/functions/_shared/billing/financial-service.membership.test.ts`, `supabase/functions/_shared/billing/membership-collection-policy.test.ts`, and `supabase/functions/_shared/billing/membership-collection-policy.failure.test.ts` (quickstart.md Automated gate)
- [ ] T041 State in the header of `supabase/migrations/0020_f126_membership_automatic_collection.sql` that the file is not applied until an explicit user request, and tick only the automated quickstart scenarios; leave Scenarios 1–3 and 7 for the user (quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — blocks all user stories
- **User Stories (Phases 3–7)**: Depend on Foundational
- **Polish (Phase 8)**: Depends on the stories being completed

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational. No dependency on later stories. MVP.
- **User Story 2 (P1)**: Starts after Foundational. Extends `supabase/functions/membership-set-collection-method/index.ts` from US1, so finish US1 first or isolate the attempt rules in `mandate-attempts.ts` before editing that function.
- **User Story 3 (P1)**: Starts after Foundational. Does not require the My Payments controls from US1. Needs the billing columns from Phase 2.
- **User Story 4 (P2)**: After US3’s invoice id exists. Edits `src/pages/PaymentsPage.jsx` after US1 and US2.
- **User Story 5 (P2)**: After US3’s collection run and reconciliation hooks. Edits `src/components/admin/MembershipCollectionsPanel.jsx` after US1.

### Within Each User Story

- Write the listed tests first and confirm they fail before the implementation tasks in that phase
- Shared policy modules before the Edge Function that calls them
- Service helpers before page wiring

### Parallel Opportunities

- T002 and T003 can run together
- T008 and T009 can run together, and T009 can run beside T004–T007 because it does not edit the migration
- T011 and T012 can run together
- T023, T024, and T025 can run together
- T032 can run beside US3 backend work only after the document contract is stable; otherwise run it at the start of Phase 6
- T036 can be written before T037
- T040 can run as soon as the named test files exist

---

## Parallel Example: User Story 3

```bash
# Failing tests together, before implementation:
# supabase/functions/_shared/billing/membership-mapper.test.ts
# supabase/functions/_shared/billing/financial-service.membership.test.ts
# supabase/functions/_shared/billing/membership-collection-policy.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2
2. Complete Phase 3 (User Story 1)
3. Stop and validate the independent test: choice stored, opt-in refused while unconfigured, QR remains, other clients refused
4. Do not apply the migration unless the user explicitly asks

### Incremental Delivery

1. Setup + Foundational
2. US1 choice and refusal (MVP)
3. US2 mandate attempts with the channel double
4. US3 invoice, one collection, payment signal
5. US4 QR hide and unchanged lesson/camp pay
6. US5 failure, reversal, stop, deactivation
7. Polish gate

### Parallel Team Strategy

After Phase 2:

- One person can take US1 then US2 (same set-method function)
- Another can take US3 (billing and the hourly run) without waiting for the Payments UI
- US4 and US5 start after those file owners finish

---

## Notes

- Production wiring uses `UnconfiguredCollectionChannel` only. A real AKB or network-partner adapter is out of this task list.
- Do not write `public.memberships` or `public.credits`.
- Do not add a Membership Active/Paused/Cancelled column or a refund UI.
- Apply `supabase/migrations/0020_f126_membership_automatic_collection.sql` only after an explicit user request. Confirm the number is still free before applying.
