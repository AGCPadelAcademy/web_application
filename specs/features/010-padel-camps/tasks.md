# Tasks: Padel Camps / Camps Registration (F1.25)

**Input**: Design documents from `/specs/features/010-padel-camps/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/edge-functions.md, contracts/camp-billing.md, quickstart.md

**Tests**: Included — the spec requests automated coverage of registration, capacity, payment-state, confirmation, and parent/child isolation (FR-040).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently. Story numbers map to `spec.md` (US1–US10).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US10 from spec.md (Setup/Foundational/Polish phases have no story label)
- Every task names its exact file path

## Path Conventions

- Frontend: `src/` (React SPA)
- Backend: `supabase/functions/` (Deno Edge Functions), `supabase/migrations/` (SQL)
- SQL/RLS tests: `tests/sql/`
- Frontend unit tests: `src/**/*.test.js`; Deno unit tests: `supabase/functions/**/*.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm branch, migration numbering, and directory scaffolding before any change

- [ ] T001 Confirm the `cursor/f1-25-padel-camps-4155` branch is checked out from up-to-date `origin/main` and verify the next migration number against the remote project before naming `supabase/migrations/0014_f125_padel_camps.sql` (see data-model.md §Migration plan; historical tracking has gaps)
- [ ] T002 [P] Create the new Edge Function directories `supabase/functions/camp-submit-registration/`, `supabase/functions/camp-cancel-registration/`, and `supabase/functions/camp-admin/` per plan.md §Project Structure
- [ ] T003 [P] Confirm local tooling runs the existing quality gate: `npm run lint`, `npm test`, `npm run build`, and `deno test` under `supabase/functions/` (constitution quality gate)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, RLS, transactional capacity function, and billing-spine extension that EVERY user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Write `supabase/migrations/0014_f125_padel_camps.sql` creating `camps`, `camp_extras`, `children`, `camp_registrations`, `camp_registration_extras`, and `camp_waitlist_entries` with all columns, CHECK constraints, and indexes from data-model.md (including the partial UNIQUE index for duplicate-active-registration prevention on `camp_registrations` and the active-waitlist uniqueness on `camp_waitlist_entries`)
- [ ] T005 In the same migration, add `camp_registration_id uuid NULL` to `billing_documents` (UNIQUE, FK ON DELETE RESTRICT), `billing_operations`, and `billing_events`; add the exactly-one-subject CHECK on `billing_documents`; extend the `billing_documents` owner RLS clause to the registration’s `parent_id` (research R-02)
- [ ] T006 In the same migration, create the `camp_public_list` security-invoker view (published Camps only, derived `is_full` / `places_remaining`, no parent/child columns) and grant `SELECT` to `anon` and `authenticated` (research R-08)
- [ ] T007 In the same migration, create `public.register_camp_child(...)` and `public.cancel_camp_registration(...)` as SECURITY DEFINER service-role-only functions implementing the atomic lock + window/eligibility/age/capacity revalidation + snapshot insert from data-model.md §Transactional capacity function (research R-04/R-05)
- [ ] T008 In the same migration, enable RLS and create policies per data-model.md: public read of published `camps`/`camp_extras`, owner-or-admin `children` (no DELETE policy), owner-or-admin `camp_registrations`/`camp_registration_extras`/`camp_waitlist_entries`, admin-only Camp writes
- [ ] T009 Apply the migration to the Supabase **test** project via MCP `apply_migration`; never against production (constitution testing rule)
- [ ] T010 [P] Write SQL RLS/transaction tests in `tests/sql/0014_f125_padel_camps.test.sql` mirroring the existing `tests/sql/0011_f104_client_management.test.sql` pattern: static assertions (columns, RLS enabled, policies, view grants, function privileges) plus commented actor-matrix transactions for parent A/B isolation, admin writes, anon public read, and duplicate-active-registration refusal
- [ ] T011 Run the capacity concurrency check on the test project: two simultaneous `register_camp_child` calls for the last place must yield exactly one active registration (quickstart §4.3); record the result in `tests/sql/0014_f125_padel_camps.test.sql` comments

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Admin publishes a reusable Camp (Priority: P1) 🎯 MVP

**Goal**: Admins create/edit/publish/unpublish Camps and extras from the existing admin dashboard without code changes

**Independent Test**: Admin creates and publishes Camp A with two extras; visitor sees it on `/camps`; unpublish hides it while registrations stay attached; capacity change applies to subsequent availability; non-admin is refused (spec US1)

### Tests for User Story 1

- [ ] T012 [P] [US1] Write Deno unit tests for `camp-admin` authorization and camp/extra upsert validation in `supabase/functions/camp-admin/index.test.ts` (non-admin → 403; invalid date order / negative price / non-positive capacity rejected)

### Implementation for User Story 1

- [ ] T013 [US1] Implement `supabase/functions/camp-admin/index.ts` actions `upsert_camp`, `upsert_extra`, and `remove_extra` per contracts/edge-functions.md §3: active-admin-only via `canAdminister`, service-role PostgREST writes, sanitized errors
- [ ] T014 [US1] Implement the frontend admin service functions `upsertCamp`, `upsertCampExtra`, and `removeCampExtra` in `src/lib/camps.js` following the explicit-session-JWT invoke pattern of `src/lib/billing.js`
- [ ] T015 [P] [US1] Write Vitest contract tests for the admin camp service functions in `src/lib/camps.test.js` (mirroring `src/lib/bookings.test.js` mock patterns)
- [ ] T016 [US1] Create `src/components/admin/CampManagementPanel.jsx` with the Camps tab: camp list, create/edit form (dates, schedule, eligibility/ages, price, capacity, registration window, publication, practical info), and extras management, reusing existing card/input/toast patterns from `ClientManagementPanel.jsx`
- [ ] T017 [US1] Register the Camps tab in `src/pages/AdminDashboardPage.jsx` alongside the existing Clients / Bexio integration tabs

**Checkpoint**: User Story 1 fully functional — an admin can publish a Camp with extras and it is persisted

---

## Phase 4: User Story 2 - Parent discovers published Camps on `/camps` (Priority: P1)

**Goal**: Public marketing page lists published Camps with status (open / closed / `Complet / Ausgebucht`) and a clear CTA, mobile-first

**Independent Test**: Publish open, unpublished, closed, and full Camps; `/camps` as a visitor on a mobile-width view shows only the intended published Camps with correct status and CTAs (spec US2)

### Tests for User Story 2

- [ ] T018 [P] [US2] Write Vitest tests for the public camp-list and status-derivation helpers in `src/lib/camps.test.js` (open vs closed vs full mapping, extras total display)

### Implementation for User Story 2

- [ ] T019 [US2] Implement public read helpers `fetchPublicCamps` and `fetchPublicCamp(slug)` in `src/lib/camps.js` reading `camp_public_list` (anon-safe, no PII)
- [ ] T020 [US2] Create `src/pages/CampsPage.jsx` rendering published Camps with name, dates, schedule/hours, eligibility/ages, price, description, registration status/deadline, availability, and CTA; full Camps show `Complet / Ausgebucht`
- [ ] T021 [US2] Create `src/pages/CampDetailPage.jsx` showing one Camp’s detail and status, with the registration CTA that sends unauthenticated visitors through `/login?return_to=…` (same pattern as `LessonsPage.handleBookNow`)
- [ ] T022 [US2] Register the `/camps` and `/camps/:slug` routes in `src/App.jsx` and add a Camps link to `src/components/layout/Header.jsx` and `src/components/layout/Footer.jsx` (additive; `/trips` unchanged)

**Checkpoint**: User Stories 1 AND 2 work — an admin-published Camp is publicly discoverable

---

## Phase 5: User Story 3 - Parent maintains several children on the Children page (Priority: P1)

**Goal**: Parent lists, adds, edits, and archives their children and opens each child’s Camp invoices

**Independent Test**: Parent A adds children X and Y, edits Y’s allergies, opens X’s invoice after a registration; parent B sees none of A’s children; Y is selectable for a second Camp without retyping (spec US3)

### Tests for User Story 3

- [ ] T023 [P] [US3] Write Vitest tests for the children service in `src/lib/children.test.js` (payload allow-list, archive-not-delete, error mapping)

### Implementation for User Story 3

- [ ] T024 [US3] Implement `src/lib/children.js`: `listChildren`, `createChild`, `updateChild`, `archiveChild` against the `children` table with owner-scoped RLS and explicit field allow-list (name, DOB, padel level, allergies, emergency contact)
- [ ] T025 [US3] Implement `listChildCampInvoices(childId)` in `src/lib/children.js` joining `camp_registrations` with `billing_documents(status, document_nr)` for the signed-in parent (mirrors `PaymentsPage` embed pattern)
- [ ] T026 [US3] Create `src/pages/ChildrenPage.jsx`: children list, add/edit form, archive action, and per-child Camp invoice list with a document link
- [ ] T027 [US3] Register the protected `/children` route in `src/App.jsx` and add a “My Children” item to the user menu in `src/components/layout/Header.jsx`

**Checkpoint**: Parent manages multiple children independently of any Camp

---

## Phase 6: User Story 4 - Parent registers a saved child and selects extras (Priority: P1)

**Goal**: Server-orchestrated registration: select child → extras → terms → review → submit; atomic revalidation; idempotent

**Independent Test**: Register eligible child X with one extra; submit twice → one registration; ineligible age and past-deadline submissions refused with no chargeable registration (spec US4)

### Tests for User Story 4

- [ ] T028 [P] [US4] Write Deno unit tests for `camp-submit-registration` in `supabase/functions/camp-submit-registration/index.test.ts`: ownership, inactive/deactivated parent refusal, profile-incompleteness gate, terms-required, and error mapping of `camp_full`/`camp_closed`/`age_out_of_range`/`duplicate_registration`
- [ ] T029 [P] [US4] Extend the SQL tests in `tests/sql/0014_f125_padel_camps.test.sql` for `register_camp_child`: window not open, deadline passed, unpublished, archived child, age out of range, extras not belonging to the Camp rejected

### Implementation for User Story 4

- [ ] T030 [US4] Implement `supabase/functions/camp-submit-registration/index.ts` per contracts/edge-functions.md §1: JWT + active-owner + billing-completeness gate, then `register_camp_child`, returning registration + error codes
- [ ] T031 [US4] Implement `submitCampRegistration` in `src/lib/camps.js` with the deterministic retry behavior (same registration intent never duplicates; server idempotency rules per contract)
- [ ] T032 [US4] Build the registration flow in `src/pages/CampDetailPage.jsx`: saved-child selector (from `src/lib/children.js`) with inline add-child, parent contact confirmation from the profile, extras selection with live total (base + extras), terms checkbox, review, submit
- [ ] T033 [US4] Reuse the billing-profile completeness gate: open the existing profile-completion path (`src/components/modals/ProfileCompletionModal.jsx`) before a chargeable registration when the parent profile is incomplete; deactivated parents see the inactive message (F1.04)

**Checkpoint**: A parent can register one saved child for an open Camp; retries and invalid input are safe

---

## Phase 7: User Story 5 - Registration produces one invoice; payment is separate (Priority: P1)

**Goal**: Exactly one Bexio invoice per registration (Camp + extras lines) through the F1.03 boundary; invoice creation never marks paid

**Independent Test**: One valid registration → one invoice with Camp + extra lines, correct CHF total, 0% VAT; retry after timeout reuses it; status stays awaiting payment until reconciliation (spec US5)

### Tests for User Story 5

- [ ] T034 [P] [US5] Write Deno unit tests for the camp invoice mapper in `supabase/functions/_shared/billing/camp-mapper.test.ts` (Camp + extras lines, totals, `api_reference` format, 0% tax selection)
- [ ] T035 [P] [US5] Write Deno unit tests for `issueInvoiceForCampRegistration` in `supabase/functions/_shared/billing/financial-service.camp.test.ts` with a mocked provider + in-memory repo: idempotent replay, lost-response recovery via `api_reference`, provider outage → pending `billing_operations` row

### Implementation for User Story 5

- [ ] T036 [US5] Implement `supabase/functions/_shared/billing/camp-mapper.ts` per contracts/camp-billing.md (`campRegistrationToInvoiceInput`: Camp base line + one line per extra, CHF, payment term, 0% tax)
- [ ] T037 [US5] Extend `supabase/functions/_shared/billing/financial-service.ts` with the camp repository reads (`getCampRegistration`, `getCampRegistrationExtras`, `findCampDocument`, `upsertCampDocument`) and `issueInvoiceForCampRegistration` reusing the existing contact/idempotency/operation logic
- [ ] T038 [US5] Wire invoice issuance into `supabase/functions/camp-submit-registration/index.ts` after the transactional insert, including the existing invoice-PDF email via `_shared/billing/mailer.ts` with a `notifications_log` idempotency guard keyed to the camp registration (FR-031)
- [ ] T039 [US5] Extend `supabase/functions/billing-invoice-document/index.ts` to accept `camp_registration_id` with parent-or-admin authorization (contract §4), and add `fetchCampInvoicePdfBlob(registrationId)` to `src/lib/billing.js`

**Checkpoint**: Registration → exactly one invoice → visible per child; payment state untouched by issuance

---

## Phase 8: User Story 6 - Capacity cannot be oversold (Priority: P1)

**Goal**: Derived availability, atomic last-place enforcement, public full state, capacity release on cancel

**Independent Test**: Capacity 1, two concurrent valid submissions → at most one place-holding registration; public Camp shows `Complet / Ausgebucht`; unpaid cancellation releases the place (spec US6)

### Tests for User Story 6

- [ ] T040 [P] [US6] Write Deno unit tests for `camp-cancel-registration` in `supabase/functions/camp-cancel-registration/index.test.ts`: owner-only, unpaid-only, idempotent re-cancel, provider-outage enqueue, paid → `refund_agreement_required`

### Implementation for User Story 6

- [ ] T041 [US6] Implement `supabase/functions/camp-cancel-registration/index.ts` per contracts/edge-functions.md §2 (Bexio cancel when issued/unpaid; registration cancelled regardless on provider outage with queued retry)
- [ ] T042 [US6] Implement `cancelCampRegistration` in `src/lib/camps.js` and surface “Cancel registration” on the child’s invoice/registration entry in `src/pages/ChildrenPage.jsx` for unpaid registrations only
- [ ] T043 [US6] Surface the full state end-to-end: `Complet / Ausgebucht` badge and disabled CTA in `src/pages/CampsPage.jsx` and `src/pages/CampDetailPage.jsx` from `camp_public_list.is_full`, with submission-time revalidation errors mapped to clear messages

**Checkpoint**: Capacity cannot be oversold and releases correctly on unpaid cancellation

---

## Phase 9: User Story 7 - Paid registration sends one confirmation email (Priority: P1)

**Goal**: Confirmation email with child/Camp/dates/schedule/total/extras/practical info, sent exactly once after reconciled payment

**Independent Test**: Record full payment in Bexio → reconcile → one confirmation email; re-run reconciliation → still one; unpaid registration never triggers it (spec US7)

### Tests for User Story 7

- [ ] T044 [P] [US7] Write Deno unit tests for the confirmation guard in `supabase/functions/_shared/billing/camp-confirmation.test.ts` (subject/html content, skip when a `sent` notification exists)
- [ ] T045 [P] [US7] Extend the reconciliation tests (new file `supabase/functions/bexio-reconcile/camp-reconcile.test.ts`): paid camp document → registration confirmed once + confirmation sent once; partial → stays pending; re-run → no duplicate

### Implementation for User Story 7

- [ ] T046 [US7] Implement `supabase/functions/_shared/billing/camp-confirmation.ts` per contracts/camp-billing.md (subject, html, `notifications_log` sent-guard)
- [ ] T047 [US7] Extend `supabase/functions/_shared/billing/reconciliation-service.ts` and `supabase/functions/bexio-reconcile/index.ts` so paid Camp documents transition `camp_registrations` once (`confirmCampRegistrationIfPending`) and trigger the confirmation email once; `camp_invoice_issue` / `camp_invoice_cancel` retries processed by the worker

**Checkpoint**: Paid registration closes the loop with exactly one confirmation email

---

## Phase 10: User Story 8 - Full Camp can take a waitlist (Priority: P2)

**Goal**: Deterministic Camp waitlist that never consumes capacity; admin conversion revalidates atomically

**Independent Test**: Full waitlist-enabled Camp → parent joins (capacity unchanged, duplicate refused) → release a place → admin converts with revalidation → second conversion fails (spec US8)

### Tests for User Story 8

- [ ] T048 [P] [US8] Write Deno unit tests for waitlist join/convert authorization and ordering in `supabase/functions/camp-admin/index.test.ts` and extend SQL tests in `tests/sql/0014_f125_padel_camps.test.sql` for the active-entry uniqueness

### Implementation for User Story 8

- [ ] T049 [US8] Implement `joinCampWaitlist` in `src/lib/camps.js` and the join UI on the full-Camp state in `src/pages/CampDetailPage.jsx` (only when `waitlist_enabled`)
- [ ] T050 [US8] Add `list_waitlist` and `convert_waitlist` actions to `supabase/functions/camp-admin/index.ts` per contract §3 (conversion calls `register_camp_child` then the camp invoice issuance)
- [ ] T051 [US8] Add the waitlist management view (deterministic order, convert action) to `src/components/admin/CampManagementPanel.jsx`

**Checkpoint**: Full Camps collect waitlist entries without overselling

---

## Phase 11: User Story 9 - Admin reviews registrations and exports them (Priority: P2)

**Goal**: Admin registration list with payment distinction, remaining places, and authorized CSV export

**Independent Test**: One unpaid + one paid registration → admin distinguishes them, sees remaining places, exports CSV; non-admin denied (spec US9)

### Tests for User Story 9

- [ ] T052 [P] [US9] Write Vitest tests for the CSV field selection/serialization helper in `src/lib/camps.test.js` (authorized FR-035 field set only)

### Implementation for User Story 9

- [ ] T053 [US9] Add `list_registrations` and `export_registrations` actions to `supabase/functions/camp-admin/index.ts` returning Camp, child, age, parent/guardian, phone, email, level, extras, total, payment status, registration date, and remaining places
- [ ] T054 [US9] Add the Registrations tab (list, pending-vs-paid distinction, remaining places, CSV download) to `src/components/admin/CampManagementPanel.jsx`

**Checkpoint**: Admin can operate the Camp roster and export it

---

## Phase 12: User Story 10 - Conversion funnel can be counted without PII (Priority: P3)

**Goal**: Four first-party funnel events, no child/parent PII, vendor-neutral

**Independent Test**: Walk visit → start → complete → payment-confirmed; four events exist and payloads contain no PII (spec US10)

### Tests for User Story 10

- [ ] T055 [P] [US10] Write Vitest tests in `src/lib/camps.test.js` asserting the funnel event payloads contain only Camp id + step (+ timestamp) — no names, emails, phones, DOB, allergies, or emergency contacts

### Implementation for User Story 10

- [ ] T056 [US10] Implement `trackCampFunnelEvent` in `src/lib/camps.js` recording the four events from research R-13 (page view in `CampsPage.jsx`, started in `CampDetailPage.jsx`, completed after successful submit, payment confirmed emitted server-side from the reconciliation path)

**Checkpoint**: Funnel measurable without PII

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Verification, docs, and regression hygiene across all stories

- [ ] T057 Run the full quality gate: `npm run lint`, `npm test`, `npm run build`, and `deno test` under `supabase/functions/` — all must pass (constitution quality gate)
- [ ] T058 [P] Execute the quickstart validation end-to-end on the test project + Bexio demo company per `specs/features/010-padel-camps/quickstart.md` §0–§9 and record results in `quickstart.md` (validation log)
- [ ] T059 [P] Update baseline docs the feature actually changes: `specs/baseline-system/requirements.md` (new BC entry for Camps), `specs/project-context/api-contracts.md` (new functions/tables), and `specs/project-context/domain-model.md` (Camp/Child/Registration entities) per specs/features/README.md rule 6
- [ ] T060 Deploy the new/updated Edge Functions to the test project and verify authorization with direct unauthenticated/cross-parent requests (401/403) before any production cutover

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (schema, RLS, capacity function, billing columns)
- **US1 Admin Camps (Phase 3)**: Foundational only
- **US2 Public `/camps` (Phase 4)**: Foundational only
- **US3 Children page (Phase 5)**: Foundational only
- **US4 Registration (Phase 6)**: US2 (detail page hosts the flow) + US3 (saved children)
- **US5 Invoice (Phase 7)**: US4 (registration exists to invoice)
- **US6 Capacity (Phase 8)**: Foundational capacity function + US2 full-state UI + US4 submission
- **US7 Confirmation (Phase 9)**: US5 (documents to reconcile)
- **US8 Waitlist (Phase 10)**: US4 + US6 (full state and conversion path)
- **US9 Admin registrations/export (Phase 11)**: US1 (admin panel) + US4 (registrations exist)
- **US10 Analytics (Phase 12)**: US2 + US4 + US7 (event points exist)
- **Polish (Phase 13)**: All desired stories complete

### Within Each User Story

- Tests first, and they MUST fail before implementation (spec FR-040 requests coverage)
- Schema/lib before functions before UI
- Story checkpoint before moving to the next priority

### Parallel Opportunities

- After Foundational: US1, US2, and US3 can proceed in parallel (different files)
- Within stories: test tasks marked [P] run in parallel; lib tests [P] run alongside function tests
- T058/T059 in Polish can run in parallel after T057 passes

---

## Parallel Example: After Foundational

```bash
# Three stories start together (disjoint files):
Task: "US1 — camp-admin function + CampManagementPanel"
Task: "US2 — camps.js public reads + CampsPage/CampDetailPage"
Task: "US3 — children.js + ChildrenPage"

# Within US5, test tasks run together:
Task: "camp-mapper unit tests in supabase/functions/_shared/billing/camp-mapper.test.ts"
Task: "issueInvoiceForCampRegistration tests in supabase/functions/_shared/billing/financial-service.camp.test.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 + US4 + US5 + US6 + US7 are all P1)

The client’s V1 priority spans all P1 stories; the smallest demoable slice is:

1. Setup + Foundational → schema and capacity function ready
2. US1 + US2 → admin publishes, public discovers
3. US3 + US4 → children exist, registration works
4. US5 + US6 + US7 → invoice, capacity safety, confirmation email
5. **STOP and VALIDATE** the full journey end-to-end (quickstart §0–§5)

### Incremental Delivery

1. Foundational → test project migration verified
2. P1 chain (US1→US7) → validated per story checkpoints
3. US8 waitlist → validated
4. US9 admin list/export → validated
5. US10 analytics → validated
6. Polish → quality gate + quickstart log + baseline doc updates

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [US#] labels map to spec.md user stories for traceability
- Commit per completed user-story phase (constitution workflow), not per task
- Migration number `0014` is tentative — T001 confirms remote numbering first
- Camps never reuse `bookings`/`lessons`; invoices ride the F1.03 `billing_*` spine via additive columns (research R-01/R-02)
