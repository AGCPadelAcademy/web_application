# Implementation Plan: Roles and Permissions (F1.02)

**Branch**: `sdd/008-roles-and-permissions` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/features/008-roles-and-permissions/spec.md`

## Summary

Close three student-isolation leaks (public profile SELECT, self-service `profiles.role` UPDATE, unscoped `payment-proofs` storage) and activate Coach on the existing `profiles.role` — no roles table, no JWT claims. Session occurrence stays the current `bookings` row; Admin assigns a coach via additive `bookings.coach_id`. Coaches read a column-restricted `session_roster` view (who / lesson / date / time), not other students’ financial booking rows. Student and admin journeys in reverse spec `006` stay in force except those tightenings. One additive migration, reuse of `is_admin()` / `ProtectedRoute.allowedRoles`, no new Edge Functions.

## Technical Context

**Language/Version**: JavaScript (JSX) on React 18 + Vite 7; PL/pgSQL for the migration. No TypeScript (constitution).

**Primary Dependencies**: Existing stack only — Supabase Auth, Postgres RLS, Storage, PostgREST. Zero new npm packages. No new Deno Edge Functions.

**Storage**: PostgreSQL — additive `bookings.coach_id`; view `session_roster`; triggers on `profiles.role` and `bookings.coach_id`; DROP public `profiles` SELECT; replace `payment-proofs` object policies. Private bucket `payment-proofs` unchanged as a bucket.

**Testing**: Vitest 4 for new `src/lib/` helpers (mocked client, same pattern as `bookings.test.js` / `profileValidation.test.js`). Written RLS/storage/trigger checklist in this plan and [quickstart.md](quickstart.md) (constitution: RLS changes always have a checklist). `npm run lint` + `npm test` + `npm run build` before done.

**Target Platform**: Vercel SPA (`agcpadelacademy.com`) + Supabase Cloud; modern browsers.

**Project Type**: Web application (existing SPA + Supabase backend).

**Performance Goals**: Roster and assignment queries at academy scale (tens of users/bookings) — indexed `coach_id`, no new chatty round-trips beyond one list fetch.

**Constraints**: Least-privilege RLS (no `true` on user-scoped tables); secrets never in the client; additive migration only; Swiss nDSG for names/emails; do not rebuild `001`–`007` student/admin flows; `availability.trainer_id` is not assignment; `accounting` stays unused; this branch is from `origin/main` (must not mix with `sdd/007-bexio-integration` WIP).

**Scale/Scope**: Three live roles; one migration; one coach page; one admin tab; two small lib modules; Header link. No class scheduler, no coach calendar, no billing access for coaches.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle (constitution.md) | Evaluation | Result |
|---|---|---|
| I. Understand before modifying | Gap analysis vs `006` + live RLS; reuse `profiles.role`, `is_admin()`, `ProtectedRoute` | PASS |
| II. Spec-driven | specify → plan artifacts; implement only after tasks + approval | PASS |
| III. Incremental / backward compatible | Additive column + view; no dropped student/admin features; public profile SELECT removed (required by FR-004) | PASS |
| IV. Security-first | Drop `SELECT true` on profiles; owner-path storage; server-side role immutability; coaches not granted `bookings` SELECT | PASS |
| V. Migration discipline | One numbered forward SQL file; `price` type debt not touched | PASS |
| VI. Documentation | Feature docs under `specs/features/008-roles-and-permissions/`; `006` remains as-is until this ships | PASS |
| VII. YAGNI | No sessions table, roles table, JWT claims, or new EFs | PASS |
| Fixed stack / no custom API | PostgREST + RLS + existing EFs | PASS |
| Auth via `profiles.role` | Unchanged source of truth | PASS |
| Tests for changed behavior | Vitest + RLS checklist | PASS |
| Secrets / PII | No new secrets; roster omits email | PASS |

**Gate result: PASS** — no unresolved clarifications. The `SECURITY DEFINER` roster view is a justified complexity item (column hiding), not a principle waiver.

### Post-design re-check

Design (research R-01–R-14, data-model, authorization contract) still passes the same gates. Triggers refuse PostgREST role/`coach_id` writes; admin assignment uses existing admin UPDATE on `bookings`. Existing invoice/notify functions stay owner-or-admin / admin-only so coaches cannot complete 004 or billing (SC-004) without new EF code.

## Project Structure

### Documentation (this feature)

```text
specs/features/008-roles-and-permissions/
├── spec.md                 # Delta vs reverse spec 006
├── plan.md                 # This file (/speckit-plan output)
├── research.md             # Phase 0 — R-01 … R-14
├── data-model.md           # Phase 1 — coach_id, session_roster, triggers
├── quickstart.md           # Phase 1 — isolation + roster validation
├── contracts/
│   └── authorization.md    # RLS, storage, routes, existing EFs
├── checklists/
│   └── requirements.md     # Spec quality (complete)
└── tasks.md                # Phase 2 — NOT created by /speckit-plan
```

As-is authorization remains `specs/features/006-roles-and-permissions/spec.md` until this feature ships.

### Source Code (repository root)

```text
supabase/migrations/
└── 0003_f102_roles_and_permissions.sql   # next number on merge-base; renumber if 007 lands first

src/
├── lib/
│   ├── sessionRoster.js                  # NEW: PostgREST session_roster
│   ├── sessionRoster.test.js             # NEW
│   ├── coachAssignments.js               # NEW: admin list/update coach_id
│   └── coachAssignments.test.js          # NEW
├── pages/
│   ├── CoachRosterPage.jsx               # NEW
│   └── AdminDashboardPage.jsx            # MODIFIED: Coach assignment tab
├── components/
│   ├── admin/CoachAssignmentPanel.jsx    # NEW
│   ├── auth/ProtectedRoute.jsx           # unchanged API; used with allowedRoles
│   └── layout/Header.jsx                 # MODIFIED: roster entry for coaches
└── App.jsx                               # MODIFIED: /coach/roster route

tests/sql/
└── 0003_f102_roles_and_permissions.test.sql  # NEW: RLS/trigger checklist as SQL comments + statements
```

**Structure Decision**: Stay on the existing SPA + `supabase/migrations` layout. No `supabase/functions/` work in this feature. Do not modify `007` billing sources (they live on another branch).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `session_roster` `SECURITY DEFINER` view | Hide financial columns while letting a coach see names on assigned rows | Granting coach SELECT on `bookings` leaks price/payment (FR-008). Column GRANT on `authenticated` would strip students’ own columns |

## RLS / trigger verification checklist

Constitution requires a written checklist for RLS changes. Run on a test project with three JWTs (see [quickstart.md](quickstart.md)):

- [ ] Anon SELECT `profiles` returns no PII
- [ ] Student A cannot SELECT B’s profile, booking, or proof object
- [ ] Student A PATCH `role` fails; role unchanged
- [ ] Student A UPDATE own booking `verification_status` still succeeds; UPDATE `coach_id` fails
- [ ] Coach SELECT `session_roster` = assigned only; SELECT others’ `bookings` empty
- [ ] Coach cannot SELECT/sign payment-proof objects they do not own
- [ ] Admin UPDATE `coach_id` to a coach profile succeeds; to a student profile fails
- [ ] Admin payment-verification UPDATE still succeeds
- [ ] Anon SELECT `booking_slots` still works
- [ ] `is_admin()` / `is_coach()` EXECUTE granted so policies/triggers evaluate
