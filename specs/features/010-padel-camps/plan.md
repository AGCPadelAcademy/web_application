# Implementation Plan: Padel Camps / Camps Registration (F1.25)

**Branch**: `cursor/f1-25-padel-camps-4155` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/features/010-padel-camps/spec.md`

## Summary

Add a reusable, admin-managed Camps product: public `/camps` discovery, a parent-owned Children page (multiple dependents, not logins), server-orchestrated child registration with extras and atomic capacity, one Bexio invoice per registration through the existing F1.03 financial boundary, and a single confirmation email only after reconciliation marks the registration paid. Camps are event-like offerings — not lessons, trips, or recurring Groups. The first Mini / Junior / Competition values are configuration, not code.

## Technical Context

**Language/Version**: JavaScript/JSX on React 18 + Vite 7; SQL/PL/pgSQL for migrations; Deno TypeScript in Supabase Edge Functions. Node `>=20.19`. No TypeScript migration.

**Primary Dependencies**: Existing stack only — Supabase JS 2.30, Supabase Auth/Postgres/RLS/Edge Functions, React Router 6, existing Radix/shadcn-style components, existing F1.03 `billing_*` spine and `FinancialService → AccountingProvider → BexioAdapter` layering. Zero new npm packages.

**Storage**: Supabase PostgreSQL. New tables `camps`, `camp_extras`, `children`, `camp_registrations`, `camp_registration_extras`, `camp_waitlist_entries`; additive `camp_registration_id` on `billing_documents` / `billing_operations` / `billing_events`; public-safe `camp_public_list` view; transactional `register_camp_child` function. Money is `numeric(10,2)` CHF.

**Testing**: Vitest 4 for frontend lib/payload tests; Deno unit tests for camp mapper/orchestration with mocked provider and in-memory repo; SQL/RLS tests in `tests/sql/` for new tables, policies, and the capacity transaction; manual E2E per [quickstart.md](quickstart.md) against a test Supabase project and Bexio demo company.

**Target Platform**: Vercel-hosted SPA and Supabase Cloud; modern browsers, mobile-first.

**Project Type**: Existing web application (single SPA + managed Supabase backend).

**Performance Goals**: Admin publishes a Camp in under 5 minutes; parent completes discovery-to-submit in under 5 minutes on mobile; capacity check is a single transactional statement; reconciliation confirms within the existing 6-hour cadence.

**Constraints**: Bexio rate limits and no webhooks (existing F1.03 polling); least-privilege RLS; no public child/parent PII; no second customer identity; no card/Stripe; brownfield additive-only schema; secrets server-side; English UI with the specified `Complet / Ausgebucht` full-state label.

**Scale/Scope**: Academy scale — tens of families, a handful of Camps, tens of registrations per Camp. One migration, three new Edge Functions, two extended existing functions, one public page, one protected Children page, admin Camps tabs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle / constraint | Evaluation | Result |
|---|---|---|
| I. Understand before modifying | Reviewed spec, constitution, F1.03 code/contracts, F1.04 RLS/trigger pattern, booking/billing/profile/admin sources, migrations | PASS |
| II. Spec-driven | Approved spec + checklist precede plan; tasks/implementation remain later gates; managed Cloud Agent uses the constitution-approved `cursor/` branch | PASS |
| III. Incremental/backward compatible | New tables + additive billing columns only; lesson booking, `/trips`, legacy invoices, and F1.03 lesson flow unchanged | PASS |
| IV. Security-first | RLS on all new tables; server-side capacity/eligibility; owner-or-admin reads; no public PII; secrets stay in Vault/env | PASS |
| V. Migration discipline | One forward additive migration after remote numbering confirmation; no unrelated schema debt | PASS |
| VI. Documentation | Research, data model, contracts, quickstart, Mermaid diagrams under the feature folder | PASS |
| VII. Simplicity/YAGNI | Reuse existing billing spine, admin dashboard tabs, profile completeness gate, and mailer; no new vendor or service | PASS |
| Fixed stack | React/Supabase only; no custom API server | PASS |
| RLS/EF written verification | Checklist below + direct-request quickstart | PASS |
| Secrets / Swiss PII | No secrets in tables; child PII excluded from analytics and public projections | PASS |

**Pre-design gate: PASS.** No unresolved clarifications.

### Post-design re-check

Research R-01–R-15 and the Phase 1 artifacts preserve every gate. The transactional `register_camp_child` is the one privileged write path; it is necessary to enforce last-place capacity atomically and is service-role only. No waiver is required.

## Project Structure

### Documentation (this feature)

```text
specs/features/010-padel-camps/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── edge-functions.md
│   └── camp-billing.md
├── checklists/
│   └── requirements.md
└── tasks.md                         # created later by /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 0014_f125_padel_camps.sql              # tentative next number; confirm remote history first
└── functions/
    ├── _shared/
    │   └── billing/
    │       ├── camp-mapper.ts                 # NEW: registration → InvoiceInput
    │       ├── camp-confirmation.ts           # NEW: confirmation subject/html + idempotency guard
    │       ├── financial-service.ts           # EXTENDED: camp registration repo reads/issue
    │       └── reconciliation-service.ts      # EXTENDED: camp paid transition + confirmation email
    ├── camp-submit-registration/index.ts      # NEW
    ├── camp-cancel-registration/index.ts      # NEW
    ├── camp-admin/index.ts                    # NEW: camp CRUD, registrations, waitlist, export
    ├── billing-invoice-document/index.ts      # EXTENDED: accept camp_registration_id
    └── bexio-reconcile/index.ts               # EXTENDED: camp documents

src/
├── lib/
│   ├── camps.js                               # NEW: public camp list, registration submit/cancel
│   ├── camps.test.js                          # NEW
│   ├── children.js                            # NEW: owner children CRUD/archive
│   ├── children.test.js                       # NEW
│   └── billing.js                             # EXTENDED: camp invoice document helper
├── pages/
│   ├── CampsPage.jsx                          # NEW: /camps discovery
│   ├── CampDetailPage.jsx                     # NEW: camp detail + registration flow
│   ├── ChildrenPage.jsx                       # NEW: /children list + per-child invoices
│   └── AdminDashboardPage.jsx                 # EXTENDED: Camps tabs
├── components/
│   └── admin/
│       └── CampManagementPanel.jsx            # NEW
└── App.jsx                                    # EXTENDED: /camps, /camps/:slug, /children routes

tests/sql/
└── 0014_f125_padel_camps.test.sql             # tentative number; RLS + capacity transaction checks
```

**Structure Decision**: Stay in the existing SPA, direct Supabase service modules, migrations, and Edge Function layout. Admin Camp tooling is added as tabs in the existing protected dashboard; public discovery is a new route; children are a protected owner page. No new backend service or vendor is introduced.

## Phase 0: Research result

[research.md](research.md) resolves:

- Camp/child registration as its own domain, not a second `bookings` type
- Reuse of the F1.03 `billing_*` spine with an additive camp reference
- Children as parent-owned dependents (no login, no second customer)
- Atomic capacity via a transactional function with a Camp row lock
- Server-orchestrated, idempotent registration + invoice submission
- Camp + extras as invoice line items with snapshotted prices
- Reconciliation-driven, notification-log-idempotent confirmation email
- Public non-PII `/camps` projection and mobile-first flow
- Owner-scoped Children page with per-child invoices
- Admin Camp management and CSV export in the existing dashboard
- Camp-scoped deterministic waitlist with admin conversion
- `numeric` CHF money and academy-local dates
- First-party PII-free funnel events
- Unpaid cancellation, deactivation, and archived-child edge cases
- Existing Vitest + Deno + SQL/RLS test split

No `NEEDS CLARIFICATION` remains.

## Phase 1: Design result

- [data-model.md](data-model.md) defines tables, additive billing columns, RLS, state machines, the transactional capacity function, and the migration plan.
- [contracts/edge-functions.md](contracts/edge-functions.md) defines the three new functions and the two extended functions.
- [contracts/camp-billing.md](contracts/camp-billing.md) defines the internal camp mapper, repository additions, and confirmation-email contract.
- [quickstart.md](quickstart.md) defines runnable end-to-end validation scenarios.

## Implementation design

### 1. Migration

Create one migration only after checking local/remote numbering:

1. Create `camps`, `camp_extras`, `children`, `camp_registrations`, `camp_registration_extras`, `camp_waitlist_entries` with constraints, indexes, and the partial uniqueness rules in data-model.md.
2. Add `camp_registration_id` to `billing_documents` / `billing_operations` / `billing_events`; extend the document CHECK (exactly one subject) and the owner RLS clause.
3. Create `camp_public_list` (security-invoker, non-PII) and grant `SELECT` to `anon`/`authenticated`.
4. Create `register_camp_child` (and `cancel_camp_registration`) as SECURITY DEFINER service-role-only functions implementing the atomic capacity/eligibility insert.
5. Enable RLS and add policies: public read of published Camps/extras; owner-or-admin children/registrations/waitlist; admin-only Camp writes; no child delete.

Do not modify `bookings`, `lessons`, `invoices`, `profiles` semantics, existing billing tables’ meaning, or unrelated advisor debt.

### 2. Camp billing orchestration

- Extend `financial-service.ts` with `issueInvoiceForCampRegistration` using the same idempotency layers (local document anchor, succeeded operation, `api_reference` search) and the same retry-queue behavior.
- Extend `reconciliation-service.ts` so a paid Camp document transitions the registration once and triggers the confirmation email once.
- Reuse `mailer.ts` and `notifications_log`; add Camp confirmation subject/html in `camp-confirmation.ts`.
- Keep Bexio as the only provider; no UI/domain code calls Bexio directly.

### 3. Public `/camps` and registration flow

- `/camps` reads `camp_public_list`; shows published Camps with status (`open`, `closed`, `full` → `Complet / Ausgebucht`) and CTA.
- `/camps/:slug` shows detail and starts registration; unauthenticated users go through the existing sign-in/sign-up return-to pattern.
- Registration flow: select saved child (or add one), confirm parent contact (from profile), select extras (live total), accept terms, review, submit via `camp-submit-registration`.
- Billing-profile incompleteness opens the existing profile-completion path before a chargeable registration is created.

### 4. Children page

- `/children` lists the parent’s children; add/edit personal information; archive (not delete) when history exists.
- Each child shows Camp registrations with invoice status and a document link (extended `billing-invoice-document`).
- Owner-or-admin RLS enforces isolation; direct identifier access is denied.

### 5. Admin Camps

- New tabs in `AdminDashboardPage`: Camps (CRUD/publish/extras), Registrations (list, pending vs paid, remaining places), Waitlist (order, convert), Export (CSV).
- All operations call `camp-admin`; non-admins are refused server-side.

### 6. Analytics

- Record the four funnel events with non-PII properties only. No vendor SDK.

## RLS / function verification checklist

Run against a separate test project with one admin, two parents, and children for each:

- [ ] Anon can read `camp_public_list` (published only) and cannot read `children`/`camp_registrations`
- [ ] Parent A reads/writes only own children; parent B cannot see or use A’s child id
- [ ] Deactivated parent cannot add/edit children or submit registrations; history remains readable
- [ ] `register_camp_child` refuses unpublished/closed/deadline-passed/full/age-out-of-range/duplicate
- [ ] Two concurrent submissions for the last place yield at most one active registration
- [ ] Cancellation releases capacity; paid registrations cannot be cancelled here
- [ ] Waitlist join does not consume capacity; duplicate active entry refused; conversion revalidates
- [ ] Camp invoice has Camp + extras lines, correct CHF total, 0% VAT, one document per registration
- [ ] Reconciliation confirms once and sends exactly one confirmation email
- [ ] Admin list/export works; non-admin `camp-admin` calls are denied
- [ ] Analytics events contain no child/parent PII

Detailed runnable order and expected outcomes: [quickstart.md](quickstart.md).

## Complexity Tracking

| Exception | Why needed | Simpler alternative rejected because |
|---|---|---|
| `register_camp_child` as SECURITY DEFINER transactional function | Atomic last-place capacity + eligibility + snapshot insert that direct API calls cannot bypass | Browser check or client insert is race-prone and bypassable; a maintained counter drifts |
| Additive `camp_registration_id` on `billing_*` instead of a camp-only invoice schema | Reuses F1.03 idempotency, retry, correlation, and reconciliation without a second payment machine | A parallel `camp_invoices` table duplicates audit/retry and violates the F1.03 reuse constraint |

Both reuse established project patterns and add no new subsystem.

## Evolution 2026-09-09 (Phase 14)

User-confirmed evolution of children management and the registration flow. No Edge Function changes (removal and avatars use direct PostgREST/Storage under RLS); no new dependencies.

- **Children schema**: `children.avatar_path` (nullable text); private `child-avatars` Storage bucket with owner-path-or-admin policies modeled on `payment-proofs` (migration `0008`); DELETE policy on `children` for owner-or-admin — the `camp_registrations.child_id` `ON DELETE RESTRICT` FK still blocks removal when history exists (decision 2).
- **Children UI**: centered create-child form (capitalized labels, manual DD.MM.YYYY DOB, prefix + national emergency phone stored E.164, optional image upload, **no padel level** — decision 1); child profile-management view at `/children/:childId` following `ProfileManagementPage` (all fields incl. level, image replace/delete, default SVG avatar, per-child Camp invoices); card actions reduced to Edit/Remove with a `CancelBookingModal`-style confirmation Dialog.
- **Registration flow**: draft preservation in `sessionStorage` (selected child, extras, terms state) keyed by Camp; `/terms` accepts `return_to` and navigates back (never home); `+ Add new Child` routes to `/children?new=1&return_to=…` and returns with the draft restored and the new child pre-selected.
- **Unchanged by the evolution**: FR-012 (one registration + one invoice per child; multi-child = separate flows), the billing spine, capacity, waitlist, funnel, and all Edge Functions.

## Evolution 2026-09-09, round 2 (Phase 15): Camp flyers + dual pricing

- **Schema** (`0017`): `camps.flyer_path`, `camps.member_price_amount` (NULL, ≥ 0), `camp_registrations.member_price_claimed` (default false); `register_camp_child` gains optional `p_member_price_claimed` (snapshots the member price when claimed, else `member_price_unavailable`); private `camp-flyers` bucket (published-camp flyers publicly signable, unpublished admin-only, admin-only writes); `camp_public_list` gains `flyer_path` + `member_price_amount`.
- **Admin**: `CampManagementPanel` gains usual + member price inputs and flyer upload/preview/replace/remove; registrations list and CSV flag member-price claims.
- **Public**: `/camps` cards show the flyer right-side in the same card (fallback placeholder otherwise) and both prices when a member price exists; `CampDetailPage` shows both prices and an "active membership" checkbox (draft-preserved) that switches the total to the member price.
- **Shared**: `FlyerLightbox` (Dialog, per `InvoicePreviewModal` conventions) for the larger view; `src/lib/imageValidation.js` generalizes the C1 avatar validator.
- **Edge Functions**: `camp-submit-registration` passes the claim through; `camp-admin` validation accepts `member_price_amount`; no new function.
- **F1.09 handover (not built here)**: automatic active-at-registration membership check, member-only price display for members, and a pending-membership-payment admin flag.

## Evolution 2026-09-09, round 3 (Phase 16): listing layout, type filters, price placement

- **Schema** (`0018`): nullable `camps.camp_type` text (no Mini/Junior/Competition CHECK/enum); `camp_public_list` gains `camp_type`. One-time data backfill of current Herbstferien name prefixes into type labels is data-only.
- **Admin**: Camp form accepts optional Camp type; `validateCampPayload` / `upsert_camp` pass it through. No new Edge Function.
- **Public `/camps`**: type filters below the description (derived distinct types + All); description width matches the card container; one card per row; larger contain-fit flyer; no prices on cards.
- **Camp detail**: usual/member price only inside the Submit registration card; C2 membership checkbox there when a member price exists; displayed total updates with membership/extras and is the invoiced amount. `+ Add new Child` removed from registration; Children page create and FR-012 unchanged. Terms draft restore stays.
