# Tasks: Coach Management (F1.06)

**Input**: Design documents from `/specs/features/011-coach-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/coach-management.md, quickstart.md

**Tests**: Included. plan.md and quickstart.md require a SQL trigger checklist and Vitest coverage for active-coach assignment. Write each test task before its paired implementation task and confirm it fails for the missing behavior. Do not add an agent browser walkthrough; quickstart.md §4 stays for the user.

**Organization**: Tasks follow the four user stories in spec.md. The assignment trigger is foundational because deactivation history (US2) and new assignment (US4) both depend on it. US1 and US3 do not add tables or Edge Functions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its stated prerequisites because it touches a different file
- **[Story]**: US1–US4 from spec.md; omitted for Setup, Foundational, and Polish phases
- Every task names the exact file it creates or modifies

## Path Conventions

- SPA: `src/`
- Migration and SQL checks: `supabase/migrations/`, `tests/sql/`
- Feature docs: `specs/features/011-coach-management/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Lock the migration filename before any schema edit.

- [X] T001 Compare `supabase/migrations/` (latest local file `supabase/migrations/0023_f125_junior_places_countdown.sql`) with the remote migration list. Use `supabase/migrations/0024_f106_coach_management.sql` and `tests/sql/0024_f106_coach_management.test.sql` only if `0024` is free; otherwise pick the next free number and use that same number in both paths

**Checkpoint**: The migration filename is safe for the target project.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Reject a new or changed `bookings.coach_id` unless the target is an active Coach, without clearing historical assignments.

**CRITICAL**: No user-story implementation starts until this phase is complete.

### Tests for the foundation

- [X] T002 [P] Encode the plan.md trigger checklist in `tests/sql/0024_f106_coach_management.test.sql` in two parts. Static queries, safe on any database: the function body contains `is_active`; `is_coach()` still requires `is_active`; no new Coach, Group, attendance, or payroll table; no new profile or booking DELETE. Commented JWT transactions, run only on a test project: an admin assigns an active Coach; an inactive Coach raises `coach_id must reference an active coach` and the row stays unchanged; a student raises the existing non-coach error; a non-admin cannot change `coach_id` or set `profiles.role` to `coach`; deactivating a Coach does not change `bookings.coach_id`; an update that leaves `coach_id` unchanged succeeds while that Coach is inactive; clearing `coach_id` keeps the booking; an inactive Coach’s `session_roster` read returns no rows and, after reactivation, the still-assigned rows return

### Foundation implementation

- [X] T003 Replace `public.prevent_non_admin_coach_assignment()` in `supabase/migrations/0024_f106_coach_management.sql` per data-model.md §3 and contracts/coach-management.md §5: keep security invoker, empty `search_path`, and admin-only changes; require `role = 'coach' AND is_active` when `coach_id` is inserted or changed to a non-null value; raise `coach_id must reference an active coach` for an inactive Coach; keep the existing non-coach and non-admin errors; do not clear `coach_id` from a profile trigger; do not change `is_coach()`, roster grants, or profile RLS; reload the Data API schema cache
- [X] T004 Apply `supabase/migrations/0024_f106_coach_management.sql` only on a separate test project, run `tests/sql/0024_f106_coach_management.test.sql`, and fix feature-caused failures in those two files. If no test project is configured, do not apply the migration to production; record that blocker in `specs/features/011-coach-management/quickstart.md` and stop before story work

**Checkpoint**: A new assignment requires an active Coach. Deactivation leaves existing `coach_id` values in place.

---

## Phase 3: User Story 1 - Admin creates and maintains a Coach (Priority: P1) 🎯 MVP

**Goal**: An admin lists existing Coaches, edits permitted personal fields, and promotes an existing person to Coach on the same profile. No invite, no second record, no migration of current Coaches.

**Independent Test**: As admin, set an existing student’s role to Coach and see that person in the Coach list; update their phone; confirm a pre-existing Coach is listed without a data repair. As that student or as a Coach, changing any role to Coach is refused.

### Tests for User Story 1

- [X] T005 [P] [US1] Add a failing Vitest case in `src/lib/clientManagement.test.js` that `updateClientRole` to `coach` for another user sends only `{ role: 'coach' }`, and that `listClients({ role: 'coach' })` filters `role` to `coach`

### Implementation for User Story 1

- [X] T006 [US1] Create `src/components/admin/CoachManagementPanel.jsx` that lists Coaches with `listClients({ role: 'coach' })`, edits permitted personal fields with `updateClientPersonalFields`, and promotes an existing `student` or `admin` with `updateClientRole(..., 'coach')`. Reuse the client-management search, paging, form controls, and error toasts. Default the status filter to all Coaches, with active and inactive as narrower choices, so a later deactivation does not remove the person from the list. Do not add a create-login or invite action, and do not add a write path in `src/lib/clientManagement.js`
- [X] T007 [US1] Add a Coaches tab to `src/pages/AdminDashboardPage.jsx` that renders `src/components/admin/CoachManagementPanel.jsx` for the existing admin route, without removing Client management, Camps, Bexio, or Coach assignment

**Checkpoint**: US1 is testable from the admin dashboard. Existing Coaches appear with no backfill.

---

## Phase 4: User Story 2 - Admin activates and deactivates a Coach without losing history (Priority: P1)

**Goal**: The Coach directory can deactivate and reactivate a Coach. Status changes do not delete the login, the profile, or session assignments.

**Independent Test**: Deactivate a Coach who is already assigned to a booking. Coach operations stop. The booking still names that Coach. Reactivation restores Coach operations for bookings that still name them.

### Implementation for User Story 2

- [X] T008 [US2] Add activate and deactivate actions to `src/components/admin/CoachManagementPanel.jsx` using `updateClientStatus` only. Do not update `bookings` from this panel. Surface the existing self-deactivation and last-admin errors. An inactive Coach remains in the list

**Checkpoint**: US2 is demonstrable on the Coaches tab. History retention is the foundational trigger, not a second update.

---

## Phase 5: User Story 3 - Coach works only inside assigned sessions (Priority: P1)

**Goal**: Confirm the existing own-profile and roster behavior still matches the contract. Do not widen participant fields or add a Coach-only profile form.

**Independent Test**: An active Coach sees their own permitted profile and only assigned-session identity and phone. An inactive Coach does not receive roster rows. Admin and financial screens stay closed to a Coach.

### Implementation for User Story 3

- [X] T009 [P] [US3] Check `src/pages/ProfileManagementPage.jsx`, `src/pages/CoachRosterPage.jsx`, `src/lib/sessionRoster.js`, and `src/lib/sessionRoster.test.js` against contracts/coach-management.md §§4 and 6. Do not add a screen or a participant field. Change one of those files only if a Coach can edit role or status, or if the roster select adds a field beyond identity and phone. The inactive-roster and reactivation results are asserted by the commented JWT section of `tests/sql/0024_f106_coach_management.test.sql`, not by this review

**Checkpoint**: US3 stays on the current profile page and `/coach/roster` route. No new Coach screen.

---

## Phase 6: User Story 4 - Admin assigns an active Coach to a session occurrence (Priority: P2)

**Goal**: The assignment control offers active Coaches only, still displays a current inactive assignee, and the server rejects a new inactive assignment.

**Independent Test**: Assign active Coach C to an occurrence. Assigning inactive Coach D fails and the occurrence is unchanged. An occurrence that already names D still shows D after refresh.

### Tests for User Story 4

- [X] T010 [P] [US4] Update `src/lib/coachAssignments.test.js` so `listCoachProfiles` must filter `is_active` true as well as `role` coach, and `coachAssignmentErrorMessage` maps `coach_id must reference an active coach` to a stable admin message. Confirm the new assertions fail before T011

### Implementation for User Story 4

- [X] T011 [US4] In `src/lib/coachAssignments.js`, limit `listCoachProfiles` to active Coaches and map the inactive-coach error in `coachAssignmentErrorMessage`. Extend the assignment load so each booking can display its current Coach name even when that Coach is inactive, without listing other inactive Coaches as new choices
- [X] T012 [US4] Update `src/components/admin/CoachAssignmentPanel.jsx` so the select options are active Coaches plus the current assignee when that assignee is inactive. Do not clear `coach_id` while loading. Keep admin-only save behavior through `updateBookingCoachId`

**Checkpoint**: US4 is independently testable against the foundational trigger. One Coach per occurrence remains.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality gate and handoff. No new product surface.

- [X] T013 [P] Run `npm run lint`, `npm test`, and `npm run build` from `package.json` and fix feature-caused failures in `src/lib/coachAssignments.js`, `src/lib/coachAssignments.test.js`, `src/lib/clientManagement.test.js`, `src/components/admin/CoachManagementPanel.jsx`, `src/components/admin/CoachAssignmentPanel.jsx`, and `src/pages/AdminDashboardPage.jsx`
- [X] T014 Record in `specs/features/011-coach-management/quickstart.md` which automated checks passed and leave §4 journeys for the user. Do not edit `specs/baseline-system/` until the user accepts the feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on T001. Blocks every user story
- **User stories (Phases 3–6)**: Depend on Phase 2
- **Polish (Phase 7)**: Depends on the stories being implemented

### User Story Dependencies

- **US1 (P1)**: After Phase 2. No dependency on US2–US4
- **US2 (P1)**: After T006, because it edits `src/components/admin/CoachManagementPanel.jsx`. History behavior comes from Phase 2, not from US4
- **US3 (P1)**: After Phase 2. Different files from US1 and US4, so it can run beside them
- **US4 (P2)**: After Phase 2. Different files from US1–US3, so it can run beside US1 and US3. It does not require the Coaches tab

### Within Each User Story

- Tests in T002, T005, and T010 are written and failing before T003, T006, and T011
- US1 panel (T006) before the dashboard tab (T007) and before US2 (T008)
- US4 library (T011) before the assignment panel (T012)

### Parallel Opportunities

- T002 can be drafted while T001 confirms the migration number, then renamed if the number changes
- After Phase 2: T005/T006 (US1), T009 (US3), and T010/T011 (US4) touch different files
- T013 can run as soon as the touched source files are saved

### Parallel Example: After Phase 2

```text
T006 Create src/components/admin/CoachManagementPanel.jsx
T009 Check src/pages/CoachRosterPage.jsx and src/lib/sessionRoster.js
T011 Update src/lib/coachAssignments.js
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 and Phase 2
2. Complete Phase 3 (Coach list, edit, promote)
3. Stop and validate US1 before adding status, roster review, or assignment UI

### Incremental Delivery

1. Setup + foundational trigger
2. US1 Coach directory (MVP)
3. US2 activate and deactivate on that directory
4. US3 confirm existing roster and own-profile boundaries
5. US4 active-only assignment control
6. Polish quality gate

### Parallel Team Strategy

After Phase 2, one person can own the Coaches tab (US1 then US2) while another owns assignment (US4) and a third confirms roster and profile files (US3).

---

## Notes

- [P] tasks use different files and do not depend on an unfinished task in the same phase
- Do not add a Coach table, invite flow, Group, attendance, payroll, or availability model
- Do not apply the migration to production during implementation unless the user explicitly asks
- Commit by completed user-story phase, not per task
