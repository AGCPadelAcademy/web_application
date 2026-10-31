# Tasks: Adult Memberships (F1.09)

**Input**: Design documents from `/specs/features/011-adult-memberships/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/membership-lifecycle.md, contracts/fixed-place-participation.md, quickstart.md

**Tests**: Included. The plan requires Vitest for `src/lib/memberships.js` and SQL assertions for RLS, the 20th cutoff, and `create_membership_charges`.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently. Story numbers map to `spec.md` (US1–US8).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US8 from spec.md (Setup, Foundational, and Polish have no story label)
- Every task names its exact file path

## Path Conventions

- Frontend: `src/` (React SPA)
- Backend: `supabase/migrations/` (SQL). No new Edge Functions
- SQL/RLS tests: `tests/sql/`
- Frontend unit tests: `src/lib/memberships.test.js`

---

## Phase 1: Setup

**Purpose**: Confirm the branch and the migration number before any behavior change

- [ ] T001 Confirm the implementation branch and that `0024` is still free against the remote Supabase project before creating `supabase/migrations/0024_f109_adult_memberships.sql` (local head is `0023`; plan.md migration note)
- [ ] T002 [P] Confirm the quality gate still runs with no new npm packages: `npm run lint`, `npm test`, and `npm run build` (plan.md Technical Context)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, RLS, triggers, charge function, and the fixed-place view that every story uses

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Write `supabase/migrations/0024_f109_adult_memberships.sql` creating `groups`, altering `memberships` with `group_id`, `status`, `monthly_price_amount`, `cancellation_effective_on`, and `updated_at`, and adding `memberships_one_live_per_client_group`, without dropping legacy columns (data-model.md)
- [ ] T004 In `supabase/migrations/0024_f109_adult_memberships.sql`, add RLS `groups_admin_all`, `groups_member_read`, `memberships_admin_all`, `memberships_owner_read`, and `memberships_owner_cancel`, and create `membership_state_events` with admin-read only (data-model.md)
- [ ] T005 In `supabase/migrations/0024_f109_adult_memberships.sql`, add `guard_membership_status_transition()` and `record_membership_state_event()` for T1–T9, the 20th cutoff in `Europe/Zurich`, owner cancel, and the GUC `agc.membership_charge_job` (contracts/membership-lifecycle.md)
- [ ] T006 In `supabase/migrations/0024_f109_adult_memberships.sql`, create `membership_charge_intents` and `create_membership_charges(p_on date)` per research R-14, and schedule it with `pg_cron` at 00:05 `Europe/Zurich` on day 1
- [ ] T007 In `supabase/migrations/0024_f109_adult_memberships.sql`, create security-invoker view `membership_fixed_places` using the Zurich date (contracts/fixed-place-participation.md)
- [ ] T008 [P] Write `tests/sql/0024_f109_adult_memberships.test.sql` asserting the tables, the partial unique index, RLS, the 20th effective date, charge idempotency, the 10% fee, and the fixed-place view (quickstart.md). Do not apply the migration from this task

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Admin creates an adult Membership (Priority: P1) 🎯 MVP

**Goal**: An Admin creates one Pending Payment Membership for one active Client and one active Group, with a monthly price. Invalid and duplicate creates are refused.

**Independent Test**: Create for Client A and the anchor Group. A second live row for the same pair is refused. A missing Client, a deactivated Client, or an inactive Group is refused (spec US1; quickstart Scenarios 1 and 2).

### Tests for User Story 1

- [ ] T009 [P] [US1] Write failing Vitest tests in `src/lib/memberships.test.js` for `createMembership({ clientId, groupId, monthlyPriceAmount })` payload shape and `mapMembershipError()` on duplicate, inactive Group, and RLS denial

### Implementation for User Story 1

- [ ] T010 [US1] Implement `listMemberships`, `createMembership`, and `mapMembershipError` in `src/lib/memberships.js` (plan.md frontend service)
- [ ] T011 [US1] Add `src/components/admin/MembershipManagementPanel.jsx` with the create form (Client, Group, monthly price) and register a Memberships tab in `src/pages/AdminDashboardPage.jsx`

**Checkpoint**: User Story 1 works — one live Membership per Client and Group, price stored, audit row on create

---

## Phase 4: User Story 2 - Admin manually activates a Membership (Priority: P1)

**Goal**: An Admin moves Pending Payment to Active. Invoice issue does not activate.

**Independent Test**: Activate a Pending Payment row. A second actor who is not Admin cannot. No charge intent is created by activation itself (spec US2; quickstart Scenario 1).

### Tests for User Story 2

- [ ] T012 [P] [US2] Extend `src/lib/memberships.test.js` so `activateMembership` sends only the status update and maps an invalid-transition error

### Implementation for User Story 2

- [ ] T013 [US2] Implement `activateMembership` in `src/lib/memberships.js` and the Activate action on `src/components/admin/MembershipManagementPanel.jsx`

**Checkpoint**: Activation is an Admin write and is audited

---

## Phase 5: User Story 6 - Lifecycle transitions are enforced (Priority: P2)

**Goal**: Pause, resume, and expire follow T4–T6 and T9. Invalid pairs do not change state or write an audit row.

**Independent Test**: Pause hides the row from `membership_fixed_places`. Resume restores it. `expired → active` and `active → pending_payment` are refused (spec US6; quickstart Scenarios 4 and 6).

### Tests for User Story 6

- [ ] T014 [P] [US6] Extend `src/lib/memberships.test.js` for `pauseMembership`, `resumeMembership`, and `expireMembership` payloads

### Implementation for User Story 6

- [ ] T015 [US6] Implement `pauseMembership`, `resumeMembership`, and `expireMembership` in `src/lib/memberships.js` and the matching actions on `src/components/admin/MembershipManagementPanel.jsx`

**Checkpoint**: Only the listed transitions succeed

---

## Phase 6: User Story 5 - Client or Admin cancels (Priority: P1)

**Goal**: The owning client or an Admin can cancel. The 20th cutoff sets the effective date. Another client cannot cancel it.

**Independent Test**: Cancel on the 20th and on the 21st in `Europe/Zurich`. The effective dates differ as in quickstart Scenario 5. Client B is denied (spec US5).

### Tests for User Story 5

- [ ] T016 [P] [US5] Extend `src/lib/memberships.test.js` for `cancelMembership` and `cancelMyMembership`

### Implementation for User Story 5

- [ ] T017 [US5] Implement `cancelMembership` and `cancelMyMembership` in `src/lib/memberships.js`
- [ ] T018 [US5] Add the Admin cancel action on `src/components/admin/MembershipManagementPanel.jsx`, showing `cancellation_effective_on`
- [ ] T019 [US5] Add the My Membership section to `src/pages/ProfileManagementPage.jsx` with Group, schedule, monthly price, status, effective date, and cancel for the owner (`fetchMyMemberships` in `src/lib/memberships.js`)

**Checkpoint**: Owner cancel and the 20th date are enforced in the database

---

## Phase 7: User Story 7 - Client sees only their own Membership (Priority: P2)

**Goal**: Client A reads their own row. Client B does not. Coaches have no Membership admin surface.

**Independent Test**: Profile shows only the signed-in client’s rows. A direct read of another client’s id returns nothing (spec US7; quickstart Scenario 3).

### Implementation for User Story 7

- [ ] T020 [US7] Keep `fetchMyMemberships` in `src/lib/memberships.js` on the owner SELECT policy only, and do not add a coach or cross-client query in `src/pages/ProfileManagementPage.jsx`

**Checkpoint**: Owner read matches FR-014. The SQL assertions in T008 cover the denial

---

## Phase 8: User Story 3 - Fixed place contract (Priority: P1)

**Goal**: Publish the participation view. Do not generate Sessions or Bookings.

**Independent Test**: An Active row is in `membership_fixed_places`. Pending Payment, Paused, and Expired are not. Cancelled remains through the effective date (spec US3; contracts/fixed-place-participation.md).

### Implementation for User Story 3

- [ ] T021 [US3] Leave Session generation and Booking out of this feature. Confirm `membership_fixed_places` is the only participation predicate added, in `supabase/migrations/0024_f109_adult_memberships.sql`

**Checkpoint**: The view exists. F1.10 and F1.11 are not implemented here

---

## Phase 9: User Story 4 - One Session cancel does not cancel the Membership (Priority: P1)

**Goal**: This feature does not add a Session-cancel path that writes `memberships.status`.

**Independent Test**: No new UI or SQL in this feature sets a Membership to Cancelled because one Session was cancelled (spec US4).

### Implementation for User Story 4

- [ ] T022 [US4] Do not add Session-cancel writes in `src/lib/memberships.js` or `supabase/migrations/0024_f109_adult_memberships.sql`. Cancellation remains the explicit T3/T7/T8 path only

**Checkpoint**: Membership state changes only through the lifecycle trigger

---

## Phase 10: User Story 8 - Monthly charge on the 1st and the cancel fee (Priority: P1)

**Goal**: On the 1st, Active Memberships get one month intent. An unpaid previous month gets one 10% fee and no new membership month. A late cancel still gets the next month once.

**Independent Test**: quickstart Scenario 7 with CHF 200.00 → fee CHF 20.00, idempotent calls, and `paid_at` left for F1.26.

### Implementation for User Story 8

- [ ] T023 [US8] Keep charge creation inside `create_membership_charges` in `supabase/migrations/0024_f109_adult_memberships.sql`. Do not add a Bexio call, an email, or a client insert of `membership_charge_intents`
- [ ] T024 [US8] Show the monthly price on `src/components/admin/MembershipManagementPanel.jsx` and `src/pages/ProfileManagementPage.jsx`. Do not show a fee editor; the fee is computed by the database

**Checkpoint**: The 1st job matches FR-021 and FR-022. Invoicing stays in F1.26

---

## Phase 11: Polish

**Purpose**: Run the automated gate. Leave live-app checks to the user

- [ ] T025 Run `npm run lint`, `npm test`, and `npm run build` (quickstart.md Automated quality gate)
- [ ] T026 State in the header of `supabase/migrations/0024_f109_adult_memberships.sql` that the file is not applied until an explicit user request. Leave quickstart Scenarios 1–8 for the user in the live app

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — blocks all user stories
- **User Stories (Phases 3–10)**: Depend on Foundational
- **Polish (Phase 11)**: Depends on the stories being completed

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational. MVP.
- **User Story 2 (P1)**: After US1’s create function exists in `src/lib/memberships.js`
- **User Story 6 (P2)**: After US2, same service module
- **User Story 5 (P1)**: After the service module exists. Can follow US2
- **User Story 7 (P2)**: After US5’s profile section
- **User Story 3 (P1)**: Satisfied by the view in Phase 2. The task only confirms no Session generator was added
- **User Story 4 (P1)**: No extra code. Confirm during polish that no Session path writes Membership status
- **User Story 8 (P1)**: Satisfied by `create_membership_charges` in Phase 2. UI tasks only display the price

### Parallel Opportunities

- T002 can run beside T001
- T008 can be written beside T003–T007 and must match the finished migration
- T009 can be written before T010
- T012, T014, and T016 touch the same test file, so run them in that order

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 and Phase 2
2. Complete Phase 3
3. Validate quickstart Scenarios 1 and 2
4. Do not apply the migration unless the user explicitly asks

### Incremental Delivery

1. Setup and foundational schema
2. Admin create and activate
3. Pause, resume, expire
4. Client and Admin cancel with the 20th cutoff
5. Owner-only profile view
6. Confirm the fixed-place view and that Session cancel is out of scope
7. Confirm the 1st charge and the 10% fee with SQL assertions
8. Polish gate

---

## Notes

- Do not send invoices, emails, or Bexio calls from this feature
- Do not implement F1.08 Group CRUD, F1.10 Sessions, F1.11 Booking, or F1.26 collection
- Apply `supabase/migrations/0024_f109_adult_memberships.sql` only after an explicit user request. Confirm the number is still free before applying
- F1.26 reads `membership_charge_intents` and is the only writer of `paid_at`
