# Tasks: Roles and Permissions (F1.02)

**Input**: Design documents from `/specs/features/008-roles-and-permissions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/authorization.md, quickstart.md

**Tests**: Included — plan.md Technical Context and the constitution require Vitest for new `src/lib/` modules and a written SQL/RLS checklist for the migration. Spec.md independent tests are the quickstart scenarios, not a TDD mandate for the SPA pages.

**Organization**: Tasks are grouped by user story (US1–US2 from spec.md) so each story is independently implementable and testable after the foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US2 per spec.md; absent for Setup/Foundational/Polish phases

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Point tooling at this feature and capture live storage policy names before writing SQL

- [ ] T001 Set `.specify/feature.json` `feature_directory` to `specs/features/008-roles-and-permissions` and point `.cursor/rules/specify-rules.mdc` at `specs/features/008-roles-and-permissions/plan.md`
- [ ] T002 [P] List live `storage.objects` policies for bucket `payment-proofs` (names + USING/WITH CHECK) and paste them as comments at the top of `supabase/migrations/0003_f102_roles_and_permissions.sql` so later DROP POLICY statements match production (contracts/authorization.md §3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: One additive migration that both stories require — helpers, assignment column, isolation triggers, roster view, storage policies

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Write and apply `supabase/migrations/0003_f102_roles_and_permissions.sql` exactly as data-model.md §Migration plan: GRANT EXECUTE on `public.is_admin()` to `authenticated`; create `public.is_coach()` (same shape as `is_admin()`) + GRANT; additive `bookings.coach_id` uuid NULL FK → `profiles.id` ON DELETE SET NULL + index `bookings_coach_id_idx`; BEFORE UPDATE trigger `prevent_role_self_service` on `profiles` (reject `role` change when `auth.role()` is `authenticated` or `anon`); BEFORE UPDATE trigger `prevent_non_admin_coach_assignment` on `bookings` (only `is_admin()` may change `coach_id`; non-null target must have `profiles.role = 'coach'`); DROP policy `Public profiles are viewable by everyone`; keep `Users can read own profile role`; create `public.session_roster` SECURITY DEFINER / `security_barrier` view with columns in contracts/authorization.md §2.3 (no price/payment/email); GRANT SELECT on the view to `authenticated`, REVOKE from `anon`; replace `payment-proofs` storage policies with owner-path-or-admin SELECT/INSERT per contracts/authorization.md §3 (drop overly broad public ALL). If `007` has already taken `0003` on `main`, renumber this file before apply. Apply via Supabase MCP `apply_migration` to a **test** project, not production.
- [ ] T004 [P] Add `tests/sql/0003_f102_roles_and_permissions.test.sql` encoding plan.md “RLS / trigger verification checklist” as runnable statements (anon/student isolation, role PATCH reject, owner UPDATE of `verification_status` still allowed, owner UPDATE of `coach_id` rejected, `booking_slots` still selectable, GRANTs on `is_admin`/`is_coach`)

**Checkpoint**: Test project has the migration; student A cannot read B’s profile; role PATCH fails; `session_roster` exists (empty for students). User stories can start.

---

## Phase 3: User Story 1 - Student isolation leaks are closed (Priority: P1) 🎯 MVP

**Goal**: Existing student/admin/anon journeys still work, and the three leaks are gone — no public profiles, no self-service role change, no unscoped payment-proof files

**Independent Test**: quickstart.md §1 and §5 — student A completes own profile/payments; A cannot read B’s profile, booking, or proof file; A cannot PATCH `role`; anon `/lessons` still uses `booking_slots`

### Implementation for User Story 1

- [ ] T005 [P] [US1] Verify `src/lib/profileService.js` never writes `role` (`EDITABLE_PROFILE_FIELDS` only) and always `eq('id', userId)` on SELECT/UPDATE; tighten any caller in `src/pages/ProfileManagementPage.jsx` / `src/components/modals/ProfileCompletionModal.jsx` that still sends extra columns
- [ ] T006 [P] [US1] Verify `src/components/layout/Header.jsx` and `src/contexts/SupabaseAuthContext.jsx` (`fetchRole`) query `profiles` by `id = auth user` only so they keep working after the public SELECT drop
- [ ] T007 [P] [US1] Verify `src/components/payments/PaymentProofUpload.jsx` and `src/lib/storage.js` keep the `{bookingId}/…` object key so the new storage WITH CHECK accepts own uploads; adjust only the path helper if the live key shape cannot satisfy `(storage.foldername(name))[1] = booking_id`
- [ ] T008 [US1] Run `specs/features/008-roles-and-permissions/quickstart.md` §1 and §5 against the test project (including REST `PATCH` of `role` and signed URL for B’s proof) and fix any remaining SPA/query mismatch in `src/lib/profileService.js`, `src/components/payments/PaymentProofUpload.jsx`, or `src/lib/storage.js`

**Checkpoint**: Isolation MVP is demoable with zero coach UI. `006` student/admin journeys still pass.

---

## Phase 4: User Story 2 - Coach sees only assigned-session participants (Priority: P1)

**Goal**: Admin assigns a coach to a booking; that coach sees only the operational roster for those occurrences; coaches cannot use admin/finance surfaces

**Independent Test**: quickstart.md §2–§4 — coach C assigned only to occurrence A lists A not B; clearing `coach_id` hides A; `/admin/payment-verification` redirects; `notify-payment-verification` 403; admin verification still works

### Tests for User Story 2

- [ ] T009 [P] [US2] Write Vitest tests in `src/lib/sessionRoster.test.js` (mock `@/lib/customSupabaseClient`): `from('session_roster').select` of the contract columns; empty list handled
- [ ] T010 [P] [US2] Write Vitest tests in `src/lib/coachAssignments.test.js` (same mock pattern as `src/lib/bookings.test.js`): list `profiles` with `role = 'coach'`; `bookings.update({ coach_id })` / clear to null

### Implementation for User Story 2

- [ ] T011 [P] [US2] Implement `src/lib/sessionRoster.js` wrapping `supabase.from('session_roster').select('booking_id, booking_date, start_time, end_time, lesson_name, participant_full_name, coach_id')` per contracts/authorization.md §2.3 and §6
- [ ] T012 [P] [US2] Implement `src/lib/coachAssignments.js` for admin: list coaches (`profiles` `id, full_name` where `role = 'coach'`) and `update` `bookings.coach_id` (set or null) per contracts/authorization.md §6
- [ ] T013 [US2] Create `src/pages/CoachRosterPage.jsx` using `sessionRoster.js`: table of participant name, lesson, date, time; empty state when there are no assignments (US2 scenarios 2–3)
- [ ] T014 [US2] Register `/coach/roster` in `src/App.jsx` with `<ProtectedRoute allowedRoles={['coach']}>` wrapping `CoachRosterPage` (research R-09). Do not change `/admin/payment-verification` `requireAdmin`
- [ ] T015 [P] [US2] Add a Header dropdown item linking to `/coach/roster` when `useAuth().role === 'coach'` in `src/components/layout/Header.jsx` (keep existing Profile / Payments / Sign out)
- [ ] T016 [US2] Create `src/components/admin/CoachAssignmentPanel.jsx` using `coachAssignments.js`: list recent/upcoming bookings, select a coach profile or clear assignment; toast trigger errors without leaking other students’ ids (contracts/authorization.md §7)
- [ ] T017 [US2] Add a **Coach assignment** tab beside Payment Verification in `src/pages/AdminDashboardPage.jsx` rendering `CoachAssignmentPanel` (research R-10). Do not put assignment controls inside `src/components/admin/PaymentVerificationPanel.jsx`
- [ ] T018 [US2] Run `specs/features/008-roles-and-permissions/quickstart.md` §2–§4 on the test project (roster scope, assignment removal, coach 403 on `notify-payment-verification` / other student’s `generate-invoice-pdf`, admin payment verification still succeeds) and fix gaps in `src/pages/CoachRosterPage.jsx` or `src/components/admin/CoachAssignmentPanel.jsx`

**Checkpoint**: Coach product exists; financial records stay off the roster; admin 004 still works.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Quality gate, documentation sync, full quickstart

- [ ] T019 Run `npm run lint`, `npm test`, and `npm run build` using `package.json` / `.github/workflows/ci.yml` and fix failures introduced by this feature
- [ ] T020 [P] Update `specs/baseline-system/supabase-backend.md` §5 (and storage notes) with the new `coach_id`, `session_roster`, dropped public profiles SELECT, storage policies, and triggers after the test apply
- [ ] T021 [P] Refresh reverse spec `specs/features/006-roles-and-permissions/spec.md` to the new as-is once F1.02 behavior is live (coach is a live actor; isolation leaks closed; stop treating 008 as a second living matrix — spec.md Compatibility)
- [ ] T022 Run the complete `specs/features/008-roles-and-permissions/quickstart.md` on the test project and record pass/fail in the PR description

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001/T002 can start immediately
- **Foundational (Phase 2)**: Depends on T002 policy names; **BLOCKS all user stories**. T004 can start once T003’s objects exist (or in parallel as a checklist authored against data-model.md)
- **US1 (Phase 3)**: Depends on Foundational. No dependency on US2
- **US2 (Phase 4)**: Depends on Foundational. Uses `coach_id` / `session_roster` from T003. Does not require US1 SPA verify tasks, but shipping US2 without US1 leaves isolation incomplete
- **Polish (Phase 5)**: Depends on the stories being delivered

### User Story Dependencies

- **US1 (P1)**: Isolation only — independently testable via quickstart.md §1/§5 after T003
- **US2 (P1)**: Coach assignment + roster — independently testable via quickstart.md §2–§4 after T003. Same migration; different SPA files

*Recommended sequence: Setup → Foundational → US1 (MVP) → US2 → Polish.*

### Parallel Opportunities

- Setup: T001 ∥ T002
- Foundational: T004 ∥ T003 authoring (apply T003 before relying on SQL results)
- US1: T005 ∥ T006 ∥ T007, then T008
- US2: T009 ∥ T010 (tests); T011 ∥ T012 (libs); T015 ∥ T016 after T012/T014; T013 → T014 must be sequential (`App.jsx` imports the page)
- Polish: T020 ∥ T021 after T019

---

## Parallel Example: User Story 2

```bash
# Tests first (different files):
Task: "Write Vitest tests in src/lib/sessionRoster.test.js"
Task: "Write Vitest tests in src/lib/coachAssignments.test.js"

# Then lib modules in parallel:
Task: "Implement src/lib/sessionRoster.js"
Task: "Implement src/lib/coachAssignments.js"

# Page then route (same import graph — sequential):
Task: "Create src/pages/CoachRosterPage.jsx"
Task: "Register /coach/roster in src/App.jsx"

# Admin tab chain:
Task: "Create src/components/admin/CoachAssignmentPanel.jsx"
Task: "Add Coach assignment tab in src/pages/AdminDashboardPage.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational)
2. Complete Phase 3 (US1) → **STOP and VALIDATE** via quickstart.md §1 and §5
3. Result: student isolation holds server-side; no coach UI yet (`coach_id` stays null)

### Incremental Delivery

1. Setup + Foundational → schema/RLS live on the test project
2. + US1 → isolation MVP
3. + US2 → coach roster + admin assignment
4. Polish → docs + full quickstart

Each increment is additive. Do not implement on `main` or on `sdd/007-bexio-integration`. Stay on `sdd/008-roles-and-permissions`. If `007` merges first and takes migration `0003`, renumber before apply (research R-12).

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [USx] maps to spec.md user stories; FR/SC references live in spec.md and quickstart.md
- `ProtectedRoute.jsx` API is unchanged — only `App.jsx` starts passing `allowedRoles`
- Do not grant coaches SELECT on `bookings`; do not add a roles table; do not use `availability.trainer_id`
- Role promotion to coach remains out-of-band SQL (FR-003)
- Existing Edge Functions are not modified; coaches remain 403 on admin/non-owned invoice paths
- Commit after each completed user-story phase (constitution), not per task
