# Research: Bexio Financial & Accounting Integration

**Feature**: `specs/features/007-bexio-integration/spec.md`
**Date**: 2026-08-20
**Purpose**: Resolve all `NEEDS CLARIFICATION` items and record technology/pattern decisions that the plan and data model depend on.

Sources: fetched official Bexio API documentation (docs.bexio.com, captured during `/speckit-specify`), Bexio knowledge-base article "Public API scopes", third-party ecosystem confirmations (n8n, Maesn), and the AGC brownfield baseline specs (`specs/baseline-system/`, `specs/project-context/`).

---

## R-01. Bexio authentication flow and token handling

- **Decision**: OAuth 2.0 Authorization Code flow with PKCE-capable public-client registration; access token + refresh token obtained server-side in an Edge Function callback; tokens stored in Supabase Vault; refresh executed by a shared helper inside every Bexio-calling Edge Function.
- **Rationale**: The Bexio API is user-centric and every request is executed "as" a Bexio user, but the authorization is granted per company. An admin-driven connect flow inside AGC's admin area matches that model and keeps client id/secret server-side only (FR-001/FR-003). Access tokens expire after 1 hour; refresh tokens are valid 365 days and rotate on each refresh, so static Edge Function secrets cannot hold them — persistent, updatable secret storage is required.
- **Alternatives considered**:
  - *Storing tokens in Edge Function environment secrets* — rejected: refresh tokens rotate and would require redeployment on every rotation; violates FR-007.
  - *Storing tokens as plaintext columns in a config table* — rejected: violates FR-001 (credentials must not be retrievable via API responses or appear in plaintext).
  - *Implicit/JWT bearer flow* — rejected: Bexio documents the JWT bearer flow only as a niche enterprise option; Authorization Code is the supported standard.
- **Verified details**: `https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth` (authorize), `https://auth.bexio.com/realms/bexio/protocol/openid-connect/token` (token exchange/refresh), `https://auth.bexio.com/realms/bexio/protocol/openid-connect/logout` (logout), `https://auth.bexio.com/realms/bexio/.well-known/openid-configuration` (discovery). **Update 2026-08-21**: the original research targeted `idp.bexio.com`, which was decommissioned on 2025-03-31; the implementation uses the new IdP (Keycloak realm `auth.bexio.com/realms/bexio`), verified against its live OIDC discovery document. App registration (client id/secret, up to 10 redirect URLs) is a one-time manual step at developer.bexio.com. New-IdP notes: offline sessions idle-timeout after 1 year (refresh tokens must be used within a year — our scheduled reconciliation guarantees this); token endpoint parameters must be sent in the request body (our implementation already does).

## R-02. Where to store tokens and connection configuration

- **Decision**: Two-part storage:
  1. `billing_integrations` table (singleton row) — non-secret metadata: provider, status, discovered Bexio IDs (see R-06), connected_at/connected_by, health fields, and the **names** of the Vault secrets holding the tokens.
  2. Supabase Vault (`supabase_vault` extension, already installed per `specs/baseline-system/supabase-backend.md` §2) — two secrets: `bexio_refresh_token`, `bexio_access_token_cache` (JSON with access token + expiry).
- **Rationale**: Vault is purpose-built for secrets, already enabled in this project, and readable/writable from Edge Functions via service-role SQL without exposing values through PostgREST. The metadata table carries everything needed for the admin status UI (FR-006) and first-run configuration discovery.
- **Alternatives considered**:
  - *Encrypted columns via pgsodium directly* — Vault is the supported wrapper for exactly this; no added value in hand-rolling.
  - *A separate secrets service (Doppler, AWS SM)* — rejected: new external dependency without justification (constitution: fixed stack).

## R-03. Bexio API scopes

- **Decision**: Request exactly `contact_show contact_edit kb_invoice_show kb_invoice_edit offline_access`.
- **Rationale**: Least privilege (FR-002). Contact sync needs read+write on contacts; invoice creation/issue/status/PDF/payments needs read+write on invoices; `offline_access` is required to receive a refresh token. No accounting-journal, banking-write, or OpenID scopes are needed for V1 (invoice status and payment totals are readable with `kb_invoice_show`; `/3.0` banking/taxes endpoints used during setup are covered by the granted invoice scopes in practice, with fallback to manual ID entry if any discovery call is rejected — see R-06).
- **Alternatives considered**: `profile`/`email` scopes — rejected, not needed; the admin's identity in Bexio is irrelevant to AGC. `banking` scope — rejected for V1; reconciliation state is read from invoice totals/status, not raw bank transactions.

## R-04. Contact synchronization strategy

- **Decision**: Per-student (person) contacts. On first billable transaction for a user: search Bexio contacts by email (`POST /2.0/contact/search`, field `mail`); if exactly one match → adopt it; if zero → create (`contact_type_id = 2` person, `name_1` = last name, `name_2` = first name, `mail`, `phone_mobile`, `street_name`/`postcode`/`city`, `country_id` resolved from the profile ISO country code via `GET /2.0/country` `iso3166_alpha2`, plus required `user_id`/`owner_id`); if multiple → do not guess, create a new contact and log an observability warning for manual merge in Bexio. Persist the Bexio `contact_id` in `billing_contacts`. Subsequent transactions reuse the stored ID and **update** the mapped contact from the current profile (FR-011). Country is never forced to Switzerland.
- **Rationale**: Verified that `mail` is a supported contact search field and `contact_type_id` semantics (1 = company, 2 = person; `name_1` doubles as last name for persons) from the official schema. Email-first matching is the only reliable heuristic available; persisting the mapping (FR-011) makes the heuristic a one-time risk.
- **Alternatives considered**:
  - *Company-type contacts per membership* — rejected: AGC bills individuals; company billing is out of scope (spec Scope/V1).
  - *Bulk pre-migration of all 59 users* — rejected for V1; lazy creation keeps the blast radius small and avoids creating Bexio contacts for users who never transact (US2 covers on-demand creation).
  - *Name+birthday matching* — rejected: no reliable composite search support; false-positive risk exceeds benefit.

## R-05. Invoice creation payload and idempotency

- **Decision**: Create invoices as drafts (`POST /2.0/kb_invoice`, `mwst_type` from config, `mwst_is_net = false`, positions of `type: "KbPositionCustom"` with `amount`, `unit_id`, `account_id`, `tax_id`, `unit_price`, `text`), then issue immediately (`POST /2.0/kb_invoice/{id}/issue`, requires draft status) so the invoice becomes payable/reconcilable and the PDF becomes available. Set `api_reference = "agc:booking:{bookingId}"` and include the human-readable AGC reference in `header`/`title` (FR-016).
- **Idempotency** (FR-015): before creation, (1) check the local `billing_documents` unique constraint on `booking_id`, and (2) search Bexio invoices by `api_reference` (verified supported search field). If either yields a result, adopt it instead of creating. Wrap the whole operation in a `billing_operations` row with a deterministic idempotency key (`booking:{id}:invoice:v1`).
- **Rationale**: Two-layer idempotency protects against both AGC-side retries and the "response lost after Bexio persisted" failure mode (spec Edge Cases / FR-030). `api_reference` is documented as API-only-writable, making it a trustworthy correlation key.
- **Alternatives considered**:
  - *Create-as-issued in one call* — rejected: the documented workflow creates drafts; issuing is a separate explicit action. Two-step is the supported path.
  - *Using Bexio `document_nr` as the correlation key* — rejected: numbering is Bexio-controlled (automatic numbering); AGC's own atomic `next_invoice_number` sequence remains AGC's internal reference for display/legacy coexistence, never sent to Bexio.

## R-06. First-run configuration discovery (Bexio-internal IDs)

- **Decision**: Invoice creation requires Bexio-internal IDs: `user_id`, `currency_id`, `bank_account_id`, `payment_type_id`, per-position `account_id`, `tax_id`, `unit_id`, plus `language_id`, `country_id`, and optional `template_slug`. These are resolved once during a guided "Verify connection / initialize" step and persisted in `billing_integrations.config` (JSONB). Discovery order: (a) `GET /3.0/users/me` → user; (b) list endpoints for currencies (CHF), banking accounts (QR-capable), payment types, active sales taxes (`/3.0/taxes?types=sales_tax&scope=active`) **selecting the tax with `value === 0`**, units, languages, countries (Switzerland), document templates; (c) any ID that cannot be discovered with the granted scopes is entered manually by the admin in the integration settings UI, then validated by a test call. Field-shape gotcha verified against live API (2026-08-21): `/3.0/currencies` exposes the ISO 4217 code in the `name` field — there is no `code` field — so CHF matching must use `name === 'CHF'`.
- **Rationale**: The create-invoice schema marks `user_id` required and positions require `account_id`/`tax_id`/`unit_id`; these IDs are account-specific integers that cannot be hardcoded. Persisting them avoids per-request discovery calls (rate-limit friendly, R-10).
- **Alternatives considered**: *Hardcoding IDs in environment variables* — rejected: opaque to admins, no validation path, rotation requires redeploy.

## R-07. Payment reconciliation without webhooks

- **Decision**: Scheduled polling worker. Bexio has **no native webhook system** (absent from official docs; confirmed by third-party integrators). A `bexio-reconcile` Edge Function runs on a schedule (R-09) and: for every `billing_documents` row in status `issued`/`partially_paid`, fetches the invoice (`GET /2.0/kb_invoice/{id}`) and evaluates payment state from the documented numeric fields `total`, `total_received_payments`, `total_remaining_payments` — with `kb_item_status_id` as a secondary signal only.
- **Status-mapping resolution (open question in spec)**: Do **not** hardcode `kb_item_status_id` values. Authority rule: `total_received_payments > 0 AND total_remaining_payments <= 0` ⇒ fully paid; `0 < total_received_payments < total` ⇒ partial. Status IDs, where needed for edge disambiguation (e.g., cancelled), are discovered at setup from the Bexio status list and stored in `billing_integrations.config.status_map`. This removes the undocumented-enum dependency entirely.
- **Rationale**: Numeric totals are documented response fields and cannot drift with localization or tenant-specific status customizations. Academy scale (tens of open invoices at most; 31 bookings total in the current DB) makes per-invoice polling trivially within rate limits.
- **Alternatives considered**:
  - *Watermark search (`updated_at >= last_run`)* — viable future optimization (search supports `updated_at`); rejected for V1 as premature: targeted fetches of known-open documents are simpler and self-healing after missed windows.
  - *Reading bank transactions via `/3.0/banking`* — rejected: requires broader scopes and duplicates reconciliation Bexio already performs internally (FR-021/FR-024).
  - *Third-party webhook bridges (n8n/Maesn)* — rejected: new external dependency, added latency and failure modes.

## R-08. Payment confirmation authority (Q2-A implementation mechanics)

- **Decision**: Reconciliation writes are performed exclusively by the `bexio-reconcile` function (service role) with a guarded booking update: `UPDATE bookings SET status = 'confirmed', payment_status = 'confirmed', verification_status = 'approved', payment_confirmation_source = 'bexio_reconciliation', payment_confirmed_at = now() WHERE id = ? AND payment_status <> 'confirmed'`. (`bookings.payment_status` is `pending | confirmed | cancelled` — there is no `paid` value; document-level `paid` lives on `billing_documents.status`.) There is no AGC proof-upload or admin proof-verify path (Decision 2026-08-24).
- **Rationale**: Guarded updates prevent double-confirm; source attribution satisfies FR-033.
- **Alternatives considered**: *Keeping manual proof verification as break-glass* — rejected 2026-08-24: payments are confirmed only through Bexio.

## R-09. Scheduling mechanism for the polling worker

- **Decision**: Enable `pg_cron` + `pg_net` (both available, not yet installed, per baseline §2) and register a cron job (every 15 minutes) that invokes the `bexio-reconcile` Edge Function via `pg_net.http_post` with a scheduler shared-secret header. The job definition ships in the feature's SQL migration.
- **Rationale**: This is the Supabase-documented pattern for scheduled Edge Functions, keeps all backend behavior inside the fixed stack (constitution: no custom Node server), and the 15-minute cadence meets SC-003 (< 30 min worst case) with 3× headroom while staying far below Bexio rate limits.
- **Alternatives considered**:
  - *Vercel Cron hitting the function URL* — viable without new extensions, but adds a public unauthenticated-by-default surface and couples backend behavior to the hosting layer; rejected in favor of the in-stack pattern.
  - *Admin-triggered manual polling only* — rejected: fails SC-002 (automatic confirmation without admin action).

## R-10. Rate-limit handling

- **Decision**: One shared `bexioFetch` helper inside the Edge Function code: automatic 401 → single token refresh → single retry; 429 → exponential backoff honoring `RateLimit-*` headers (`RateLimit-Remaining`, `RateLimit-Reset`) and `Retry-After` when present; 5xx/network → bounded retry with jitter, then enqueue into `billing_operations` for the worker. All failures logged sanitized (no tokens, no full payloads) per FR-032.
- **Rationale**: Bexio's exact per-minute limit is unpublished; designing around the documented 429 + headers contract (FR-008) is the only robust approach. Academy request volume (a few invoice creations/day + ~4 polls/hour × tens of invoices) is orders of magnitude below any plausible limit.

## R-11. Invoice PDF access pattern

- **Decision**: On-demand retrieval. `billing-invoice-document` Edge Function: validates caller (owner of the booking or admin, via existing JWT + profiles pattern), resolves the `billing_documents` row, calls `GET /2.0/kb_invoice/{id}/pdf` (JSON `{ name, size, mime, content }` — `content` is base64), decodes and streams bytes with `Content-Type: application/pdf` and `Content-Disposition: inline; filename="<document_nr>.pdf"`. No PDF bytes are persisted in AGC Storage.
- **Rationale**: Bexio is the document of record (Q1-A); storing copies adds storage-policy surface (known debt TD-016) and drift risk for zero UX benefit. The endpoint requires an issued invoice, which R-05 guarantees before any user sees a download affordance.
- **Alternatives considered**: *Mirroring PDFs into `invoices` bucket* — rejected (above). *Direct user-to-Bexio links* — impossible: no public customer-facing URLs exist.

## R-16. Invoice email delivery (revised 2026-08-24 night)

- **Decision**: After issuance, AGC fetches `GET /2.0/kb_invoice/{id}/pdf` and emails the PDF via Resend HTTP API (`RESEND_API_KEY`) from `no-reply@agcpadelacademy.com`. In-app preview is unchanged. Idempotent via `notifications_log` (`status=sent` + subject `Your AGC invoice {document_nr}`). Mail failure is audited and does not fail the booking (FR-030 / FR-029a). Invoice sends always use Resend (not SendGrid), matching the verified academy domain. Auth mail stays on Supabase Custom SMTP.
- **Rationale**: The domain is already verified in Resend, so From branding needs no mailbox or Bexio SPF. Bexio send-by-email requires confirming `no-reply@…`, which has no inbox.
- **Alternatives considered**: *Bexio `POST .../send`* — tried 2026-08-24 evening, abandoned the same night: no academy mailbox for sender confirmation, and Gmail cannot be the From address. *Plug Resend SMTP into Bexio* — not supported.

## R-12. Cutover and legacy coexistence (Q1-A implementation mechanics)

- **Decision**: `src/lib/bookings.js` continues to offer the "receipt by email" action, but the target function is chosen by a server-driven flag: a world-readable, RLS-safe view `billing_public_config` exposes only `{ integration_enabled: boolean }`. When enabled, new bookings invoke `billing-issue-invoice` (Bexio path); when disabled/absent, they invoke legacy `generate-invoice-pdf` unchanged. Legacy `invoices` rows keep serving via the existing `invoices` bucket and UI untouched. Failure in the Bexio path enqueues retry — there is **no automatic fallback** to the legacy generator for new bookings (Q1-A).
- **Rationale**: Instant cutover/rollback via one row, zero code deploys; preserves 002 behavior for historical records; avoids dual invoice documents for one booking.

## R-13. Edge Function code location and deployment

- **Decision**: New function sources live in-repo under `supabase/functions/<name>/index.ts` (Deno, TypeScript), deployed via the Supabase MCP `deploy_edge_function` tool or CLI. Existing functions remain where/how they are — this feature changes nothing about them.
- **Rationale**: The brownfield convention of out-of-repo function source makes SDD review and diffing impossible; introducing in-repo source for **new** code only is the minimal change that enables reviewable implementation (constitution: spec-driven, testable). Justified in Complexity Tracking.
- **Alternatives considered**: *Continue dashboard-edited functions* — rejected for new code (unreviewable). *Migrate existing functions in-repo now* — rejected: unrelated refactor, violates "avoid unnecessary refactoring".

## R-14. VAT / tax handling

- **Decision**: Positions carry `tax_id` of Bexio tax **code UEX** (production, 2026-08-29). Invoice-level `mwst_type` 0 and `mwst_is_net=false` (advertised lesson price is the invoice total). Discovery lists the **full tax catalog** (`/3.0/taxes?limit=2000`, not only `types=sales_tax`) and selects `code === 'UEX'`; issuance prefers UEX from that list, then a 0% rate, then the stored id. If UEX (and no 0% fallback) is missing, `tax_id_sales` is incomplete. Price amounts come exclusively from AGC's `lesson_types.price`.
- **Rationale**: Lesson invoices are sales documents. Bexio rejects purchase/import taxes (`pre_tax_*`, including VIM) on quote/order/invoice positions. UEX is the active sales-side 0% code on the production company (id 3, `not_taxable_turnover`, “Export/Exempt”). The sales-tax-only filter returns only UN81 8.1% / UR26 2.6%. Selecting by code (then 0%) rather than `taxes[0]` avoids the 8.1% trap; the numeric id is still discovered from Bexio, not hardcoded in application source.
- **Alternatives considered**: *Using taxes[0]* — rejected 2026-08-29: that was 8.1%. *Selecting only value === 0 among sales_tax* — rejected: production has no active 0% `sales_tax` (U00 id 8 is inactive). *VIM (id 9, `pre_tax_material`)* — rejected the same day: import/purchase code, not valid on sales invoices. *Hardcoding a tax id* — rejected: production ids differ from demo.

## R-15. Admin UI surface

- **Decision**: New route `AdminIntegrationsPage` (guarded exactly like `AdminPaymentVerificationPage`), containing: Bexio connection card (connect/disconnect via OAuth, status, scopes, connected_at), configuration discovery/verification UI (R-06), reconciliation health summary (open/failed operations from `billing_operations`, last successful poll), and manual "run reconciliation now" trigger. Payment-state displays across admin/student pages gain a small "source" badge when `payment_confirmation_source` is set.
- **Rationale**: Minimal new surface consistent with existing admin-page patterns; satisfies FR-006, FR-027, FR-033 without redesigning unrelated admin pages.

---

## Resolved clarification log

| Spec reference | Resolution | Where |
|---|---|---|
| Open question: exact `kb_item_status_id` mapping | Not hardcoded; numeric-totals authority + discovered `status_map` | R-07 |
| Open question: QR-IBAN/QR invoices confirmation | Setup checklist + connection health check verifies `qr_invoice_id` presence on issued invoices | R-06, plan §quickstart |
| NEEDS CLARIFICATION: scheduling | `pg_cron` + `pg_net` | R-09 |
| NEEDS CLARIFICATION: token storage | Supabase Vault | R-02 |
| NEEDS CLARIFICATION: VAT | 0% active sales tax discovered from Bexio (2026-08-29) | R-14 |
| NEEDS CLARIFICATION: reconciliation cadence | 15 min via cron; manual trigger available | R-09 |

All Technical Context unknowns are resolved. No remaining `NEEDS CLARIFICATION` items.
