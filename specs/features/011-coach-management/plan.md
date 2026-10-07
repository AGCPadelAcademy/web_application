# Implementation Plan: Coach Management (F1.06)

**Branch**: `cursor/coach-management-f991` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/features/011-coach-management/spec.md`

## Summary

Keep a Coach as the existing `profiles` row with `role = 'coach'`. Add an admin Coach directory that reuses client-management list and update operations to promote an existing person, edit permitted fields, and activate or deactivate them. Tighten session assignment so a new `bookings.coach_id` must reference an active Coach, while deactivation leaves historical assignments in place. Roster access, own-profile editing, and inactive read-only behavior already match the spec and stay as they are.

## Technical Context

**Language/Version**: JavaScript/JSX on React 18 + Vite 7; SQL/PL/pgSQL for one migration. Node `>=20.19`. No TypeScript migration. No new Edge Function.

**Primary Dependencies**: Existing dependencies only — Supabase JS 2.30, Supabase Auth/Data API, PostgreSQL triggers already used by F1.02/F1.04, React Router 6, existing dashboard tabs. Zero new packages.

**Storage**: Supabase PostgreSQL. No new table or column. Replace `prevent_non_admin_coach_assignment()` so a changed non-null `bookings.coach_id` must reference `role = 'coach'` and `is_active = true`. `profiles.role`, `profiles.is_active`, and `bookings.coach_id` stay the model.

**Testing**: Vitest 4 for the assignment query/error contract; SQL assertions for the trigger predicate; `npm run lint`, `npm test`, and production build. Written trigger checklist below and in [quickstart.md](quickstart.md).

**Target Platform**: Vercel-hosted SPA and Supabase Cloud; modern browsers.

**Project Type**: Existing web application (single SPA + managed Supabase backend).

**Performance Goals**: Admin finds a Coach, edits permitted fields, or toggles status in under 3 minutes. Coach list uses the existing bounded client query (default 50). Assignment load stays one bookings page plus one coach-profile read.

**Constraints**: Least-privilege PII; no coach full-profile access; no service-role key in the browser; no hard delete or assignment wipe on deactivation; no invite or second identity; no Group, attendance, payroll, or availability model; migration is forward-only; role and status stay in `profiles`, not JWT metadata.

**Scale/Scope**: Current academy size (tens of profiles, two existing Coach profiles). One migration, one admin tab, small extensions to the assignment panel and `coachAssignments` helpers. No new route.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle / constraint | Evaluation | Result |
|---|---|---|
| I. Understand before modifying | Reviewed spec `011`, living specs `005`/`006`/`008`/`009`, domain model, migrations through `0023`, `clientManagement`, `coachAssignments`, assignment panel, roster reader, and profile mutation guard | PASS |
| II. Spec-driven | Approved-direction spec and checklist exist; this plan does not implement; branch is the dedicated `cursor/coach-management-f991` branch | PASS |
| III. Incremental/backward compatible | No new identity; existing Coach rows need no backfill; historical `coach_id` values are kept; student/admin/client journeys stay | PASS |
| IV. Security-first | Promotion and profile edits stay on the F1.04 trigger and RLS; assignment stays admin-only; inactive Coach fails `is_coach()`; direct identifier writes get the same trigger | PASS |
| V. Migration discipline | One forward migration after the local sequence `0023`; applied migrations untouched; no opportunistic schema cleanup | PASS |
| VI. Documentation | Research, model, contract, quickstart, and Mermaid under this feature folder; baseline refresh waits until the feature ships | PASS |
| VII. Simplicity/YAGNI | Reuse profiles, client-management writes, dashboard, and `bookings.coach_id`. No Coach table, invite flow, or assignment history ledger | PASS |
| Fixed stack | Existing React/Supabase stack only | PASS |
| RLS/EF written verification | Trigger checklist below. No Edge Function change, so no deploy checklist | PASS |
| Secrets / Swiss PII | No secrets. Coach directory shows the same admin profile fields as client management. Roster stays identity and phone | PASS |

**Pre-design gate: PASS.** No unresolved clarifications. Issue #11 open decisions stay resolved in the spec assumptions.

### Post-design re-check

Research R-01–R-11 and the Phase 1 artifacts preserve every gate. The only database change is a stricter assignment trigger. It does not grant new reads. No waiver is required.

## Project Structure

### Documentation (this feature)

```text
specs/features/011-coach-management/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── coach-management.md
├── checklists/
│   └── requirements.md
└── tasks.md                         # created later by /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/
└── 0024_f106_coach_management.sql     # next local number; confirm remote history before apply

src/
├── lib/
│   ├── coachAssignments.js            # active-coach list; inactive-assignment error text
│   ├── coachAssignments.test.js
│   └── clientManagement.js            # reused list/update; no new write path
├── components/admin/
│   ├── CoachManagementPanel.jsx       # NEW: coach directory, edit, status, promote
│   └── CoachAssignmentPanel.jsx       # active options; keep current inactive coach visible
└── pages/
    └── AdminDashboardPage.jsx         # Coaches tab

tests/sql/
└── 0024_f106_coach_management.test.sql
```

**Structure Decision**: Stay in the existing SPA and Data API. Coach management is a tab on the protected admin dashboard. Creating a Coach is `profiles.role = 'coach'` on an existing person. Assignment remains `bookings.coach_id`.

## Phase 0: Research result

[research.md](research.md) resolves:

- Coach identity and why no migration of existing Coach rows is required
- promote-in-place instead of invites
- reuse of client-management reads and writes for the Coach directory
- the assignment trigger gap (`role = 'coach'` without `is_active`)
- why deactivation must not update `bookings`
- how the assignment control shows a historical inactive Coach
- which roster and own-profile behaviors are already done
- migration number `0024` and the decision to add no Edge Function

No `NEEDS CLARIFICATION` remains.

## Phase 1: Design result

- [data-model.md](data-model.md) defines the reused entities, the assignment predicate, and the active/inactive transitions.
- [contracts/coach-management.md](contracts/coach-management.md) defines the Data API outcomes this feature adds or tightens.
- [quickstart.md](quickstart.md) defines the automated gate, SQL checks, and the journeys the user validates in the live app.

## Implementation design

### 1. Migration

Create one migration only after checking that `0024` is free in the remote migration history:

1. Replace `public.prevent_non_admin_coach_assignment()` in place. Keep `SECURITY INVOKER`, empty `search_path`, admin-only changes for `authenticated`/`anon`, and the non-coach error.
2. When `coach_id` is set on insert, or changed on update, and the new value is not null:
   - reject unless the target profile has `role = 'coach'`
   - reject unless that profile has `is_active = true`, with a distinct error `coach_id must reference an active coach`
3. When an update does not change `coach_id`, do nothing, including when the stored Coach is inactive.
4. Setting `coach_id` to null stays an admin assignment clear and does not require an active Coach.
5. Do not add a profile trigger, foreign-key change, or update that clears `coach_id` on deactivation.
6. Do not change `is_coach()`, roster policies, profile RLS, or grants.
7. Reload the Data API schema cache.

### 2. Admin Coach directory

- Add a Coaches tab on `AdminDashboardPage`. It does not depend on the `coach_id` column probe.
- `CoachManagementPanel` lists with `listClients({ role: 'coach' })`, the existing search, and a status filter whose default is all Coaches. Active and inactive are optional narrower filters. Page size stays bounded at the existing client-directory default.
- Edit permitted personal fields with `updateClientPersonalFields`. Activate or deactivate with `updateClientStatus`. Both already hit the profile mutation guard.
- Promote from a search of existing non-coach people (`student` or `admin`) through `updateClientRole(..., 'coach')`. Do not add a create-login or invite action. `accounting` stays unassignable. Self-role change and last-active-admin refusal stay server-side.
- After promotion, the person appears in the Coach list. People who already have `role = 'coach'` appear with no data repair.
- Client management remains the all-clients directory. This tab is a Coach-scoped view over the same profile.

### 3. Assignment

- `listCoachProfiles` returns only `role = 'coach'` and `is_active = true` for new choices.
- The assignment select still displays the occurrence’s current Coach when that person is inactive, so the screen does not look unassigned and a refresh does not clear history. Choosing a different inactive Coach is not offered. The server rejects it if a request does it anyway.
- Map the new active-coach error in `coachAssignmentErrorMessage`.
- Clearing an assignment and assigning an active Coach stay admin operations.

### 4. Behaviors already enforced

- `is_coach()` is true only for an active Coach, and `session_roster` uses it. An inactive Coach loses roster and participant access on the next read. Reactivation restores access for occurrences that still name them.
- Own-profile updates already allow only client-controlled fields for an active owner and reject role, status, and email. An inactive owner cannot update. The profile screen already shows status read-only.
- Admin routes stay `requireAdmin`. Coach roster stays `allowedRoles={['coach']}`. No financial or admin grant is added for Coaches.
- No Group, attendance, payroll, or availability objects are introduced. `availability.trainer_id` stays unused.

## Trigger verification checklist

Run on a test project with an active admin, an active Coach, an inactive Coach, a student, and two bookings (one already assigned to the inactive Coach):

- [ ] Function body requires `is_active` when `coach_id` changes to a non-null value
- [ ] Admin assigns an active Coach: update succeeds
- [ ] Admin assigns an inactive Coach: exception `coach_id must reference an active coach`; row unchanged
- [ ] Admin assigns a student: existing non-coach exception; row unchanged
- [ ] Non-admin changes `coach_id`: existing admin-only exception; row unchanged
- [ ] Deactivating a Coach does not change `bookings.coach_id`
- [ ] Updating a booking without changing `coach_id` succeeds while the assigned Coach is inactive
- [ ] Clearing `coach_id` to null as admin succeeds
- [ ] Inactive Coach’s `session_roster` read returns no rows; after reactivation, assigned rows return
- [ ] Non-admin cannot set `profiles.role` to `coach`
- [ ] Existing active-student booking, client directory, and camp admin flows still work
- [ ] No profile or booking DELETE, and no new table

Detailed order and expected outcomes: [quickstart.md](quickstart.md).

## Complexity Tracking

No constitution waivers. The assignment rule is a stricter predicate on the trigger F1.02 already uses.
