# Tasks: Bexio Financial & Accounting Integration

**Input**: Design documents from `/specs/features/007-bexio-integration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/edge-functions.md, contracts/accounting-provider.md, quickstart.md

**Tests**: Test tasks are included — the implementation plan (Technical Context) and the repository's brownfield constitution require Deno unit tests for new `_shared/billing` modules and SQL-level RLS tests for new tables.

**Organization**: Tasks are grouped by user story (US1–US6 from spec.md) so each story is independently implementable and testable after the foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US6 per spec.md; absent for Setup/Foundational/Polish phases

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: External accounts, secrets, and in-repo function scaffolding that everything else builds on

- [ ] T001 Create in-repo Edge Function scaffold per plan.md: `supabase/functions/_shared/billing/`, `supabase/functions/_shared/billing/bexio/`, `supabase/functions/bexio-oauth/`, `supabase/functions/billing-issue-invoice/`, `supabase/functions/billing-invoice-document/`, `supabase/functions/bexio-reconcile/`, plus `supabase/functions/deno.json` enabling `deno test`
- [ ] T002 [P] Register the Bexio developer app at developer.bexio.com (manual, per quickstart.md §0.1): record client id/secret, register redirect URL `https://<test-project-ref>.supabase.co/functions/v1/bexio-oauth?action=callback`, then set Edge Function secrets `BEXIO_CLIENT_ID`, `BEXIO_CLIENT_SECRET`, `BEXIO_OAUTH_STATE_SECRET` via `supabase secrets set`
- [ ] T003 [P] Prepare the Bexio demo company per quickstart.md §0.2: QR-capable bank account, invoice template with QR payment part, automatic invoice numbering, active sales tax (FR-018 prerequisites)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, provider abstraction, and the authenticated Bexio HTTP client that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Write migration `supabase/migrations/0XX_bexio_integration.sql` implementing data-model.md exactly: `CREATE EXTENSION IF NOT EXISTS` for `pg_cron` and `pg_net`; tables `billing_integrations`, `billing_contacts`, `billing_documents`, `billing_operations`, `billing_events` with all constraints/indexes; additive columns `bookings.payment_confirmation_source` + `bookings.payment_confirmed_at`; RLS enablement + policies per data-model.md; view `billing_public_config` with `authenticated` grant. Apply to the Supabase **test branch** via MCP `apply_migration`
- [ ] T005 [P] Add SQL RLS policy tests for all five new tables and the view in `tests/sql/bexio_integration_rls.test.sql` (mirror the existing PostgREST-level test pattern from `tests/`): admin-only reads on `billing_integrations`/`billing_contacts`/`billing_operations`/`billing_events`; owner-or-admin read on `billing_documents`; no client writes anywhere
- [ ] T006 [P] Implement Vault helpers `readSecret(name)` / `writeSecret(name, value)` in `supabase/functions/_shared/billing/vault.ts` (service-role SQL against `vault.decrypted_secrets` / `vault.create_secret`; never log values)
- [ ] T007 [P] Define the `AccountingProvider` interface and all shared types (`InvoiceInput`, `ExternalInvoice`, `ExternalContactRef`, `ProviderHealth`, error classes `ProviderAuthError`/`ProviderUnavailableError`) in `supabase/functions/_shared/billing/accounting-provider.ts` per contracts/accounting-provider.md
- [ ] T008 Implement the Bexio HTTP client in `supabase/functions/_shared/billing/bexio/bexio-client.ts`: base URL `https://api.bexio.com`, bearer header from Vault-cached token, single-flight token refresh on 401 (rotate `bexio_refresh_token` and `bexio_access_token_cache` in Vault, FR-004), `invalid_grant` → `ProviderAuthError`, 429/5xx exponential backoff honoring `RateLimit-*`/`Retry-After` (FR-008), sanitized structured logging (method, status, correlation key only — FR-032/FR-034). Depends on T006, T007
- [ ] T009 [P] Write Deno unit tests for the client in `supabase/functions/_shared/billing/bexio/bexio-client.test.ts` with mocked `fetch`: 401→refresh→single retry, refresh rotation persists new refresh token, `invalid_grant` surfacing, 429 backoff budget, log sanitization (no token strings in captured logs)
- [ ] T010 Register the reconciliation schedule: store a generated `bexio_scheduler_secret` in Vault and create the `pg_cron` job (every 15 min) invoking `bexio-reconcile` via `pg_net.http_post` with the `x-scheduler-secret` header — as a follow-up migration `supabase/migrations/0XX_bexio_reconcile_cron.sql`. Depends on T004

**Checkpoint**: Schema live on test branch; provider client can make an authenticated call once a token exists — user story implementation can now begin

---

## Phase 3: User Story 1 - OAuth connection and token lifecycle (Priority: P1) 🎯 MVP

**Goal**: An admin connects AGC to Bexio once via OAuth 2.0; tokens refresh automatically server-side; connection health is visible; no secret ever reaches a browser

**Independent Test**: quickstart.md §1 — connect flow completes, status card shows `connected` with scopes; tokens live only in Vault (§1.4); revocation flips status to `requires_reauth`

### Tests for User Story 1

- [ ] T011 [P] [US1] Write Deno unit tests in `supabase/functions/bexio-oauth/index.test.ts`: HMAC state nonce sign/verify + 10-min TTL rejection, callback code-exchange happy path (mocked `idp.bexio.com`), refresh rotation persisting the rotated refresh token, `invalid_grant` → `billing_integrations.status='requires_reauth'`

### Implementation for User Story 1

- [ ] T012 [US1] Implement `start`/`status`/`disconnect` actions in `supabase/functions/bexio-oauth/index.ts` per contracts/edge-functions.md §1: admin-only via caller JWT + `profiles.role='admin'`; `start` builds the authorize URL with scopes `contact_show contact_edit kb_invoice_show kb_invoice_edit offline_access` and a signed single-use `state`; `status` reads `billing_integrations`; `disconnect` deletes Vault secrets and sets `status='disconnected'`
- [ ] T013 [US1] Implement the `callback` action in `supabase/functions/bexio-oauth/index.ts`: validate `state`, exchange code at `https://idp.bexio.com/token`, write `bexio_refresh_token` + `bexio_access_token_cache` to Vault via T006 helpers, upsert `billing_integrations` (`status='connected'`, `scopes`, `connected_at`/`connected_by`), insert `integration.connected` into `billing_events`, 302-redirect to `/admin/integrations?bexio=connected|error=…` — never render tokens
- [ ] T014 [US1] Implement `initialize`/`configure` actions in `supabase/functions/bexio-oauth/index.ts` per research R-06: discover `bexio_user_id` (`GET /3.0/users/me`), `currency_id`, `bank_account_id`, `payment_type_id`, `tax_id`, `unit_id`, `language_id`, `country_id`, `template_slug`, `status_map`; merge into `billing_integrations.config`; `configure` validates manually supplied IDs with a draft-invoice roundtrip (create → `revert_issue` → delete) before setting `config_complete`
- [ ] T015 [P] [US1] Create the admin UI in `src/pages/AdminIntegrationsPage.jsx` (connection card: connect/disconnect buttons, status badge, scopes, `connected_at`, `last_successful_call_at`, `last_error`, reconnect banner when `requires_reauth`) and register the `/admin/integrations` route in `src/App.jsx` reusing the existing admin-route guard
- [ ] T016 [P] [US1] Create the function client module `src/lib/billing.js` with typed wrappers for `bexio-oauth` actions (used by T015; later stories extend it)
- [ ] T017 [US1] Deploy `bexio-oauth` to the test branch and verify quickstart.md §1.1–§1.4 end-to-end against the demo company

**Checkpoint**: Connection lifecycle works standalone; integration row + Vault secrets exist; nothing else depends on Bexio yet being callable for invoices

---

## Phase 4: User Story 2 - A lesson purchase produces exactly one Bexio invoice (Priority: P1)

**Goal**: Booking completion ensures one Bexio contact and one issued Bexio invoice per booking — retry-safe, timeout-safe, never blocking the booking itself

**Independent Test**: quickstart.md §2 — new customer creates contact+invoice; returning customer reuses contact; replayed idempotency key and lost-response retry never duplicate; Bexio outage still completes the booking and enqueues the operation

### Tests for User Story 2

- [ ] T018 [P] [US2] Write Deno unit tests in `supabase/functions/_shared/billing/bexio/bexio-mappers.test.ts`: profile → person contact payload (`contact_type_id: 2`, `name_1` last name, `name_2` first name per research R-04), booking+lesson type → `InvoiceInput` (gross CHF from `lesson_types.price`, `api_reference` format `agc:booking:{uuid}`, payment term from config)
- [ ] T019 [P] [US2] Write Deno unit tests in `supabase/functions/_shared/billing/financial-service.test.ts` with a mocked `AccountingProvider`: idempotency (existing `billing_documents.booking_id` or `api_reference` hit → reuse, no second create), lost-response recovery path, provider failure → `billing_operations` row with `next_retry_at` backoff

### Implementation for User Story 2

- [ ] T020 [US2] Implement AGC ⇄ Bexio payload translation in `supabase/functions/_shared/billing/bexio/bexio-mappers.ts` (contact, invoice positions as `KbPositionCustom` with config `account_id`/`tax_id`/`unit_id`, `mwst_is_net: false` per research R-05/R-14)
- [ ] T021 [US2] Implement contact + invoice operations in `supabase/functions/_shared/billing/bexio/bexio-adapter.ts` (implements `AccountingProvider` from T007): `findContactByEmail` (`POST /2.0/contact/search` field `mail`), `createContact`, `updateContact`, `findInvoiceByApiReference` (`POST /2.0/kb_invoice/search`), `createInvoice` (draft), `issueInvoice` (`POST /2.0/kb_invoice/{id}/issue`) — using the T008 client and config IDs from `billing_integrations.config`
- [ ] T022 [US2] Implement `issueInvoiceForBooking(bookingId)` in `supabase/functions/_shared/billing/financial-service.ts` per contracts/accounting-provider.md: idempotency guard → ensure contact (search/adopt/create, persist `billing_contacts`, FR-010/011) → create draft with `api_reference` → issue → upsert `billing_documents` (FR-017) → `invoice.issued` audit event; on `ProviderAuthError`/`ProviderUnavailableError` persist a pending `billing_operations` row (kind `contact_sync`/`invoice_issue`, deterministic `idempotency_key`) and rethrow a typed error
- [ ] T023 [US2] Implement the HTTP function in `supabase/functions/billing-issue-invoice/index.ts` per contracts/edge-functions.md §2: caller JWT + booking-ownership-or-admin check, idempotency short-circuit (`200 reused`), orchestrate via T022, map errors (`409 booking_not_billable`, `502 provider_unavailable` with operation enqueued); booking flow itself must never fail because of this function (FR-030)
- [ ] T024 [US2] Branch the existing invoice request in `src/lib/bookings.js`: read `integration_enabled` from `billing_public_config` (via `src/lib/billing.js`); when true invoke `billing-issue-invoice` for new bookings, when false/absent invoke legacy `generate-invoice-pdf` unchanged (research R-12; Q1-A: no automatic legacy fallback on Bexio failure — surface retry state instead)
- [ ] T025 [US2] Deploy `billing-issue-invoice` and verify quickstart.md §2.1–§2.5 on the test branch

**Checkpoint**: Core business value delivered — every new booking bills into Bexio exactly once; legacy path intact when the flag is off

---

## Phase 5: User Story 3 - Invoice document access from AGC (Priority: P1)

**Goal**: Booking owners and admins open the Bexio-generated invoice PDF inside AGC; pre-integration bookings keep their legacy documents

**Independent Test**: quickstart.md §3 — owner gets the Bexio PDF inline; other student gets 403; admin gets any PDF; pre-integration booking still serves its legacy PDF

### Implementation for User Story 3

- [ ] T026 [US3] Add `getInvoicePdf` to `supabase/functions/_shared/billing/bexio/bexio-adapter.ts`: `GET /2.0/kb_invoice/{id}/pdf`, decode base64 `{ data, name }` to bytes (research R-11; PDF exists only for issued invoices — guaranteed by T022)
- [ ] T027 [US3] Implement `supabase/functions/billing-invoice-document/index.ts` per contracts/edge-functions.md §3: caller JWT, owner-or-admin authorization mirroring the existing proof-access pattern, resolve `billing_documents` by `booking_id` (`404 no_document` for legacy bookings), stream `application/pdf` with `Content-Disposition: inline; filename="<document_nr>.pdf"`, `502 provider_unavailable` mapping; nothing written to Storage
- [ ] T028 [US3] Add the "View invoice" affordance for Bexio-billed bookings in the student payments view `src/pages/MyPaymentsPage.jsx` and the admin booking/verification views via `src/lib/billing.js`, leaving the existing legacy invoice links untouched (both paths coexist per quickstart.md §7)
- [ ] T029 [US3] Deploy `billing-invoice-document` and verify quickstart.md §3.1–§3.4 on the test branch

**Checkpoint**: Document self-service preserved end-to-end across the cutover boundary (Q1-A)

---

## Phase 6: User Story 4 - Bank payments become visible in AGC via reconciliation (Priority: P2)

**Goal**: The scheduled worker converges AGC payment state with Bexio-recorded payments — authoritative for `paid` (Q2-A), idempotent, partial-payment aware, proof-superseding

**Independent Test**: quickstart.md §4–§5 — full payment auto-confirms without admin action; partial payment does not; repeated runs never double-apply; pending proofs are superseded; manual-proof path still works and is never overwritten

### Tests for User Story 4

- [ ] T030 [P] [US4] Write Deno unit tests in `supabase/functions/_shared/billing/bexio/bexio-adapter.status.test.ts`: numeric-totals status derivation (research R-07: `received>0 && remaining<=0` → paid; partial; `status_map` only for cancelled/draft)
- [ ] T031 [P] [US4] Write Deno unit tests in `supabase/functions/bexio-reconcile/index.test.ts` (mocked provider + in-memory repo): guarded confirm transition never overwrites an already-`confirmed` booking (FR-037), proof supersede only on unresolved proofs (FR-036), no duplicate `payment.reconciled` events on re-run, stale/failed run leaves state convergent (order-safety)

### Implementation for User Story 4

- [ ] T032 [US4] Add `getInvoice` + normalized status derivation to `supabase/functions/_shared/billing/bexio/bexio-adapter.ts` (`total_received_payments`/`total_remaining_payments` authority, `hasQrPaymentPart` health signal, `cancelled` via configured `status_map`)
- [ ] T033 [US4] Implement the reconciliation core in `supabase/functions/bexio-reconcile/index.ts` per contracts/edge-functions.md §4: scheduler-secret or admin-JWT auth; iterate `billing_documents` in `issued`/`partially_paid`; on full payment apply the guarded booking update mirroring the live admin-approval field set (`status='confirmed'`, `payment_status='confirmed'`, `verification_status='approved'`, `payment_confirmation_source='bexio_reconciliation'`, `payment_confirmed_at`, `WHERE payment_status <> 'confirmed'` per research R-08); document-level `billing_documents.status` transitions to `paid`/`partially_paid`/`cancelled`; supersede unresolved proofs; write `billing_events`
- [ ] T034 [US4] Implement the retry-queue processor in `supabase/functions/bexio-reconcile/index.ts`: due `billing_operations` (`status='pending' AND next_retry_at<=now()`), execute by kind via `financial-service`, exponential backoff to `max_attempts`, then `failed` + `operation.retry_exhausted` event for admin alerting (FR-031)
- [ ] T035 [US4] Implement the FR-038 discrepancy check in `supabase/functions/bexio-reconcile/index.ts`: bookings confirmed via `manual_proof` whose Bexio invoice remains unpaid beyond the grace period (config key `manual_paid_grace_days`, default 30 days from admin approval — Clarification 2026-08-20) get a `reconciliation.discrepancy` event and admin-visible flag; proofs on reconciled-confirmed transactions are flagged `superseded`, never state-regressing
- [ ] T036 [US4] Add the manual "Run reconciliation now" action and the worker health summary (last run, counts, failed operations) to `src/pages/AdminIntegrationsPage.jsx` via `src/lib/billing.js`
- [ ] T037 [US4] Extend the existing admin proof-verification write path in `src/components/admin/PaymentVerificationPanel.jsx` (client-side PostgREST — no Edge Function exists there): on approval also set `payment_confirmation_source='manual_proof'` + `payment_confirmed_at`, and skip the booking update when the booking is already `payment_status='confirmed'` (FR-033/FR-037); keep the rejection behavior and the notification invoke unchanged
- [ ] T038 [US4] Deploy `bexio-reconcile`, confirm the `pg_cron` job from T010 invokes it (check `cron.job_run_details`), and verify quickstart.md §4.1–§4.4 and §5.1–§5.4 on the test branch

**Checkpoint**: Payment loop closed — bank payment in Bexio becomes `paid` in AGC within one interval, safely interleaved with the legacy manual flow

---

## Phase 7: User Story 5 - Cancellation and refund handling (Priority: P2)

**Goal**: Unpaid cancellations cancel the Bexio invoice programmatically; paid cancellations record the refund expectation and route the financial correction to manual processing in Bexio (no credit-note API — verified)

**Independent Test**: quickstart.md §8 — unpaid cancel cancels the invoice; outage queues the cancel; paid cancel raises the manual-correction indicator without money movement; Bexio-refused cancel surfaces a conflict

### Tests for User Story 5

- [ ] T039 [P] [US5] Write Deno unit tests in `supabase/functions/_shared/billing/financial-service.cancel.test.ts`: cancel only allowed for `issued`/unpaid documents; paid cancellation creates refund-expectation event + admin flag instead of API cancel; provider refusal surfaces conflict without forcing AGC state

### Implementation for User Story 5

- [ ] T040 [US5] Add `cancelInvoice` (`POST /2.0/kb_invoice/{id}/cancel`, issued-only) to `supabase/functions/_shared/billing/bexio/bexio-adapter.ts` and the `cancelInvoiceForBooking(bookingId)` orchestration to `supabase/functions/_shared/billing/financial-service.ts` (operation kind `invoice_cancel`, same idempotency/retry machinery)
- [ ] T041 [US5] Hook booking cancellation in the existing cancel path in `src/lib/bookings.js` (and the admin cancel handler if separate): for bookings with a `billing_documents` row — unpaid → invoke invoice cancel (enqueue `invoice_cancel` on provider failure, FR per US5 scenario 3); paid with refund agreed → record refund expectation + `billing_events` flag for manual Bexio processing, never attempting programmatic money movement
- [ ] T042 [US5] Surface pending financial cancellations and refund-required flags in the admin integrations/overview UI (`src/pages/AdminIntegrationsPage.jsx`), including the Bexio-refusal conflict state (US5 scenario 4)
- [ ] T043 [US5] Deploy affected functions and verify quickstart.md §8.1–§8.4 on the test branch

**Checkpoint**: Receivables stay clean on cancellations; refunds are an explicit, documented manual step in Bexio

---

## Phase 8: User Story 6 - Admin financial overview (Priority: P3)

**Goal**: Read-only operational financial visibility (statuses, outstanding, Bexio reference, failure re-run) inside the existing admin area — no accounting features rebuilt

**Independent Test**: quickstart.md §9 — outstanding payments identifiable at a glance; failed operations re-runnable; Bexio link lands on the matching record; no ledger/VAT UI exists

### Implementation for User Story 6

- [ ] T044 [P] [US6] Create the read-only overview component in `src/components/billing/AdminFinancialOverview.jsx`: per-transaction list joining `bookings` + `billing_documents` (payment status, invoice status, total, outstanding indicator, `document_nr`), plus `PaymentSourceBadge` in `src/components/billing/PaymentSourceBadge.jsx` showing `payment_confirmation_source` when set (FR-033)
- [ ] T045 [US6] Embed the overview into the admin area (`src/pages/AdminIntegrationsPage.jsx` financial section) with the failed-operation re-run action invoking `billing-issue-invoice` (same idempotency key → safe retry) per US6 scenario 2
- [ ] T046 [P] [US6] Add "Open in Bexio" deep links per row in `src/components/billing/AdminFinancialOverview.jsx` (Bexio web app record URL built from `external_id`; confirm the exact URL format during implementation and document it in the component)
- [ ] T047 [US6] Verify quickstart.md §9.1–§9.4 on the test branch

**Checkpoint**: Daily "who owes money?" question answerable in AGC; everything beyond remains in Bexio by design

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature validation, documentation sync (constitution requirement), and production readiness

- [ ] T048 Run the complete quickstart.md validation (§1–§9) fresh on the test branch and record results in the PR description
- [ ] T049 [P] Update `specs/project-context/api-contracts.md` with the four new Edge Function contracts and `specs/baseline-system/supabase-backend.md` with the new tables/functions/extensions (documentation-sync rule)
- [ ] T050 [P] Update `specs/project-context/domain-model.md` with the five `billing_*` entities and the `bookings` column additions
- [ ] T051 Security pass per spec §Security + FR-034: grep built bundles and function logs for token material, re-verify RLS with T005 tests, confirm `billing_public_config` leaks nothing beyond the boolean, confirm scheduler endpoint rejects missing/invalid secret
- [ ] T052 Rate-limit behavior check: batch-run reconciliation against the demo account while logging 429/backoff behavior of `bexio-client` (research R-10)
- [ ] T053 Production rollout per quickstart.md §0: register production redirect URL in the Bexio app, set production secrets, apply both migrations to production, verify the `pg_cron` job, connect via OAuth, complete configuration discovery, confirm QR payment part on a real issued invoice, then enable the cutover flag

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (T002/T003 are manual external steps, parallel with T001)
- **Foundational (Phase 2)**: Depends on T001; **BLOCKS all user stories**. T008 depends on T006+T007; T010 depends on T004
- **User Stories (Phases 3–8)**: All depend on Foundational completion. Within-story: tests first (where present), then models/mappers → services/adapter → functions → frontend → deploy-verify
- **Polish (Phase 9)**: Depends on all completed stories

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories — delivers the authenticated connection everything else uses
- **US2 (P1)**: Depends on US1 (needs working tokens + discovered config)
- **US3 (P1)**: Depends on US2 (documents must exist to be fetched)
- **US4 (P2)**: Depends on US2 (reconciles documents US2 creates); extends US1's status surfaces
- **US5 (P2)**: Depends on US2 (cancels documents US2 creates); orthogonal to US4
- **US6 (P3)**: Depends on US2 + US4 (aggregates synchronized data)

*Strictly sequential P1 chain (US1 → US2 → US3) recommended; P2 stories can overlap once US2 lands.*

### Parallel Opportunities

- Setup: T002 ∥ T003 (external registrations)
- Foundational: T005 ∥ T006 ∥ T007 after T004; T009 after T008
- US1: T011 (tests) ∥ T015/T016 (frontend) after T012 lands
- US2: T018 ∥ T019 (tests) ∥ then T020 → T021 → T022 → T023 chain; T024 frontend parallel to T023
- US4: T030 ∥ T031 (tests); T036/T037 frontend/legacy-function edits in parallel once T033 lands
- US6: T044 ∥ T046
- Polish: T049 ∥ T050

---

## Parallel Example: User Story 2

```bash
# Launch US2 test tasks together (write first, watch them fail):
Task: "Write Deno unit tests in supabase/functions/_shared/billing/bexio/bexio-mappers.test.ts"
Task: "Write Deno unit tests in supabase/functions/_shared/billing/financial-service.test.ts"

# Then implementation chain (sequential — same module lineage):
Task: "Implement mappers" → "adapter ops" → "financial-service" → "HTTP function"

# Frontend branch runs in parallel with the HTTP function:
Task: "Branch the invoice request in src/lib/bookings.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational)
2. Complete Phase 3 (US1) → **STOP and VALIDATE** via quickstart.md §1
3. Result: a live, healthy, observable Bexio connection — demoable, zero risk to existing behavior (flag off)

### Incremental Delivery

1. Setup + Foundational → foundation ready (inert until connected)
2. + US1 → connection alive → deploy (flag still off)
3. + US2 → invoicing → validate §2 → enable flag on test branch
4. + US3 → document self-service → validate §3
5. + US4 → reconciliation closes the payment loop → validate §4–§5
6. + US5, US6 → operational completeness → validate §8–§9
7. Polish → production rollout (T053)

Each increment is behind the `billing_public_config` flag or additive-only UI, so shipping any subset never breaks the running system.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [USx] label maps each task to spec.md user stories for traceability; FR references inline
- The adapter file `bexio-adapter.ts` and `AdminIntegrationsPage.jsx` are intentionally extended by multiple stories — work stories sequentially to avoid conflicts
- Tests are written before implementation within each story (plan.md testing strategy)
- Existing Edge Functions are never modified except the minimal, contract-preserving guard in T037
- Rollback at any point: disable the integration flag — legacy invoice/proof behavior is fully preserved
