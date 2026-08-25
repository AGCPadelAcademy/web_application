# Feature Specification: Roles and Permissions (F1.02)

**Feature Branch**: `008-roles-and-permissions`

**Created**: 2026-08-24

**Status**: Implemented on `sdd/008-roles-and-permissions` (pending remote apply of `0008`)

**Input**: F1.02 — three live roles (Admin, Student, Coach); Admin unrestricted; Students only authorized resources; Coaches only participants of sessions assigned to them; reuse existing auth and profile role (no roles table); server-side authorization; preserve brownfield behavior unless these rules change it.

> **Forward spec (delta).** Living as-is after this ships is [`specs/features/006-roles-and-permissions/spec.md`](../006-roles-and-permissions/spec.md) (refreshed 2026-08-25). This file remains the F1.02 change record.

---

## Gap analysis (current → target)

Inspected: reverse spec `006`, live schema/policies/roles (2026-08-24), and the running SPA/Edge Functions.

| F1.02 rule | Current (`006` + live) | This spec |
|---|---|---|
| Three live roles; no roles table | Profile role already exists. Live actors: Student, Admin. `coach` is CHECK-only (0 rows). JWT claims / join table already rejected. | **Reuse** the profile role. **Activate Coach.** Do not add a roles table. |
| Admin unrestricted | Admin already bypasses student ownership for bookings/proofs and admin workflows. | **Keep.** Extend the same unrestricted operational access to coach assignments and assigned-session data. Not browser access to secrets or counters. |
| Students only authorized resources | Own bookings/proofs **table** rows: yes. **Gaps:** anyone can read every profile; a user can change their own role on the server; payment-proof **files** are not owner-scoped. `006` was **stale** claiming proof-table INSERT had no owner check — live INSERT is already owner-scoped. | **Close the three leaks.** Do not rebuild owner booking/proof-table rules. |
| Coaches → assigned session participants only | No assignment, no coach access rules. Unused trainer availability is **not** this rule. | **Add** assignment + scoped participant access. |
| Coach auth via existing profiles | Already how every user signs in (`005`). | **Reuse.** |
| `accounting` | Fourth CHECK value; not a live actor (`006` FR-010). | **Leave unused.** Do not give it admin or coach powers. |

**Supersedes** baseline decision 2026-08-19 that Coach stays schema-only. Accounting stays schema-only.

Until `class-assignment` exists, a **session occurrence** is today’s lesson reservation (booking). Trainer availability windows stay out of scope.

---

## User Scenarios & Testing *(mandatory)*

Existing `006` stories (student owns their data, admin payment verification, anonymous non-PII occupancy) **remain in force**. Tests below cover only what F1.02 changes.

### User Story 1 - Student isolation leaks are closed (Priority: P1)

A Student still uses their own profile, bookings, and payments (`006` US1). They cannot read another person’s profile or payment files, and they cannot make themselves Admin or Coach.

**Why this priority**: F1.02’s student rule is already the product promise; it is not true until these leaks are gone.

**Independent Test**: As student A, complete own profile/payments. Attempt another student’s profile and payment files (including by bypassing the screen). Attempt to set own role to admin. Only A’s own records succeed.

**Acceptance Scenarios**:

1. **Given** student A, **When** they use existing own-profile / own-payments / own-booking flows, **Then** those `006`/`001`–`005` journeys still succeed.
2. **Given** student A, **When** they request student B’s profile, reservation, or payment-proof file, **Then** access is denied.
3. **Given** a Student, **When** they attempt to change their role, **Then** the change is refused.
4. **Given** an anonymous visitor, **When** they use the public lesson grid, **Then** occupancy remains non-identifying (XR-004) and profiles are not readable.

---

### User Story 2 - Coach sees only assigned-session participants (Priority: P1)

A Coach signs in like any other user. An Admin assigns them to some session occurrences. The Coach can see who is taking part in those occurrences only — not other students, not payment documents, not admin tools.

**Why this priority**: This capability does not exist today.

**Independent Test**: Role set to Coach out-of-band (same pattern as Admin today). Assign to occurrence A only. Coach lists participants of A, not B; cannot open payment verification or another student’s invoices/proofs. Remove the assignment → A’s participants disappear.

**Acceptance Scenarios**:

1. **Given** a Coach, **When** they sign in, **Then** they use the existing account/profile — no separate coach login.
2. **Given** a Coach assigned to A and not B, **When** they view participants, **Then** they see only A.
3. **Given** a Coach with no assignments, **When** they view participants, **Then** they see none.
4. **Given** a Coach, **When** they request admin payment verification, billing connection, or another student’s payments/invoices/proofs, **Then** access is denied.
5. **Given** an Admin, **When** they assign or remove a Coach on an occurrence, **Then** that is what grants or revokes participant access; the Admin can still see any student’s and any coach’s operational records.

---

### Edge Cases

- Stored role `accounting`: still non-admin, no coach participant access, no new product (`006`).
- Client role-load failure: admin/coach screens stay hidden (`006`); server still decides data access.
- Coach who personally owns a reservation keeps **own** student-style records; that does not grant others’ financial records.
- Assignment removal takes effect on the next access; no leftover participant list.
- Admin can still use student self-service for their own account (`006`).

---

## Requirements *(mandatory)*

`006` FR-001–FR-009 (profile role, student ownership, admin actor, login redirects, non-PII occupancy) stay in force unless tightened below.

### Functional Requirements

- **FR-001**: Live product roles MUST be Admin, Student, and Coach on the existing profile role. The system MUST NOT add a dedicated roles table.
- **FR-002**: The unused `accounting` allowed value MUST stay non-live: no admin tools, no coach participant access.
- **FR-003**: A user MUST NOT change their own role. Role changes remain administrator/out-of-band actions (as Admin assignment works today).
- **FR-004**: A Student MUST NOT read or change another user’s profile, reservations, payment-proof records, or payment-proof files. Anonymous visitors MUST NOT read profiles.
- **FR-005**: Admin MUST NOT be limited by student ownership or coach assignment for operational academy data (profiles, reservations, proofs, invoices already exposed to admins, and coach assignments). Existing admin-only workflows stay Admin-only. Secrets and numbering counters stay non-user-facing.
- **FR-006**: A Coach MUST authenticate through the existing sign-in and profile (`005`).
- **FR-007**: The system MUST persist which Coach is assigned to which session occurrence. An Admin MUST be able to assign and remove that link. Unused trainer-availability windows MUST NOT be this assignment.
- **FR-008**: A Coach MUST access only participants of occurrences assigned to them. Participant access is the operational roster (who is taking part, lesson/date/time) — not proofs, invoices, verification notes, or billing records.
- **FR-009**: Authorization for these rules MUST hold server-side (and with row-level rules where the client reads or writes data). Hiding a screen is not sufficient (XR-003).

### Key Entities

- **Profile role** — existing; see `006`. Not a roles catalog.
- **Session occurrence** — until class placement exists: the existing lesson reservation.
- **Coach assignment** — new. The only grant of Coach participant access.
- **Participant** — the Student on that occurrence.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Student attempts to read another student’s profile, reservation, or payment-proof file (including after bypassing the screen) are denied; own profile/payments still complete.
- **SC-002**: 100% of non-admin attempts to change their own role to Admin or Coach are denied.
- **SC-003**: A Coach assigned only to occurrence A lists every participant of A and zero of B in the same check; after assignment removal, A’s participants are inaccessible.
- **SC-004**: A Coach cannot complete admin payment verification or billing-connection actions.
- **SC-005**: An Admin can still complete payment verification and can view any student’s and any assigned coach’s operational records without impersonating them.
- **SC-006**: Anonymous visitors can still use the public lesson grid without seeing who occupies a slot.

---

## Assumptions

- F1.02 is the authorization layer, not `class-assignment`, memberships/credits, or a coach calendar/attendance product.
- Coach access is operational (roster), not financial.
- Role assignment stays out-of-band; this spec requires the server to refuse self-service role changes. A minimal admin control to assign coaches to occurrences is in scope only so the permission can be exercised.
- Student UPDATE of their **own** reservation (proof-upload bookkeeping) is not narrowed except impersonation, role change, or another user’s records.
- “Admin unrestricted” does not add a contact inbox or other baseline out-of-capability products.

---

## Non-goals

- Roles table, login-token claims as the live role source.
- Accounting product or treating `accounting` as Admin.
- Class placement, coach availability UI, cancel-reservation, invoice-lifecycle.
- Rebuilding `001`–`007` student/admin journeys.
- Unrelated security-advisor items (leaked-password setting, function `search_path`) except the leaks in FR-003/FR-004.

---

## Compatibility

- Reverse spec `006` was refreshed 2026-08-25 to this F1.02 as-is. Keep the living matrix in `006`, not a second copy here.
- Preserve `001`–`007` student and admin journeys except the tightenings in FR-003 and FR-004.
- Remote schema matches this spec only after `0008_f102_roles_and_permissions.sql` is applied.
