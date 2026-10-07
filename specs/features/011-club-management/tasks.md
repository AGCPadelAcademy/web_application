# Tasks: Club Management (F1.07)

**Input**: Design documents from `/specs/features/011-club-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/clubs.md, quickstart.md

**Tests**: Included. plan.md and quickstart.md require `src/lib/clubs.test.js` and `tests/sql/0024_f107_club_management.test.sql`. The spec definition of done requires those checks to pass and existing behavior to stay intact. Write each test task before the implementation task it covers.

**Organization**: Tasks follow spec.md user stories. The `clubs` table, RLS, triggers, view, and private function are foundational because every story uses the same catalogue.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2, US3 from spec.md; omitted for Setup, Foundational, and Polish
- Every task names the exact file it creates or modifies

## Path Conventions

- SPA: `src/`
- Migration and SQL checks: `supabase/migrations/`, `tests/sql/`
- No new Edge Function and no new route

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Lock the migration filename before any schema or test file is written.

- [ ] T001 Confirm the remote migration list still ends at `0023_f125_junior_places_countdown`. Create `supabase/migrations/0024_f107_club_management.sql` with a header comment identifying F1.07. If a higher version already exists, use the next free number and the suffix `f107_club_management`, and use that same number in `tests/sql/` in T002

**Checkpoint**: The migration file exists and its number does not collide with remote history. It does not yet create tables.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the only Club record and the rules every story relies on: admin-only access, unique name, no delete, and the active-club check.

**CRITICAL**: No user-story work starts until this phase is complete.

### Tests for the foundation

- [ ] T002 Encode every item in the plan.md RLS / trigger checklist and quickstart.md §3 in `tests/sql/0024_f107_club_management.test.sql` (or the renumbered file from T001). The file must assert all of the following: `public.clubs` exists with RLS enabled and `is_active` defaulting to true; the unique index is on `lower(name)`; `anon` has no table, view, or function privileges; `authenticated` has select, insert, and update but not delete; there is no DELETE policy and BEFORE DELETE raises; an active admin can insert, update, deactivate, and reactivate; a student, coach, accounting user, inactive admin, and anonymous caller cannot read or change the catalogue; a blank or whitespace-only name is rejected; `Club Norte` and `club norte` cannot both exist; location, phone, and email may be null; changing `id` is rejected; deactivate then reactivate keeps the same `id`; `clubs_for_new_use` is security invoker, returns only active clubs, and is empty for a non-admin; `private.club_is_selectable_for_new_use(uuid)` is true for an active id, false for an inactive or unknown id, and not executable by `anon`; a temporary child row with `ON DELETE RESTRICT` still points at the club after deactivation, delete of the club fails, and the temporary table is dropped before the script finishes; `profiles`, `bookings`, `lessons`, and `camps` have no new club column; public footer, contact, and terms text are unchanged

### Foundation implementation

- [ ] T003 Implement `supabase/migrations/0024_f107_club_management.sql` per data-model.md §§2–4 and §7 and research.md R-01–R-08: `public.clubs` columns and limits, trim/normalize trigger, immutable `id`, unique `lower(name)`, delete-blocking trigger, active-admin SELECT/INSERT/UPDATE policies using `is_admin()`, grants, `public.clubs_for_new_use`, and `private.club_is_selectable_for_new_use(uuid)`. Do not seed a club. Do not alter `profiles`, `bookings`, `lessons`, `camps`, or the public address copy

**Checkpoint**: The database alone can store a club, reject a non-admin, reject a duplicate or blank name, block delete, and answer whether an id is selectable for new use.

---

## Phase 3: User Story 1 - Admin creates and maintains a club (Priority: P1) 🎯 MVP

**Goal**: An active admin creates a club, sees it in the catalogue, and updates its name, place, and contact on the same club. A blank or duplicate name is refused. Students, coaches, and signed-out callers cannot create or edit a club.

**Independent Test**: As an admin, create a named club with no address, then add place and contact and see the same club. A blank name and a case-only duplicate are refused. A student or coach direct request does not create or change a row.

### Tests for User Story 1

- [ ] T004 [P] [US1] Add failing Vitest coverage in `src/lib/clubs.test.js` for catalogue list select/order, create and update allow-lists (`name`, `location`, `phone`, `email` only), blank-name and duplicate-name messages, permission-error mapping, and the absence of a delete export, matching contracts/clubs.md §§2, 4, 5, and 7

### Implementation for User Story 1

- [ ] T005 [US1] Implement `listClubs`, `createClub`, and `updateClub` in `src/lib/clubs.js` against `public.clubs` using the existing Supabase client and the contracts/clubs.md column lists and operator messages
- [ ] T006 [US1] Create `src/components/admin/ClubManagementPanel.jsx` with the catalogue (name, place, status), create/edit form, empty and error states, and save through `src/lib/clubs.js`. Do not add a delete control
- [ ] T007 [US1] Add a Clubs tab to `src/pages/AdminDashboardPage.jsx` that renders `ClubManagementPanel`, and mention clubs in the page description. Keep the clients, camps, Bexio, and coach-assignment tabs and the existing `/admin/integrations` route

**Checkpoint**: US1 is demonstrable on its own. An admin can create and correct a club. The screen does not deactivate or delete it yet.

---

## Phase 4: User Story 2 - Admin deactivates and reactivates a club (Priority: P1)

**Goal**: An admin deactivates and reactivates a club without changing its id or deleting it. Inactive clubs stay in the catalogue and can still be edited. Repeating the current status changes nothing. Non-admins cannot change status.

**Independent Test**: Deactivate a club and confirm the same id remains and a direct delete does not remove it. Edit its place while inactive. Deactivate again. Reactivate and confirm the same id is active.

### Tests for User Story 2

- [ ] T008 [P] [US2] Extend `src/lib/clubs.test.js` with failing cases for `setClubActive(true|false)` sending only `is_active`, an already-matching status update, and a non-admin failure that leaves status unchanged, per contracts/clubs.md §6

### Implementation for User Story 2

- [ ] T009 [US2] Implement `setClubActive` in `src/lib/clubs.js` so the payload is only `is_active` and errors use the same operator messages as T005
- [ ] T010 [US2] Add activate and deactivate actions to `src/components/admin/ClubManagementPanel.jsx`. Keep inactive clubs in the list, allow detail edits while inactive, and still omit every delete control

**Checkpoint**: US1 and US2 both work. Stopping use of a club does not remove it.

---

## Phase 5: User Story 3 - One Club for future groups and sessions (Priority: P2)

**Goal**: The only location choice for a new use is the active-club view. The client does not invent a second venue list, does not assign a home club to a person, and does not build groups, sessions, prices, or bookings.

**Independent Test**: The new-use query reads `clubs_for_new_use` and selects only `id`, `name`, and `location`. The service never reads or writes `profiles`, `bookings`, `lessons`, or `camps`. No group or session screen is added.

### Tests for User Story 3

- [ ] T011 [P] [US3] Extend `src/lib/clubs.test.js` with failing cases that `listClubsForNewUse` queries `clubs_for_new_use` for `id`, `name`, `location` only, and that `src/lib/clubs.js` does not call `profiles`, `bookings`, `lessons`, or `camps`, per contracts/clubs.md §§3, 8, and 9

### Implementation for User Story 3

- [ ] T012 [US3] Implement `listClubsForNewUse` in `src/lib/clubs.js` exactly as contracts/clubs.md §3. Do not add a public RPC wrapper for `private.club_is_selectable_for_new_use`
- [ ] T013 [US3] Show the active-only new-use set from `listClubsForNewUse` in `src/components/admin/ClubManagementPanel.jsx`, separate from the full catalogue. Do not add group, session, coach-roster, or client home-club fields

**Checkpoint**: All three stories work. Later features have one catalogue and one active-club rule, and this feature did not start scheduling or billing.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Run the automated gate and leave the live journeys for the user.

- [ ] T014 [P] Run `npm run lint`, `npm test`, and `npm run build` from the repository root. Fix failures caused by this feature in `src/lib/clubs.js`, `src/lib/clubs.test.js`, `src/components/admin/ClubManagementPanel.jsx`, and `src/pages/AdminDashboardPage.jsx`
- [ ] T015 [P] Record in `specs/features/011-club-management/quickstart.md` that §§4–7 remain manual checks for the user. State that `supabase/migrations/0024_f107_club_management.sql` and `tests/sql/0024_f107_club_management.test.sql` stay unapplied until the user explicitly asks
- [ ] T016 If the user explicitly asks to apply the migration, apply `supabase/migrations/0024_f107_club_management.sql` to the live project, execute `tests/sql/0024_f107_club_management.test.sql`, and fix failures only in those two files. If the user has not asked, leave this task unchecked and do not connect to the live database

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on T001. Blocks every user story
- **User Stories (Phases 3–5)**: Depend on Phase 2. They share `src/lib/clubs.js`, `src/lib/clubs.test.js`, and `src/components/admin/ClubManagementPanel.jsx`, so they run in order US1 → US2 → US3
- **Polish (Phase 6)**: Depends on the desired stories being complete. T016 also depends on T002 and T003, and stays unchecked until the user explicitly asks to apply the migration

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2. No dependency on US2 or US3
- **User Story 2 (P1)**: Starts after US1 because it extends the same service and panel. The database status rule already exists in Phase 2
- **User Story 3 (P2)**: Starts after US1 because it extends the same service and panel. The view and private function already exist in Phase 2. It does not require the deactivate button from US2

### Within Each User Story

- Tests are written first and fail before the implementation task
- Service before panel
- Panel before the dashboard tab (US1)
- Story checkpoint before the next story

### Parallel Opportunities

- T014 and T015 touch different files and can run together
- T004, T008, and T011 are test-only edits, but they all modify `src/lib/clubs.test.js`, so they stay in story order
- US2 and US3 are not parallel with US1: same service and panel files
- No Edge Function work runs beside this list

---

## Parallel Example: Polish

```bash
# After US1–US3:
Task: "T014 quality gate for src/lib/clubs.js and the admin panel"
Task: "T015 manual-check note in specs/features/011-club-management/quickstart.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate: an admin can create and edit a club; a non-admin cannot

### Incremental Delivery

1. Setup + Foundational → catalogue rules exist in the database
2. User Story 1 → admin can maintain club details (MVP)
3. User Story 2 → deactivate and reactivate without delete
4. User Story 3 → active-only choice set, with no second location model
5. Polish → lint, unit tests, and production build

### Parallel Team Strategy

One implementer should take the stories in order. The shared `clubs` service and panel make splitting US1, US2, and US3 across people cause conflicting edits.

---

## Notes

- Do not apply the migration to the live Supabase project unless the user explicitly asks. T016 is that request; leave it unchecked otherwise
- Do not add a delete API, a group table, a session table, a client home club, or a coach-club roster
- Leave `src/components/layout/Footer.jsx`, `src/pages/ContactPage.jsx`, and `src/pages/TermsPage.jsx` unchanged
- Browser checks in quickstart.md §§4–7 stay with the user. The implementation gate is `npm run lint`, `npm test`, and `npm run build`
