# Implementation Plan: Client Management (F1.04)

**Branch**: `cursor/009-client-management-cf2f` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/features/009-client-management/spec.md`

## Summary

Extend the existing 1:1 `profiles` client model rather than adding another user entity. Add optional date of birth and a non-destructive active flag; enforce student/admin field differences with RLS plus a changed-column trigger; make admin/coach authorization active-aware; preserve inactive owners’ read history while blocking profile, booking, cancellation, and invoice-issuance mutations. Add a paginated Client management tab to the existing admin dashboard and extend the assignment-scoped coach roster with current participant phone only. Preserve `005` profile completeness and `006`/`008` role/roster behavior.

## Technical Context

**Language/Version**: JavaScript/JSX on React 18 + Vite 7; SQL/PL/pgSQL for migration; Deno TypeScript only in existing Supabase Edge Functions. Node `>=20.19`. No TypeScript migration.

**Primary Dependencies**: Existing dependencies only — Supabase JS 2.30, Supabase Auth/Data API, PostgreSQL RLS/triggers/views, React Router 6, existing Radix/shadcn-style components. Zero new packages.

**Storage**: Supabase PostgreSQL. Additive `profiles.date_of_birth` and `profiles.is_active`; revised profile/booking RLS and profile mutation trigger; active-aware role helpers; extended private/public roster projection. Existing profile, booking, invoice, billing, membership, and credit relationships remain.

**Testing**: Vitest 4 for lib/service contracts; test-project SQL/RLS/trigger checks; manual role journeys; `npm run lint`, `npm test`, and production build. Written RLS/trigger checklist below and in [quickstart.md](quickstart.md).

**Target Platform**: Vercel-hosted SPA and Supabase Cloud; modern browsers.

**Project Type**: Existing web application (single SPA + managed Supabase backend).

**Performance Goals**: Admin finds/edits/toggles a client in under 3 minutes; directory uses bounded pages (default 50) and server-side filters; profile/roster operations use one bounded query per load. No index added until query evidence at larger scale requires it.

**Constraints**: Least-privilege PII; no public profile access; no coach full-profile access; no service-role key in browser; no hard delete/cascade on deactivation; existing login/profile identity preserved; role/status checks must not rely on JWT metadata; F1.05 level concepts excluded; migration is forward-only.

**Scale/Scope**: Current tens of profiles/bookings; four stored roles with three live actors; one migration; one admin tab; extensions to own profile, lesson booking gate, auth context, coach roster, and existing authorization checks. No invite flow, level catalog, groups, memberships, attendance, or separate Client table.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle / constraint | Evaluation | Result |
|---|---|---|
| I. Understand before modifying | Reviewed baseline/domain/API docs, `005`/`006`/`008`, profile/auth/booking/admin/coach sources, migrations `0001`–`0010`, and current Supabase RLS guidance | PASS |
| II. Spec-driven | `spec.md` and quality checklist precede plan; tasks/implementation remain later gates | PASS |
| III. Incremental/backward compatible | Two additive profile fields; existing identity/FKs/history retained; existing profile completeness unchanged | PASS |
| IV. Security-first | Owner/admin row RLS plus field trigger; active-aware privileges; fixed-output coach projection; direct-request tests | PASS |
| V. Migration discipline | One forward migration after remote history confirmation; applied migrations untouched; no unrelated schema debt | PASS |
| VI. Documentation | Research, model, contract, quickstart, and Mermaid model under feature folder; baseline updates deferred until shipping | PASS |
| VII. Simplicity/YAGNI | Reuse profiles, dashboard, roster, and Data API; no Client table, status catalog, custom API, or dependency | PASS |
| Fixed stack | Existing React/Supabase stack only | PASS |
| RLS/EF written verification | Checklist below + direct-request quickstart; service-role mutation checks explicitly covered | PASS |
| Secrets / Swiss PII | No secrets; DOB excluded from roster, booking, logs, analytics, and billing payloads | PASS |

**Pre-design gate: PASS.** No unresolved clarifications.

### Post-design re-check

Research R-01–R-14 and Phase 1 artifacts preserve every gate. The one privileged read is the already-established `private` fixed-output reader behind a public security-invoker view; it is necessary to expose assigned participant name/phone without granting coaches `profiles` or financial `bookings` access. No waiver is required.

## Project Structure

### Documentation (this feature)

```text
specs/features/009-client-management/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── authorization.md
├── checklists/
│   └── requirements.md
└── tasks.md                         # created later by /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 0011_f104_client_management.sql        # tentative next number; confirm remote history first
└── functions/
    ├── billing-issue-invoice/index.ts          # active owner/admin for mutation
    ├── billing-cancel-invoice/index.ts         # active owner/admin for mutation
    ├── billing-invoice-document/index.ts       # preserve inactive owner read
    ├── bexio-oauth/index.ts                    # active admin
    └── bexio-reconcile/index.ts                # active admin

src/
├── contexts/
│   └── SupabaseAuthContext.jsx                 # create-only bootstrap; expose isActive
├── lib/
│   ├── profileService.js                       # own DOB/status mapping; preserve payload allow-list
│   ├── profileService.test.js                  # NEW
│   ├── clientManagement.js                     # NEW: paginated admin list/update contracts
│   ├── clientManagement.test.js                # NEW
│   ├── bookings.js                             # stable inactive error mapping
│   ├── bookings.test.js
│   ├── sessionRoster.js                        # participant id/phone projection
│   └── sessionRoster.test.js
├── hooks/
│   └── useProfile.js                           # inactive read-only state
├── components/
│   ├── admin/
│   │   └── ClientManagementPanel.jsx           # NEW: directory + edit/status/role UI
│   └── modals/
│       └── ProfileCompletionModal.jsx           # fail closed for inactive profile
├── pages/
│   ├── ProfileManagementPage.jsx               # DOB + read-only role/status
│   ├── LessonsPage.jsx                         # inactive UX before confirmation
│   ├── CoachRosterPage.jsx                     # assigned participant phone
│   └── AdminDashboardPage.jsx                  # client-management tab
└── App.jsx                                     # preserve protected admin/coach route contract

tests/sql/
└── 0011_f104_client_management.test.sql         # tentative number; direct RLS/trigger/projection checks
```

**Structure Decision**: Stay in the existing SPA, direct Supabase service modules, migrations, and Edge Function layout. The admin directory is a tab in the existing protected dashboard. No new route or backend service is required unless component size during implementation demonstrates a separate protected `/admin/clients` route is clearer; either route uses the same contract.

## Phase 0: Research result

[research.md](research.md) resolves:

- profile/client identity and exact additive fields
- field-difference trigger and active-aware RLS
- last-admin concurrency protection
- inactive read-only lifecycle across browser and service-role paths
- create-only auth profile bootstrap
- fixed-output coach phone projection
- dashboard/query/test strategy

No `NEEDS CLARIFICATION` remains.

## Phase 1: Design result

- [data-model.md](data-model.md) defines fields, ownership matrix, lifecycle, booking effects, roster output, and migration behavior.
- [contracts/authorization.md](contracts/authorization.md) defines direct Data API, auth-context, roster, and Edge Function outcomes.
- [quickstart.md](quickstart.md) defines automated, direct authorization, browser, and regression verification.

## Implementation design

### 1. Migration

Create one migration only after checking local/remote numbering:

1. Add `date_of_birth date NULL` and `is_active boolean NOT NULL DEFAULT true`.
2. Replace `is_admin()` / `is_coach()` bodies to require active profile while preserving signatures/grants.
3. Replace `prevent_role_self_service` with a profile mutation guard:
   - reject future DOB
   - reject profile-email mutation for all Data API callers
   - active non-admin owner: explicit changed-column allow-list
   - inactive owner: no UPDATE
   - active admin: other-profile role/status allowed, own-role denied
   - advisory-lock + recount before removing an active admin
4. Recreate profile UPDATE and booking owner INSERT/UPDATE policies with activity rules; preserve owner SELECT regardless of activity and active-admin policies.
5. Drop/recreate roster view and table-returning private reader to add participant id/phone, then restore exact grants and security-invoker settings.
6. Reload Data API schema cache.

Do not modify profile INSERT/bootstrap policies, foreign keys, DELETE permissions, financial tables, or unrelated advisor debt.

### 2. Auth/profile services

- Session restoration queries existing profile state first and inserts only when missing; it no longer overwrites application profile fields from stale Auth metadata.
- Auth context carries current role/activity for UX guards while database checks remain authoritative.
- `profileService` maps DOB/status, but owner update payload contains only client-controlled fields.
- The profile screen shows email/role/status read-only, DOB optional, and disables save when inactive.
- Profile completeness remains exactly the live billing-field rule; DOB/status do not affect it.

### 3. Admin client management

- `clientManagement.js` owns bounded list/search/filter and explicit personal/role/status updates.
- Admin panel reuses existing inputs, country selector, cards/dialogs, toast patterns, and dashboard tab composition.
- UI prevents own-role and last-admin actions when known, but always handles server rejection.
- Do not expose an invite/create-login button.

### 4. Inactive operations

- `/lessons` checks profile status before completeness/confirmation and shows a clear message.
- Database policies reject stale-tab/direct booking inserts and owner booking updates/cancellations.
- Mutating billing/admin Edge Functions query both role and activity. Existing invoice-document retrieval remains owner-readable when inactive.
- Inspect the deployed legacy invoice generator (source absent locally) and close or document its inactive-owner mutation path before declaring FR-009 complete.

### 5. Coach projection

- Extend roster select constant/tests and render phone in the existing table.
- Coaches never query `profiles`; assignment removal, role change, or deactivation affects the next roster query.
- Admin roster behavior remains.

## RLS / trigger / service-role verification checklist

Run against a separate test project with two admins, two students, one assigned coach, and one accounting profile:

- [ ] Existing rows default/backfill `is_active=true`; DOB nullable
- [ ] Anon cannot SELECT profiles
- [ ] Student A SELECTs own profile/history but not B
- [ ] Active student changes allowed fields only; email/role/status/future fields rejected
- [ ] Future DOB rejected; null/past DOB accepted
- [ ] Inactive student SELECTs own profile/bookings/invoice document
- [ ] Inactive student profile UPDATE, booking INSERT/UPDATE/cancel, and invoice issuance denied
- [ ] Active admin lists/edits another profile and changes another role/status
- [ ] Admin own-role change denied
- [ ] Concurrent/removal attempts cannot leave zero active admins
- [ ] Inactive admin fails `is_admin()` and admin Edge Function checks
- [ ] Active coach sees only assigned roster rows with participant id/name/phone
- [ ] Coach cannot SELECT full participant profile; inactive coach gets no roster rows
- [ ] Roster contains no email/address/DOB/status/role/financial fields
- [ ] Accounting gets no directory/roster/admin privilege
- [ ] Existing active student booking, active admin Bexio, coach assignment, and anonymous `booking_slots` flows still work
- [ ] Public views are security-invoker; private fixed-output function grants match contract
- [ ] No profile/history DELETE or cascade behavior added

Detailed runnable order and expected outcomes: [quickstart.md](quickstart.md).

## Complexity Tracking

| Exception | Why needed | Simpler alternative rejected because |
|---|---|---|
| `private.session_roster_rows()` as fixed-output SECURITY DEFINER behind public SECURITY INVOKER view | Assigned coach needs current participant phone without table-level profile/booking access | Profile SELECT policy would expose excess PII; booking phone is a stale snapshot |
| Transaction advisory lock in profile mutation guard | Guarantee at least one active admin under concurrent demote/deactivate requests | UI guard or unlocked count is bypassable/race-prone |

Both reuse established PostgreSQL patterns and add no new subsystem.
