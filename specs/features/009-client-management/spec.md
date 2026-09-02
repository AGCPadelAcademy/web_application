# Feature Specification: Client Management (F1.04)

**Feature Branch**: `009-client-management`

**Created**: 2026-09-02

**Status**: Draft

**Input**: GitHub issue #9 — F1.04 Gestión de clientes (Notion F1.03). Complete client profile management for AGC Padel Academy: students maintain permitted profile information; admins manage client profiles and academy-controlled data; coaches see only clients in their assigned sessions. Reuse existing authentication and the existing profile — do not create a second user system.

> **Forward spec (delta).** Living as-is for signup, own-profile edit, and the billing completeness gate remains [`specs/features/005-auth-and-profile-completion/spec.md`](../005-auth-and-profile-completion/spec.md). Living as-is for roles and coach roster remains [`specs/features/006-roles-and-permissions/spec.md`](../006-roles-and-permissions/spec.md). This file states only what F1.04 adds or tightens.
>
> GitHub feature ID is **F1.04** (Bexio took F1.03). Original Notion page remains F1.03. Spec folder follows sequential numbering under `specs/features/` (`009-client-management`), not the Notion path `specs/phase-1/F1.03-client-management/`.

---

## Gap analysis (current → target)

Inspected: reverse specs `005`/`006`, F1.02 delta `008`, domain model, baseline backend snapshot, live profile form, admin dashboard, and schema. Confirmed unless marked assumption.

| F1.04 rule | Current (`005` + `006` + `008`) | This spec |
|---|---|---|
| One profile per authenticated user; no second user system | Profile is 1:1 with the login identity. Signup creates the profile. There is no separate Client entity. | **Reuse.** Do not add a second identity or a parallel client table. |
| Student views and edits own permitted fields | `/profile` shows and saves first name, last name, phone, and address fields. Email is visible and not writable. Role is not on the form. | **Keep** those edits. Add date of birth as an optional student-editable field. Students still cannot change email. |
| Student cannot change role or academy-controlled data | Role change via the application is already refused for everyone. No official academy level or profile status exists. Students cannot read another profile. | **Keep** role self-service refusal. Add profile status (active/inactive) as academy-controlled. Official academy level, Playtomic level, memberships, groups, and attendance stay **out of this slice** (F1.05 and later features); the write-protection pattern this spec adds MUST apply to those fields when they arrive. |
| Admin unrestricted client management | Admin can **read** any profile. Admin **cannot** update another person’s profile (update is own-row only). No client list or client-edit screen. Role changes are out-of-band. | **Add** an admin client directory: list, view, edit any client’s permitted and academy-controlled fields, activate/deactivate, and assign another person’s application role. Admin still cannot change **their own** role through this interface. |
| Admin creates clients | Profiles are created only when a person signs up. | **Do not add** admin-created logins or invite-by-email. “Where supported by the existing architecture” is: not supported without a new identity-provisioning flow. Clients continue to register themselves (`005`). |
| Coach sees assigned-session clients only | Coach sees an operational roster (participant name, lesson, date, time) for assigned session occurrences. Coach cannot open another person’s full profile. | **Keep** roster as the coach entry point. **Add** a permitted operational view of an assigned participant (identity + phone for session coordination). Coach cannot see unrelated clients, cannot see billing/address/email/role/status/date of birth, and cannot change another client’s profile. |
| Activate / deactivate | No profile status. Deleting a profile would threaten historical bookings (bookings require a profile). | **Add** a non-destructive active/inactive status. Deactivation MUST NOT delete the login identity, the profile, or historical bookings, invoices, or other domain records. |
| Field-level authorization enforced on the server | Student form omits role; server also refuses role changes. Other academy-controlled fields do not exist. Admin cannot write another profile at all. | **Add** server-side field rules: students write only client-controlled fields on **their own** active profile; admins write client-controlled and academy-controlled fields on any profile (except their own role); coaches write none of another client’s fields. Hiding a field on screen is not sufficient. |

**Does not replace** `005` (signup, session, own billing profile, completeness gate) or `006`/`008` (role matrix, student isolation, coach assignment, roster). Those journeys stay in force except the admin-write and coach-view expansions above.

---

## User Scenarios & Testing *(mandatory)*

Existing `005` stories (register, sign in, own profile, completeness before booking) and `006` stories (student isolation, admin operational access, coach roster) **remain in force**. Tests below cover only what F1.04 changes.

### User Story 1 - Student maintains their own permitted profile (Priority: P1)

An authenticated student opens their profile, sees their own information (including email, which they cannot change), and updates the fields the academy allows them to edit. They cannot open another student’s profile, and they cannot change their role, active/inactive status, or other academy-controlled information — including by bypassing the screen.

**Why this priority**: Every student already depends on own-profile edit for booking and invoicing. F1.04 must preserve that path while making the permission split explicit and enforceable.

**Independent Test**: As student A, view and save permitted fields (including date of birth). Attempt student B’s profile. Attempt to change own role or status. Only A’s permitted fields succeed.

**Acceptance Scenarios**:

1. **Given** an authenticated student, **When** they open their profile, **Then** they see their own permitted information (name, email, phone, address, date of birth, and role/status as read-only).
2. **Given** an authenticated student with an active profile, **When** they save a permitted field (first name, last name, phone, address, postal code, city, country, or date of birth), **Then** the change is stored and shown again on the next visit.
3. **Given** an authenticated student, **When** they try to change their email, role, or active/inactive status, **Then** the change is refused and the stored values are unchanged.
4. **Given** student A, **When** they request student B’s profile (including by using B’s identifier directly), **Then** access is denied.
5. **Given** an existing signed-in student from before this feature, **When** they open their profile, **Then** the same login still works and their existing profile data is still theirs.

---

### User Story 2 - Admin manages client profiles (Priority: P1)

An admin opens a client directory, finds any client, views the information needed to run the academy, updates both personal and academy-controlled fields, and assigns that client’s application role. The admin does this without impersonating the client and without creating a second user system.

**Why this priority**: This is the missing operational capability. Today an admin can read profiles but cannot manage them from the product.

**Independent Test**: As admin, list clients, edit student A’s phone and status, set student B’s role to coach. As student A, confirm the phone change. Confirm the admin’s own role cannot be changed from this screen. Confirm a student cannot open the directory.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they open client management, **Then** they can list and open any client profile.
2. **Given** an authenticated admin, **When** they change a client’s permitted personal fields, **Then** the changes are stored and that client sees them on their own profile.
3. **Given** an authenticated admin, **When** they assign another person’s application role (student, coach, or admin), **Then** the new role is the one used for subsequent authorization (`006` / F1.02).
4. **Given** an authenticated admin, **When** they attempt to change **their own** role through client management, **Then** the change is refused.
5. **Given** a student or coach, **When** they request the admin client directory or another user’s profile by identifier, **Then** access is denied.
6. **Given** an admin, **When** they manage clients, **Then** they do so against the existing profile of each authenticated user — no second client record is created.

---

### User Story 3 - Admin activates and deactivates a client without losing history (Priority: P1)

An admin marks a client inactive when that person should no longer use normal student operations (new bookings, profile edits). The person remains the same client: past bookings, invoices, and other domain records stay attached and remain visible to the admin. The admin can reactivate the client later.

**Why this priority**: Deactivation is an explicit F1.04 acceptance criterion and is the only safe alternative to deleting a client (deletion would break history).

**Independent Test**: Deactivate student A. A can still sign in and see past bookings/invoices but cannot book or edit their profile. Historical booking still names A. Reactivate A; booking and profile edit work again. No domain record disappeared.

**Acceptance Scenarios**:

1. **Given** an admin and an active client, **When** the admin deactivates that client, **Then** the client can no longer create a new booking or update their profile.
2. **Given** a deactivated client, **When** they sign in, **Then** they can still view their own profile (read-only) and their existing bookings and invoices; they are not treated as a different person.
3. **Given** a deactivated client with past bookings, **When** anyone authorized inspects those bookings, **Then** the records still belong to that client and have not been deleted or reassigned.
4. **Given** a deactivated client, **When** an admin reactivates them, **Then** normal student operations (profile edit, new booking subject to existing completeness rules) work again.
5. **Given** any deactivation, **When** it completes, **Then** the login identity and the profile still exist; deactivation is not a delete.

---

### User Story 4 - Coach sees only assigned-session participants (Priority: P2)

A coach continues to use assigned-session access from F1.02. For a participant of a session assigned to them, they can see the operational client information needed to run that session (who it is, how to reach them by phone). They cannot open or search the full client directory, cannot see unrelated clients, and cannot change another client’s data.

**Why this priority**: F1.04 requires coach access to be resource-scoped. F1.02 already delivered the assignment/roster spine; this story only extends the permitted participant view and restates the denial path.

**Independent Test**: Coach assigned to occurrence A only. Coach sees A’s participant identity and phone. Coach cannot open client B (not in A). Coach cannot change A’s profile. Remove the assignment; A’s client details disappear for that coach.

**Acceptance Scenarios**:

1. **Given** a coach assigned to session occurrence A, **When** they open the participant in A, **Then** they see the permitted operational information (identity and phone) for that client.
2. **Given** a coach assigned to A and not B, **When** they request client B’s profile or the admin client directory, **Then** access is denied.
3. **Given** a coach, **When** they attempt to change a participant’s profile, role, or status, **Then** the change is refused.
4. **Given** an admin removes the coach from occurrence A, **When** the coach next requests that participant, **Then** access is denied.

---

### Edge Cases

- A deactivated student who already started a booking form cannot complete a new booking; existing unpaid or paid bookings stay as they are (cancellation remains a later feature).
- Deactivation does not sign the person out immediately if they already have a session; the next student mutation (save profile, create booking) is refused, and the profile screen becomes read-only on refresh.
- An incomplete deactivated profile does not become “complete” by deactivation; on reactivation the existing completeness gate (`005`) still applies before booking.
- Admin can edit a deactivated client’s fields (for example to correct a phone number) without having to reactivate first.
- Date of birth may be empty; emptiness does not block profile completeness for booking (completeness stays the existing billing fields from `005`).
- `accounting` remains a stored role with no extra client-management powers (`006`). An admin may assign it; the person still cannot use admin client management or coach participant views.
- The last remaining admin cannot be demoted or deactivated through client management if that would leave the academy with zero admins.
- A coach who is also a student on their own booking keeps their own-profile rights; that does not grant other clients’ profiles.
- Anonymous visitors still cannot read profiles (`006`).
- Groups, class placement, attendance, memberships, and a dedicated level catalog do not exist yet; coach “assigned session” means today’s F1.02 assigned lesson reservation until those features land.

---

## Requirements *(mandatory)*

`005` FR-012/FR-013 (own billing profile, email not writable, completeness gate) and `006` FR-001–FR-013 (role, isolation, admin actor, coach roster) stay in force unless tightened below.

### Functional Requirements

- **FR-001**: A client MUST be the existing application profile of an authenticated user. The system MUST NOT introduce a second login system or a duplicate client record for the same person.
- **FR-002**: A student MUST be able to view their own profile information. A student MUST NOT view or change another client’s profile, including by supplying another identifier.
- **FR-003**: An active student MUST be able to update only **client-controlled** fields on their own profile: first name, last name, phone, address, postal code, city, country, and date of birth. Email MUST remain visible and not student-writable (owned by the login identity).
- **FR-004**: A student MUST NOT change **academy-controlled** fields: application role, active/inactive status, official academy level, membership, group assignment, or attendance. When those fields do not yet exist in the product, the server MUST still refuse student writes to them if they are introduced later under the same names/meanings.
- **FR-005**: An admin MUST be able to list, view, and update any client profile without impersonating that client.
- **FR-006**: An admin MUST be able to update both client-controlled fields and academy-controlled fields that exist in this slice (role and active/inactive status) on another person’s profile.
- **FR-007**: An admin MUST be able to assign or change another person’s application role among the live F1.02 values. A user MUST NOT change their own role. Client management MUST refuse an action that would leave the academy with zero admins.
- **FR-008**: An admin MUST be able to deactivate and reactivate a client. Deactivation MUST NOT delete the login identity, the profile, or historical bookings, invoices, or other domain records attached to that client. Those records MUST remain traceable to the same client.
- **FR-009**: A deactivated client MAY sign in and MUST be able to view their own profile and existing bookings/invoices. A deactivated client MUST NOT create a new booking, MUST NOT update their profile, and MUST NOT use other normal student self-service mutations. Reactivation restores those operations subject to existing rules (including profile completeness before booking).
- **FR-010**: A coach MUST access only participants of session occurrences assigned to them (F1.02 assignment). Permitted coach information is operational: participant identity and phone. A coach MUST NOT access unrelated clients, MUST NOT use admin client management, and MUST NOT change another client’s profile, role, or status.
- **FR-011**: Authorization for FR-002–FR-010 MUST be enforced on the server. Removing or bypassing a screen MUST NOT grant extra access. Direct identifier manipulation MUST be denied the same way as a hidden button.
- **FR-012**: Existing signup, sign-in, password recovery, and own-profile billing flows (`005`) MUST continue to work for already-authenticated users. New profile fields MUST be additive and optional so incomplete existing profiles remain valid.
- **FR-013**: This feature MUST NOT provision new logins on behalf of an admin. New clients continue to create their own authenticated account through the existing registration flow.
- **FR-014**: Official academy level, declared level, Playtomic level, level history, groups, memberships, attendance, recoveries, and class assignment are **not** delivered here. This feature MUST leave the profile as the single client reference those features will attach to, and MUST NOT duplicate user identity into those later records.

### Key Entities

- **Login identity** — the authenticated user. Owned by the existing sign-in system. Not duplicated.
- **Client profile** — the application profile already attached 1:1 to that login identity. Holds contact/billing details, date of birth, application role, and active/inactive status. This **is** the client; there is no separate Client entity.
- **Client-controlled fields** — first name, last name, phone, address, postal code, city, country, date of birth. Editable by the owning student when active, and by an admin at any time.
- **Academy-controlled fields (this slice)** — application role; active/inactive status. Editable only by an admin (and never the admin’s own role via this feature).
- **Academy-controlled fields (later features)** — official academy level (F1.05), membership, group assignment, attendance. Named here so field-level rules stay consistent; not implemented in this spec.
- **Session occurrence / assignment / participant** — as in F1.02: until class placement exists, the lesson reservation and its assigned coach. Coach client access is granted only through that assignment.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of student attempts to read or change another client’s profile (including after bypassing the screen) are denied; the student’s own permitted-field save still succeeds on an active profile.
- **SC-002**: 100% of student attempts to change their own role or active/inactive status are denied; stored values are unchanged.
- **SC-003**: An admin can open the client directory, change another client’s personal fields, and see those values on that client’s own profile in the same session of testing.
- **SC-004**: An admin can deactivate a client and, in the same check, confirm (a) the client cannot complete a new booking or profile save, (b) at least one pre-existing booking or invoice is still attached to that client, and (c) reactivation restores profile save.
- **SC-005**: A coach assigned only to occurrence A retrieves permitted information for A’s participant and is denied for a client who is not in A; after assignment removal, A’s participant is also denied.
- **SC-006**: 100% of non-admin attempts to open admin client management or to change another person’s role are denied.
- **SC-007**: Existing students can still sign in and complete their own profile using the pre-existing billing fields; introducing this feature does not require them to re-register.
- **SC-008**: An admin can complete the primary client-management tasks (find a client, edit permitted fields, toggle status) without impersonating that client, in under 3 minutes once they are signed in.

---

## Assumptions

- The existing profile **is** the client. A dedicated Client table would duplicate `005`/`006` and is out of scope.
- Client-controlled fields start from what students already edit (`005`) plus date of birth (listed in F1.04 and absent today). Email stays login-owned and read-only for students.
- Date of birth is optional and is **not** added to the booking completeness rule. Completeness remains the existing billing set in `005`.
- Official academy level, Playtomic, and declared level belong to **F1.05**. Memberships, groups, attendance, recoveries, and class assignment belong to later features. F1.04 only guarantees the profile remains the attachment point and that students cannot write academy-controlled attributes.
- Admin “create client” is not a new invite/provisioning flow. New people still register themselves.
- Deactivation is a status, not a delete and not a login ban. The person can still sign in to see history; they cannot perform new student operations. This matches “historical records remain associated” and “can no longer perform normal authenticated client operations.”
- Data retention: the constitution already forbids deleting functionality or records unless explicitly instructed. This spec does not add a right-to-erasure workflow; it forbids cascade delete on deactivation.
- Role assignment through admin client management is an intentional delta versus F1.02’s current “out-of-band SQL only” practice. F1.02’s rule that a user cannot change **their own** role remains.
- Coach permitted fields are identity + phone. Address, email, date of birth, role, status, and billing stay out of the coach view. Official level, when F1.05 adds it, is expected to join that permitted coach view — not this spec’s delivery.
- “Assigned session” remains F1.02’s assigned lesson reservation until a later class/group feature redefines session.
- Swiss personal data (name, email, phone, address, date of birth) stays limited to people who have a business need: the owner, admins, and (for identity + phone only) the assigned coach.

---

## Non-goals

- A second authentication system, identity provider, or parallel client table.
- Admin invite, “create login for this person,” or password set-on-behalf.
- Changing a person’s login email from the application (still `005` non-goal).
- Official academy level catalog, Playtomic import, declared level, or level history (F1.05).
- Memberships, groups, clubs, attendance, recoveries, waitlist, or class assignment.
- Hard-deleting a client or an automated privacy-erasure workflow.
- Coach calendars, coach edit of client data, or coach access to billing.
- Rebuilding signup, booking, invoicing, or Bexio flows.

---

## Compatibility

- Preserve `005` student profile edit and completeness-before-booking.
- Preserve `006`/`008` student isolation, admin operational access, coach assignment, and roster. This spec **adds** admin writes to other profiles, profile status, date of birth, admin role assignment for **other** users, and a permitted coach view of assigned participants’ phone.
- Preserve F1.02: hiding a screen is not authorization; server-side rules decide.
- Do not cascade-delete bookings, invoices, billing contacts, or other history when a profile is deactivated.
- Additive fields only; existing nullable contact/address columns stay nullable.

---

## Baseline coverage

| ID | Covered? |
|---|---|
| FEAT-PRF-001 … FEAT-PRF-004 | Preserved (`005`); this spec extends who may edit and adds status/DOB |
| FEAT-AUTH-010 | Preserved — profile still 1:1 with login identity |
| ACT-001 … ACT-005 | Preserved; FR-007 lets an admin change **another** person’s role |
| XR-003 | Tightened — field-level and deactivation rules must hold without the UI |

---

## Open questions

None blocking. Defaults are in Assumptions. Use `/speckit-clarify` if the academy wants a different deactivation policy (for example: block sign-in entirely), admin-provisioned accounts, or a wider coach field set.
