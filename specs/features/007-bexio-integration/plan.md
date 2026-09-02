# Implementation Plan: Bexio Financial & Accounting Integration

**Branch**: `007-bexio-integration` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/features/007-bexio-integration/spec.md`

## Summary

Integrate Bexio as the external financial/accounting system so AGC never builds its own accounting ERP. New bookings produce Bexio-issued invoices (document of record, Q1-A) with Swiss QR payment parts; Bexio's bank reconciliation is authoritative for the `paid` state, synchronized into AGC by a scheduled polling worker. Implementation follows the mandated layering `FinancialService → AccountingProvider → BexioAdapter → Bexio API` inside Supabase Edge Functions (new in-repo sources under `supabase/functions/`), persists provider-neutral integration state in five new Postgres tables (+2 additive columns on `bookings`), stores OAuth tokens in Supabase Vault, schedules reconciliation via `pg_cron` + `pg_net` every six hours (Decision 2026-09-02), and exposes a new admin Integrations page. Legacy invoice generation remains for pre-integration records. Proof-of-payment is removed (Decision 2026-08-24).

## Technical Context

**Language/Version**: TypeScript (Deno, Supabase Edge Functions); React 18 + Vite frontend; PL/pgSQL for migrations.

**Primary Dependencies**: Supabase platform only — Edge Functions, Postgres + RLS, Vault (`supabase_vault`, already installed), `pg_cron` + `pg_net` (newly enabled for scheduling, research R-09). **Zero new runtime npm dependencies**: Bexio calls use Deno's built-in `fetch`; OAuth/PKCE/HMAC use Deno std + Web Crypto. Bexio API v2.0/3.0 + `auth.bexio.com/realms/bexio` OAuth 2.0 (new IdP; `idp.bexio.com` decommissioned 2025-03-31).

**Storage**: PostgreSQL — new tables `billing_integrations`, `billing_contacts`, `billing_documents`, `billing_operations`, `billing_events`; additive columns `bookings.payment_confirmation_source`, `bookings.payment_confirmed_at`; view `billing_public_config`; secrets in Vault (`bexio_refresh_token`, `bexio_access_token_cache`, `bexio_scheduler_secret`). No new Storage buckets; PDFs are streamed from Bexio on demand (research R-11).

**Testing**: PostgREST-level SQL contract tests for RLS on new tables (mirroring existing policy tests), Deno unit tests for `_shared/billing` mappers/state rules (adapter mocked), manual E2E validation per `quickstart.md` against a Bexio demo company. Project has no existing JS test runner — Deno's built-in `deno test` covers the new function code without adding frontend tooling.

**Target Platform**: Supabase Cloud (project `xdmrmwsnazzgsahpttzw`), Vercel-hosted SPA; users on modern browsers.

**Project Type**: Web application (frontend SPA + serverless backend on existing fixed stack).

**Performance Goals**: Invoice issuance adds ≤ 5 s to booking flow (SC-006); reconciliation detects payment within 6 h worst case (Decision 2026-09-02) — six-hour cadence + on-demand trigger; admin status queries < 1 s.

**Constraints**: Bexio rate limits (429 + `RateLimit-*` headers, exact quota unpublished — backoff-driven, research R-10); access token TTL 1 h / refresh token 365 d with rotation; no native Bexio webhooks (polling mandated); no credit-note API (hybrid manual refunds, spec §Cancellation); brownfield — no changes to existing tables' semantics, RLS patterns, or legacy invoice path for historical records; secrets never in tables/logs/responses.

**Scale/Scope**: Academy scale — 59 users, 31 bookings, a few invoices/day, ~4 poll cycles/hour over tens of open documents. 4 new Edge Functions, 1 new admin page, 1 frontend lib module, 1 migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle (constitution.md) | Evaluation | Result |
|---|---|---|
| Fixed tech stack (React/Vite SPA + Supabase; no custom API server) | All backend behavior in Edge Functions + Postgres; scheduling via in-stack `pg_cron`/`pg_net`; no new services | PASS |
| Backend via Supabase Edge Functions / Postgres only | 4 new functions; Bexio reachable only server-side; frontend talks to functions/PostgREST | PASS |
| Database access discipline & RLS on all user data | Every new table has RLS policies in the same migration; `billing_public_config` view exposes a boolean only; writes service-role-only | PASS |
| Auth via Supabase Auth + profiles roles | Reuses existing JWT + `is_admin` pattern; OAuth `state` HMAC for the JWT-less callback | PASS |
| Secrets server-side, never in client | Client id/secret in Edge Function env; tokens in Vault; only secret *names* in tables | PASS |
| Spec-driven workflow; documentation synced | spec → research → plan → data-model → contracts → quickstart produced; docs under feature dir | PASS |
| Brownfield: preserve existing behavior, additive changes | Migration is additive-only; legacy generator, `invoices` table/bucket retained; proof UI removed 2026-08-24; cutover via flag | PASS |
| Minimal dependencies / no unjustified additions | No new npm packages; only platform extensions `pg_cron`/`pg_net` enabled (documented, justified R-09) | PASS (justified) |
| Tests for changed behavior | Deno unit tests for new shared modules + SQL RLS tests + quickstart E2E | PASS |

**Gate result: PASS** — no unresolved violations. The two deliberate deviations are tracked below with justification.

## Project Structure

### Documentation (this feature)

```text
specs/features/007-bexio-integration/
├── spec.md                 # Feature specification (Q1-A, Q2-A resolved)
├── plan.md                 # This file (/speckit-plan output)
├── research.md             # Phase 0 output — 15 decisions, all clarifications resolved
├── data-model.md           # Phase 1 output — 5 tables, 2 additive columns, RLS, state machines
├── quickstart.md           # Phase 1 output — setup + 7 validation scenario groups
├── contracts/
│   ├── edge-functions.md       # HTTP contracts: 4 functions + call graph
│   └── accounting-provider.md  # Internal AccountingProvider interface + Bexio endpoint map
├── checklists/
│   └── requirements.md     # Spec quality checklist (complete)
└── tasks.md                # Phase 2 output (/speckit-tasks — NOT created by this command)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 0XX_bexio_integration.sql        # tables, columns, RLS, view, extensions, cron job
└── functions/                           # NEW in-repo convention for new functions only (research R-13)
    ├── _shared/
    │   └── billing/
    │       ├── financial-service.ts     # orchestration: bookings → provider ops
    │       ├── accounting-provider.ts   # provider-neutral interface
    │       ├── vault.ts                 # token read/write via service-role SQL
    │       └── bexio/
    │           ├── bexio-adapter.ts     # AccountingProvider implementation
    │           ├── bexio-client.ts      # fetch wrapper: auth, refresh, 429/5xx backoff, sanitized logs
    │           └── bexio-mappers.ts     # AGC ⇄ Bexio payload translation
    ├── bexio-oauth/index.ts             # start / callback / status / initialize / configure / disconnect
    ├── billing-issue-invoice/index.ts   # post-booking orchestration, idempotent
    ├── billing-invoice-document/index.ts# owner/admin PDF streaming from Bexio
    └── bexio-reconcile/index.ts         # scheduled worker: payment sync + retry queue

src/
├── lib/
│   ├── bookings.js                      # MODIFIED: invoice-request branches on billing_public_config (legacy fallback preserved)
│   └── billing.js                       # NEW: client for billing-* / bexio-oauth functions
├── pages/
│   └── AdminIntegrationsPage.jsx        # NEW: connection card, config discovery, health, manual reconcile
├── components/
│   └── billing/                         # NEW: PaymentSourceBadge, IntegrationStatusCard
└── App.jsx                              # MODIFIED: register /admin/integrations route (existing admin guard)

tests/
└── (existing SQL/PostgREST test location mirrored for new RLS policy tests)
```

**Structure Decision**: Web-application structure on the existing repo layout. New backend code goes to `supabase/functions/` (first in-repo function sources — see Complexity Tracking); frontend additions follow the current `src/pages` + `src/lib` conventions; the only modifications to existing files are the booking-invoice branch in `src/lib/bookings.js` and one route registration. Existing Edge Functions (`generate-invoice-pdf`, `verify-payment-proof`, …) are not modified or relocated.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| In-repo source for new Edge Functions (`supabase/functions/`) deviates from the dashboard-managed convention | SDD requires reviewable, versioned code; the shared `billing/` layer is multi-file and unmaintainable as dashboard blobs | Keep dashboard-editing: unreviewable, no diff history, contradicts spec-driven governance. Migrating existing functions too: unrelated refactor, rejected per brownfield rules |
| Enabling `pg_cron` + `pg_net` platform extensions | Only in-stack way to run the mandated (no-webhook) reconciliation schedule; cron definition ships in the migration | Vercel Cron: couples backend behavior to hosting, needs a public endpoint + separate secret distribution. Manual polling: fails SC-002 (automatic confirmation) |
