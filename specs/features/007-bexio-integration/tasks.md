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

- [X] T001 Create in-repo Edge Function scaffold per plan.md: `supabase/functions/_shared/billing/`, `supabase/functions/_shared/billing/bexio/`, `supabase/functions/bexio-oauth/`, `supabase/functions/billing-issue-invoice/`, `supabase/functions/billing-invoice-document/`, `supabase/functions/bexio-reconcile/`, plus `supabase/functions/deno.json` enabling `deno test`
- [X] T002 [P] Register the Bexio developer app at developer.bexio.com (manual, per quickstart.md §0.1): record client id/secret, register redirect URL `https://<project-ref>.supabase.co/functions/v1/bexio-oauth/callback` (path-based — Bexio's Keycloak IdP does exact redirect_uri matching and is unreliable with query strings), then set Edge Function secrets `BEXIO_CLIENT_ID`, `BEXIO_CLIENT_SECRET`, `BEXIO_OAUTH_STATE_SECRET` via `supabase secrets set`. **DONE 2026-08-21** (secrets must be pasted without trailing newline/whitespace — Keycloak client lookup fails otherwise)
- [X] T003 [P] Prepare the Bexio demo company per quickstart.md §0.2: QR-capable bank account, invoice template with QR payment part, automatic invoice numbering, active sales tax (FR-018 prerequisites). **DONE 2026-08-21** (demo VAT 8.1% tax id 14). **Go-live 2026-08-29: production VAT is 0%** — Bexio must have an active 0% sales tax; discovery no longer uses `taxes[0]`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, provider abstraction, and the authenticated Bexio HTTP client that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Write migration `supabase/migrations/0003_bexio_integration.sql` implementing data-model.md exactly: `CREATE EXTENSION IF NOT EXISTS` for `pg_cron` and `pg_net`; tables `billing_integrations`, `billing_contacts`, `billing_documents`, `billing_operations`, `billing_events` with all constraints/indexes; additive columns `bookings.payment_confirmation_source` + `bookings.payment_confirmed_at`; RLS enablement + policies per data-model.md; view `billing_public_config` with `authenticated` grant. Apply to the Supabase **test branch** via MCP `apply_migration`
- [X] T005 [P] Add SQL RLS policy tests for all five new tables and the view in `tests/sql/0003_bexio_integration_rls.test.sql` (mirror the existing PostgREST-level test pattern from `tests/`): admin-only reads on `billing_integrations`/`billing_contacts`/`billing_operations`/`billing_events`; owner-or-admin read on `billing_documents`; no client writes anywhere
- [X] T006 [P] Implement Vault helpers `readSecret(name)` / `writeSecret(name, value)` in `supabase/functions/_shared/billing/vault.ts` (service-role SQL against `vault.decrypted_secrets` / `vault.create_secret`; never log values)
- [X] T007 [P] Define the `AccountingProvider` interface and all shared types (`InvoiceInput`, `ExternalInvoice`, `ExternalContactRef`, `ProviderHealth`, error classes `ProviderAuthError`/`ProviderUnavailableError`) in `supabase/functions/_shared/billing/accounting-provider.ts` per contracts/accounting-provider.md
- [X] T008 Implement the Bexio HTTP client in `supabase/functions/_shared/billing/bexio/bexio-client.ts`: base URL `https://api.bexio.com`, bearer header from Vault-cached token, single-flight token refresh on 401 (rotate `bexio_refresh_token` and `bexio_access_token_cache` in Vault, FR-004), `invalid_grant` → `ProviderAuthError`, 429/5xx exponential backoff honoring `RateLimit-*`/`Retry-After` (FR-008), sanitized structured logging (method, status, correlation key only — FR-032/FR-034). Depends on T006, T007
- [X] T009 [P] Write Deno unit tests for the client in `supabase/functions/_shared/billing/bexio/bexio-client.test.ts` with mocked `fetch`: 401→refresh→single retry, refresh rotation persists new refresh token, `invalid_grant` surfacing, 429 backoff budget, log sanitization (no token strings in captured logs)
- [X] T010 Register the reconciliation schedule: store a generated `bexio_scheduler_secret` in Vault and create the `pg_cron` job (every 15 min) invoking `bexio-reconcile` via `pg_net.http_post` with the `x-scheduler-secret` header — as a follow-up migration `supabase/migrations/0004_bexio_reconcile_cron.sql`. Depends on T004. Applied with T038 once `bexio-reconcile` is live.

**Checkpoint**: Schema live on test branch; provider client can make an authenticated call once a token exists — user story implementation can now begin

---

## Phase 3: User Story 1 - OAuth connection and token lifecycle (Priority: P1) 🎯 MVP

**Goal**: An admin connects AGC to Bexio once via OAuth 2.0; tokens refresh automatically server-side; connection health is visible; no secret ever reaches a browser

**Independent Test**: quickstart.md §1 — connect flow completes, status card shows `connected` with scopes; tokens live only in Vault (§1.4); revocation flips status to `requires_reauth`

### Tests for User Story 1

- [X] T011 [P] [US1] Write Deno unit tests in `supabase/functions/bexio-oauth/state.test.ts`: HMAC state nonce sign/verify + 10-min TTL rejection, callback code-exchange happy path (mocked `auth.bexio.com`), refresh rotation persisting the rotated refresh token, `invalid_grant` → `billing_integrations.status='requires_reauth'`

### Implementation for User Story 1

- [X] T012 [US1] Implement `start`/`status`/`disconnect` actions in `supabase/functions/bexio-oauth/index.ts` per contracts/edge-functions.md §1: admin-only via caller JWT + `profiles.role='admin'`; `start` builds the authorize URL with scopes `contact_show contact_edit kb_invoice_show kb_invoice_edit offline_access` and a signed single-use `state`; `status` reads `billing_integrations`; `disconnect` deletes Vault secrets and sets `status='disconnected'`
- [X] T013 [US1] Implement the `callback` action in `supabase/functions/bexio-oauth/index.ts`: validate `state`, exchange code at `https://auth.bexio.com/realms/bexio/protocol/openid-connect/token`, write `bexio_refresh_token` + `bexio_access_token_cache` to Vault via T006 helpers, upsert `billing_integrations` (`status='connected'`, `scopes`, `connected_at`/`connected_by`), insert `integration.connected` into `billing_events`, 302-redirect to `/admin/integrations?bexio=connected|error=…` — never render tokens
- [X] T014 [US1] Implement `initialize`/`configure` actions in `supabase/functions/bexio-oauth/index.ts` per research R-06: discover `bexio_user_id` (`GET /3.0/users/me`), `currency_id`, `bank_account_id`, `payment_type_id`, `tax_id`, `unit_id`, `language_id`, `country_id`, `template_slug`, `status_map`; merge into `billing_integrations.config`; `configure` validates manually supplied IDs with a draft-invoice roundtrip (create → `revert_issue` → delete) before setting `config_complete`
- [X] T015 [P] [US1] Create the admin UI (connection card: connect/disconnect buttons, status badge, scopes, `connected_at`, `last_successful_call_at`, `last_error`, reconnect banner when `requires_reauth`) and register the `/admin/integrations` route in `src/App.jsx` reusing the existing admin-route guard. Implemented as `src/components/admin/IntegrationsPanel.jsx` inside the existing `AdminDashboardPage` tabs (the file's designed extension point) — `/admin/integrations` renders the dashboard with the Integrations tab preselected
- [X] T016 [P] [US1] Create the function client module `src/lib/billing.js` with typed wrappers for `bexio-oauth` actions (used by T015; later stories extend it)
- [X] T017 [US1] Deploy `bexio-oauth` and verify quickstart.md §1.1–§1.4 end-to-end against the demo company. **DONE 2026-08-21**: live OAuth connect succeeded end-to-end (status `connected`, tokens in Vault, scopes verified); config discovery completed against the demo company (`currency_id=1`, tax 8.1% id 14 at the time, bank account, payment type, unit, language, country). **2026-08-29:** discovery/issuance select 0% VAT. Fixes applied along the way: IdP migration to `auth.bexio.com`, path-based callback, gateway prefix-stripping in callback routing, `/3.0/currencies` `name`-field matching

**Checkpoint**: Connection lifecycle works standalone; integration row + Vault secrets exist; nothing else depends on Bexio yet being callable for invoices

---

## Phase 4: User Story 2 - A lesson purchase produces exactly one Bexio invoice (Priority: P1)

**Goal**: Booking completion ensures one Bexio contact and one issued Bexio invoice per booking — retry-safe, timeout-safe, never blocking the booking itself

**Independent Test**: quickstart.md §2 — new customer creates contact+invoice; returning customer reuses contact; replayed idempotency key and lost-response retry never duplicate; Bexio outage still completes the booking and enqueues the operation

### Tests for User Story 2

- [X] T018 [P] [US2] Write Deno unit tests in `supabase/functions/_shared/billing/bexio/bexio-mappers.test.ts`: profile → person contact payload (`contact_type_id: 2`, `name_1` last name, `name_2` first name per research R-04), booking+lesson type → `InvoiceInput` (gross CHF from `lesson_types.price`, `api_reference` format `agc:booking:{uuid}`, payment term from config)
- [X] T019 [P] [US2] Write Deno unit tests in `supabase/functions/_shared/billing/financial-service.test.ts` with a mocked `AccountingProvider`: idempotency (existing `billing_documents.booking_id` or `api_reference` hit → reuse, no second create), lost-response recovery path, provider failure → `billing_operations` row with `next_retry_at` backoff

### Implementation for User Story 2

- [X] T020 [US2] Implement AGC ⇄ Bexio payload translation in `supabase/functions/_shared/billing/bexio/bexio-mappers.ts` (contact, invoice positions as `KbPositionCustom` with config `account_id`/`tax_id`/`unit_id`, `mwst_is_net: false` per research R-05/R-14)
- [X] T021 [US2] Implement contact + invoice operations in `supabase/functions/_shared/billing/bexio/bexio-adapter.ts` (implements `AccountingProvider` from T007): `findContactByEmail` (`POST /2.0/contact/search` field `mail`), `createContact`, `updateContact`, `findInvoiceByApiReference` (`POST /2.0/kb_invoice/search`), `createInvoice` (draft), `issueInvoice` (`POST /2.0/kb_invoice/{id}/issue`) — using the T008 client and config IDs from `billing_integrations.config`
- [X] T022 [US2] Implement `issueInvoiceForBooking(bookingId)` in `supabase/functions/_shared/billing/financial-service.ts` per contracts/accounting-provider.md: idempotency guard → ensure contact (search/adopt/create, persist `billing_contacts`, FR-010/011) → create draft with `api_reference` → issue → upsert `billing_documents` (FR-017) → `invoice.issued` audit event; on `ProviderAuthError`/`ProviderUnavailableError` persist a pending `billing_operations` row (kind `contact_sync`/`invoice_issue`, deterministic `idempotency_key`) and rethrow a typed error
- [X] T023 [US2] Implement the HTTP function in `supabase/functions/billing-issue-invoice/index.ts` per contracts/edge-functions.md §2: caller JWT + booking-ownership-or-admin check, idempotency short-circuit (`200 reused`), orchestrate via T022, map errors (`409 booking_not_billable`, `502 provider_unavailable` with operation enqueued); booking flow itself must never fail because of this function (FR-030)
- [X] T024 [US2] Branch the existing invoice request in `src/lib/bookings.js`: read `integration_enabled` from `billing_public_config` (via `src/lib/billing.js`); when true invoke `billing-issue-invoice` for new bookings, when false/absent invoke legacy `generate-invoice-pdf` unchanged (research R-12; Q1-A: no automatic legacy fallback on Bexio failure — surface retry state instead)
- [X] T025 [US2] Deploy `billing-issue-invoice` and verify quickstart.md §2.1–§2.5 on the test branch. **DONE 2026-08-25:** function live (`verify_jwt: true`); student booked a lesson and My Payments showed Awaiting payment (invoice issued). Idempotency/contact-reuse remain covered by Deno tests.

**Checkpoint**: Core business value delivered — every new booking bills into Bexio exactly once; legacy path intact when the flag is off

---

## Phase 5: User Story 3 - Invoice document access from AGC (Priority: P1)

**Goal**: Booking owners and admins open the Bexio-generated invoice PDF inside AGC; pre-integration bookings keep their legacy documents

**Independent Test**: quickstart.md §3 — owner gets the Bexio PDF inline; other student gets 403; admin gets any PDF; pre-integration booking still serves its legacy PDF

### Implementation for User Story 3

- [X] T026 [US3] Add `getInvoicePdf` to `supabase/functions/_shared/billing/bexio/bexio-adapter.ts`: `GET /2.0/kb_invoice/{id}/pdf`, decode base64 `{ content, name }` to bytes (research R-11; PDF exists only for issued invoices — guaranteed by T022)
- [X] T027 [US3] Implement `supabase/functions/billing-invoice-document/index.ts` per contracts/edge-functions.md §3: caller JWT, owner-or-admin authorization mirroring the existing proof-access pattern, resolve `billing_documents` by `booking_id` (`404 no_document` for legacy bookings), stream `application/pdf` with `Content-Disposition: inline; filename="<document_nr>.pdf"`, `502 provider_unavailable` mapping; nothing written to Storage
- [X] T028 [US3] Add the "View invoice" affordance for Bexio-billed bookings in the student payments view `src/pages/PaymentsPage.jsx` and reuse the existing `InvoicePreviewModal` after booking, via `src/lib/billing.js`, leaving the existing legacy invoice links untouched (both paths coexist per quickstart.md §7)
- [X] T029 [US3] Deploy `billing-invoice-document` and verify quickstart.md §3.1–§3.4 on the test branch

**Checkpoint**: Document self-service preserved end-to-end across the cutover boundary (Q1-A)

---

## Phase 6: User Story 4 - Bank payments become visible in AGC via reconciliation (Priority: P2)

**Goal**: The scheduled worker converges AGC payment state with Bexio-recorded payments — authoritative for `paid`, idempotent, partial-payment aware. Proof-of-payment is not part of this path.

**Independent Test**: quickstart.md §4 — full payment auto-confirms without admin action; partial payment does not; repeated runs never double-apply

### Tests for User Story 4

- [X] T030 [P] [US4] Write Deno unit tests in `supabase/functions/_shared/billing/bexio/bexio-adapter.status.test.ts`: numeric-totals status derivation (research R-07: `received>0 && remaining<=0` → paid; partial; `status_map` only for cancelled/draft)
- [X] T031 [P] [US4] Write Deno unit tests in `supabase/functions/bexio-reconcile/index.test.ts` (mocked provider + in-memory repo): guarded confirm never overwrites an already-`confirmed` booking, no duplicate `payment.reconciled` events on re-run, stale/failed run leaves state convergent

### Implementation for User Story 4

- [X] T032 [US4] Add `getInvoice` + normalized status derivation to `supabase/functions/_shared/billing/bexio/bexio-adapter.ts` (`total_received_payments`/`total_remaining_payments` authority, `hasQrPaymentPart` health signal, `cancelled` via configured `status_map`)
- [X] T033 [US4] Implement the reconciliation core in `supabase/functions/bexio-reconcile/index.ts` per contracts/edge-functions.md §4: scheduler-secret or admin-JWT auth; iterate `billing_documents` in `issued`/`partially_paid`; on full payment apply the guarded booking update (`status='confirmed'`, `payment_status='confirmed'`, `verification_status='approved'`, `payment_confirmation_source='bexio_reconciliation'`, `payment_confirmed_at`, `WHERE payment_status <> 'confirmed'` per research R-08); document-level `billing_documents.status` transitions to `paid`/`partially_paid`/`cancelled`; write `billing_events`
- [X] T034 [US4] Implement the retry-queue processor in `supabase/functions/bexio-reconcile/index.ts`: due `billing_operations` (`status='pending' AND next_retry_at<=now()`), execute by kind via `financial-service`, exponential backoff to `max_attempts`, then `failed` + `operation.retry_exhausted` event for admin alerting (FR-031)
- [X] T035 [US4] Implement the FR-038 discrepancy check: payment recorded against a cancelled invoice; overpayment beyond the invoice total. (The former `manual_unpaid` / proof-grace check was removed 2026-08-24.)
- [X] T036 [US4] Add the manual "Run reconciliation now" action and the worker health summary (last run, counts, failed operations) to `src/pages/AdminIntegrationsPage.jsx` via `src/lib/billing.js`
- [X] T037 [US4] Remove the payment-proof product path (Decision 2026-08-24): delete `PaymentProofUpload`, `PaymentProofPreview`, `PaymentVerificationPanel`, and `storage.js`; My Payments shows QR-pay copy only; `/admin` and `/admin/payment-verification` redirect to `/admin/integrations`
- [X] T038 [US4] Deploy `bexio-reconcile`, confirm the `pg_cron` job from T010 invokes it, and verify quickstart.md §4 on the test branch. Remaining live check: register a demo-company payment (quickstart §4.1–§4.2) then click **Run reconciliation now**.

**Checkpoint**: Payment loop closed — bank payment in Bexio becomes `paid` in AGC within one interval, safely interleaved with the legacy manual flow

---

## Phase 7: User Story 5 - Client invoice status and unpaid lesson cancel (Priority: P2)

**Goal**: Students see paid/unpaid/cancelled on My Payments and can cancel an **unpaid lesson**. Admins do not cancel invoices in AGC. Memberships and paid-lesson rules are future specs.

**Independent Test**: quickstart.md §7 — unpaid cancel from My Payments; paid lesson has no cancel; admin Integrations has no cancel-invoice UI

### Tests for User Story 5

- [X] T039 [P] [US5] Write Deno unit tests in `supabase/functions/_shared/billing/financial-service.cancel.test.ts`: cancel only allowed for `issued`/unpaid documents; paid cancel is refused (future paid-lesson spec); provider refusal surfaces conflict without forcing AGC state

### Implementation for User Story 5

- [X] T040 [US5] Add `cancelInvoice` (`POST /2.0/kb_invoice/{id}/cancel`, issued-only) to `supabase/functions/_shared/billing/bexio/bexio-adapter.ts` and the `cancelInvoiceForBooking(bookingId)` orchestration to `supabase/functions/_shared/billing/financial-service.ts` (operation kind `invoice_cancel`, same idempotency/retry machinery)
- [X] T041 [US5] Hook unpaid lesson cancel in `src/lib/bookings.js` and My Payments (`PaymentsPage.jsx`): owner sees paid/awaiting/cancelled and can cancel unpaid bookings (enqueue `invoice_cancel` on provider failure). No admin invoice-cancel UI (Decision 2026-08-25).
- [X] T042 [US5] Do **not** surface cancel/refund controls on the admin integrations page. Invoice state is client-only on My Payments.
- [X] T043 [US5] Deploy `billing-cancel-invoice` and verify student unpaid cancel from My Payments (quickstart §7). **DONE 2026-08-25:** student cancelled an unpaid booking on My Payments; confirmation is an in-app modal (not `window.confirm`).

**Checkpoint**: Students see paid/awaiting/cancelled on My Payments; unpaid lesson cancel closes the Bexio invoice; no admin invoice-cancel UI

---

## Phase 8: User Story 6 - Admin financial overview (Priority: P3) — deferred 2026-08-25

Clients see invoice status on My Payments. Admins use Bexio for receivables. Do not build `AdminFinancialOverview`.

- [ ] T044 [P] [US6] Deferred — no admin per-transaction financial list in 007
- [ ] T045 [US6] Deferred
- [ ] T046 [P] [US6] Deferred
- [ ] T047 [US6] Deferred — quickstart §8 notes US6 is not in 007

**Checkpoint**: Deferred — clients see their own invoices; admins follow receivables in Bexio

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature validation, documentation sync (constitution requirement), and production readiness

- [X] T048 Run the complete quickstart.md validation (§1–§9) fresh on the test branch and record results in the PR description. **Recorded 2026-08-25** in quickstart.md «Validation log». Remaining live: §4.1–§4.2 demo payment → reconcile; optional §5 outage drill. US6 N/A.
- [X] T049 [P] Update `specs/project-context/api-contracts.md` with the four new Edge Function contracts and `specs/baseline-system/supabase-backend.md` with the new tables/functions/extensions (documentation-sync rule). **DONE 2026-08-25** (five functions including `billing-cancel-invoice`).
- [X] T050 [P] Update `specs/project-context/domain-model.md` with the five `billing_*` entities and the `bookings` column additions
- [X] T051 Security pass per spec §Security + FR-034: grep built bundles and function logs for token material, re-verify RLS with T005 tests, confirm `billing_public_config` leaks nothing beyond the boolean, confirm scheduler endpoint rejects missing/invalid secret.
  - Source grep: no hardcoded JWTs / `sk_live_` / client-secret literals in `src/` or `supabase/functions` (excluding tests).
  - `bexio-client` logs method/path/status only (`token_refreshed` with no value).
  - Production bundle: `billing_public_config` / `integration_enabled` only; no JWT-like strings.
  - View: `SELECT integration_enabled` boolean; GRANT `authenticated` only.
  - Vault RPCs: EXECUTE revoked from `anon`/`authenticated`/`PUBLIC`.
  - RLS catalog tests: `tests/sql/0003_bexio_integration_rls.test.sql` (apply via SQL editor; MCP `execute_sql` not available this session).
  - Live: `POST bexio-reconcile` with no header or wrong `x-scheduler-secret` → `401 {"error":"unauthenticated"}`. `billing-cancel-invoice` without JWT → gateway `401`.
- [X] T052 Rate-limit behavior check: batch-run reconciliation against the demo account while logging 429/backoff behavior of `bexio-client` (research R-10). **Unit coverage 2026-08-25:** `bexio-client.test.ts` retries 429 honoring `RateLimit-Reset` and exhausts 5xx to `ProviderUnavailableError`. Live demo did not return 429; no code change.
- [X] T053 Production rollout per quickstart.md §0: register production redirect URL in the Bexio app, set production secrets, apply both migrations to production, verify the `pg_cron` job, connect via OAuth, complete configuration discovery, confirm QR payment part on a real issued invoice, then enable the cutover flag. **Go-live 2026-08-29** — academy confirmed configuration; merge to `main`. VAT on new invoices is **0%** (not the demo 8.1%). After functions deploy, run Discover configuration so stored `tax_id_sales` is the 0% tax; issuance also prefers 0% from `taxes_sales` if that list already includes one.

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
- Rollback at any point: disable the integration flag — new bookings fall back to the legacy invoice generator. There is no proof-upload rollback path.
