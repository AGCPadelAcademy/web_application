# Feature Specification: Roles and Permissions

**Feature Branch**: `006-roles-and-permissions`  
**Created**: 2026-08-19  
**Updated**: 2026-08-25 (F1.02 as implemented on `sdd/008-roles-and-permissions`)  
**Status**: Reverse-engineered as-is **after F1.02**  
**Input**: `profiles.role`, RLS (`is_admin()` / `is_coach()`), `session_roster`, storage policies, Edge Function checks, `ProtectedRoute`

> Reverse spec of **observed** behavior of this codebase after F1.02. Apply migration `0008_f102_roles_and_permissions.sql` on the target Supabase project for the remote schema to match.  
> Forward delta that produced this as-is: [`specs/features/008-roles-and-permissions/spec.md`](../008-roles-and-permissions/spec.md). Do not keep a second living permission matrix in 008 after this refresh.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student owns their data (Priority: P1)

A signed-in user with `profiles.role = student` (the default) can create and see their own bookings and invoice documents, and cannot use admin APIs or other students’ profiles/files. Payment-proof UI is dormant after 007, but its table/storage authorization remains enforced.

**Why this priority**: Almost all live users are students.

**Independent Test**: As a student, SELECT own bookings; INSERT own booking; `/admin/integrations` redirects home; `GET profiles?id=eq.<other>` is empty; `PATCH role` fails; invoice retrieval for another user’s booking returns 403.

**Acceptance Scenarios**:

1. **Given** a new profile, **When** the row is created, **Then** `role` defaults to `student` and CHECK allows `student|coach|accounting|admin`.
2. **Given** `bookings.user_id = auth.uid()`, **When** the student SELECTs/INSERTs/UPDATEs bookings (except `coach_id`), **Then** RLS allows those owner operations.
3. **Given** a student session, **When** `/admin/integrations` is requested, **Then** client navigates to `/`.
4. **Given** a student JWT, **When** an admin-only Bexio action is invoked, **Then** the function returns 403.
5. **Given** student A, **When** they SELECT student B’s profile, booking, or payment-proof object, **Then** no row / storage deny.
6. **Given** any PostgREST JWT, **When** they PATCH `profiles.role`, **Then** the trigger refuses and the row is unchanged.

---

### User Story 2 - Admin is unrestricted operationally (Priority: P1)

A user with `profiles.role = admin` can manage the Bexio integration, inspect operational billing records, assign coaches, and call admin Edge Functions.

**Independent Test**: Set role to admin (out-of-band SQL); open `/admin/integrations`; inspect Bexio state; set `bookings.coach_id` to a coach profile.

**Acceptance Scenarios**:

1. **Given** `profiles.role = admin`, **When** `fetchRole` runs, **Then** `useAuth().role` is `admin`.
2. **Given** admin, **When** `is_admin()` is evaluated in RLS, **Then** admin SELECT/UPDATE policies and admin-only billing reads succeed.
3. **Given** admin JWT, **When** `generate-invoice-pdf` is called for any booking, **Then** ownership-or-admin check passes.
4. **Given** `ProtectedRoute requireAdmin`, **When** role is admin, **Then** `AdminDashboardPage` renders (Bexio integration + Coach assignment tabs).
5. **Given** admin, **When** they set `coach_id` to a profile with `role = coach`, **Then** the assignment succeeds; setting it to a student fails.

---

### User Story 3 - Coach sees assigned-session participants only (Priority: P1)

A user with `profiles.role = coach` signs in like any user and sees only operational roster rows for bookings assigned to them.

**Independent Test**: Assign coach C to occurrence A only; C’s `/coach/roster` lists A not B; `/admin/integrations` redirects; admin-only billing actions return 403.

**Acceptance Scenarios**:

1. **Given** coach C assigned to booking A, **When** they open `/coach/roster` or SELECT `session_roster`, **Then** they see A’s participant name, lesson, date, and time — not price, payment, or email.
2. **Given** coach C, **When** they SELECT another student’s `bookings` row, **Then** RLS returns no row.
3. **Given** admin clears `coach_id` on A, **When** C refreshes the roster, **Then** A is gone.
4. **Given** coach C, **When** they open `/admin/integrations`, **Then** the client navigates to `/`.

---

### User Story 4 - Anonymous visitors see only non-PII availability (Priority: P2)

Unsigned visitors can read the lesson catalogue and `booking_slots`, not booking or profile PII.

**Independent Test**: Signed out, `/lessons` grid loads; direct `bookings` or `profiles` SELECT as anon fails.

**Acceptance Scenarios**:

1. **Given** anon, **When** `lessons` and `booking_slots` are selected, **Then** public policies allow it.
2. **Given** anon, **When** `bookings` or `profiles` SELECT is attempted, **Then** policies deny it.

---

### Edge Cases

- `ProtectedRoute` documents that it is **not** a security boundary. `/coach/roster` uses `allowedRoles={['coach']}` (admin still bypasses). `/admin/integrations` uses `requireAdmin`; the legacy `/admin/payment-verification` path redirects there.
- `fetchRole` errors default to `student` (fail-closed on the client). Session loading stays true until role is resolved.
- `accounting` passes the CHECK and is treated as a non-admin authenticated user: no roster rows, no admin UI, role PATCH still denied.
- Role promotion to coach or admin remains out-of-band SQL.
- `availability.trainer_id` is not assignment.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Canonical authorization attribute MUST be `profiles.role` with CHECK `student | coach | accounting | admin` and default `student`.
- **FR-002**: Student ownership of a booking MUST be `bookings.user_id = auth.uid()`.
- **FR-003**: Admin MUST be `profiles.role = admin`. Client `/admin/integrations` uses `ProtectedRoute requireAdmin`. Server uses `is_admin()` and EF role checks. PostgREST MUST NOT change `role` (out-of-band SQL only).
- **FR-004**: Unauthenticated access to `/profile`, `/payments`, `/admin/*`, `/coach/*` MUST redirect to `/login`. Anon MUST NOT read profile PII.
- **FR-005**: Non-admin authenticated users MUST be redirected to `/` from `/admin/integrations`.
- **FR-006**: `/admin` and legacy `/admin/payment-verification` MUST redirect to `/admin/integrations`.
- **FR-007**: Anonymous PII MUST NOT be readable from `bookings`; public occupancy is `booking_slots` only.
- **FR-008**: `is_admin()` and `is_coach()` MUST be executable by the roles that evaluate RLS.
- **FR-009**: The SPA MUST read role via `useAuth().role` (`fetchRole` on session).
- **FR-010**: Coach MUST see only assigned-session participants via `session_roster` (name / lesson / date / time). Coaches MUST NOT SELECT other students’ financial `bookings` columns or use admin/finance Edge Functions.
- **FR-011**: Admin MUST assign or clear `bookings.coach_id` targeting a `profiles.role = coach` row. Non-admins MUST NOT change `coach_id`.
- **FR-012**: `payment-proofs` storage objects MUST be readable/insertable by the booking owner or admin, using the first path segment as `bookings.id`.
- **FR-013**: `accounting` MUST remain unused (no roster, no admin tools).

### Key Entities

- **Profile.role** — single role per user.
- **is_admin() / is_coach()** — SQL helpers.
- **bookings.coach_id** — assignment (nullable FK).
- **session_roster** — operational view.
- **ProtectedRoute** — client UX guard.

---

## Success Criteria *(mandatory)*

- **SC-001**: Students cannot read or mutate another user’s profile, bookings, proofs, or proof files, and cannot change `role`.
- **SC-002**: Admins can manage Bexio and coach assignment without using the student’s account.
- **SC-003**: A coach assigned only to occurrence A sees A’s participant on the roster and not occurrence B.
- **SC-004**: Coaches cannot manage Bexio or retrieve another student’s invoice.
- **SC-005**: Anonymous visitors can use `/lessons` without seeing who booked a slot or profile emails.
- **SC-006**: Removing `ProtectedRoute` would still leave RLS/EF blocking unauthorized writes.

---

## Data impact

- **Read:** `profiles.role` (own row, or any row if admin); coaches read `session_roster`.
- **Write:** SPA profile forms never send `role`. Admin assignment writes `bookings.coach_id`. Role changes are out-of-band SQL.
- **Policies:** `specs/baseline-system/supabase-backend.md` §5 (after `0008`).

---

## Auth / security impact

Live matrix (after `0008`):

| Action | student | admin | coach | accounting | anon |
|---|---|---|---|---|---|
| Book lesson / own bookings | yes | yes | own only | own only | no |
| `/payments` invoices | own | own view + admin APIs | own only | own only | no |
| `/admin/integrations` | redirect `/` | yes | redirect `/` | redirect `/` | `/login` |
| `/coach/roster` | redirect `/` | yes (bypass) | assigned roster | redirect `/` | `/login` |
| `session_roster` | empty | all operational | assigned | empty | none |
| Change `profiles.role` via PostgREST | no | no | no | no | no |
| Change `bookings.coach_id` | no | yes (coach target) | no | no | no |
| `generate-invoice-pdf` | own booking | any | 403 unless own | 403 unless own | 401 |
| Admin-only Bexio actions | 403 | yes | 403 | 403 | 401 |
| `booking_slots` | yes | yes | yes | yes | yes |
| Public `profiles` SELECT | no | own-or-admin | own | own | no |

`ProtectedRoute` is UX. Authorization for writes is RLS + EF.

---

## UI impact

- `ProtectedRoute` on `/profile`, `/payments`, `/admin/integrations`, `/coach/roster`.
- Header: profile, payments, sign out; **Session roster** when `role === 'coach'`. Still no admin Header link.
- Admin Dashboard: Bexio integration + Coach assignment tabs.

---

## Non-goals

- Coach calendars, class scheduler, or accounting dashboards.
- JWT custom claims or a roles table.
- Multi-tenant academies.
- Granting coaches SELECT on `bookings`.
- Using `availability.trainer_id` as assignment.

---

## Known gaps

- `invoices` / `invoice_counters` remain service-role-only (no client policies).
- Permissive `payment_proofs` service-role-on-public policy (`supabase-backend.md` Advisor) is unchanged by F1.02.
- No admin nav in Header.
- `0008` must be applied on the target project; until then production still has public `profiles` SELECT.

---

## Assumptions

- One role per user is enough.
- Role changes happen outside the SPA and take effect on next `fetchRole`.
- Session occurrence is the current `bookings` row until a later class-assignment feature.

---

## Baseline coverage

| ID | Covered? |
|---|---|
| ACT-001 … ACT-005 | Yes |
| XR-003, XR-004 | Yes (public profiles SELECT closed by `0008`) |
| FEAT-ADM-001 | Route + admin actor (panel behavior is 004 + coach assignment) |
| FEAT-PUB-005 | Yes |
| Coach roster | F1.02 / FR-010 |
