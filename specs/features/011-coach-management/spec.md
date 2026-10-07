# Feature Specification: Coach Management (F1.06)

**Feature Branch**: `cursor/coach-management-f991`

**Created**: 2026-10-05

**Status**: Draft

**Input**: GitHub issue #11 — F1.06 Gestión de entrenadores. Complete Coach management on the existing authenticated profile: admins create and manage Coach profiles and activate or deactivate Coaches; Coaches see their own permitted profile and only the sessions and participants assigned to them; the model stays ready for Group and Session assignment without a second Coach entity. Payroll is out of Phase 1.

> **Forward spec (delta).** Living as-is for signup and own-profile remains [`005-auth-and-profile-completion`](../005-auth-and-profile-completion/spec.md). Living as-is for roles, session assignment, and the operational roster remains [`006-roles-and-permissions`](../006-roles-and-permissions/spec.md) and [`008-roles-and-permissions`](../008-roles-and-permissions/spec.md) (F1.02). Living as-is for profile status, admin role assignment, and the permitted participant view remains [`009-client-management`](../009-client-management/spec.md) (F1.04). This file states only what F1.06 adds or tightens.
>
> GitHub feature ID is **F1.06**. Spec folder follows sequential numbering under `specs/features/` (`011-coach-management`).

---

## Gap analysis (current → target)

Inspected: issue #11, reverse spec `006`, forward specs `008` and `009`, domain model, and the live coach-assignment and client-management behavior. Confirmed unless marked assumption.

| F1.06 rule | Current (`005` + `006` + `008` + `009`) | This spec |
|---|---|---|
| A Coach is an authenticated person with an application profile. No second Coach entity. | Every user, including a Coach, is one profile tied to one login. Role `coach` already exists. Two Coach profiles already exist and need no migration. | **Reuse.** Do not add a parallel Coach account, payroll record, or assignment system. |
| Admin creates or promotes a Coach | An admin can change another person’s role to `coach` from client management. There is no Coach-specific list. A non-admin cannot change roles. New logins are still self-registration only. | **Keep** promotion of an existing person as the way a Coach is created. **Add** a Coach directory: list, view, and update people who are Coaches. **Do not add** admin-issued logins or invites. |
| Admin updates Coach profile and active status | An admin can edit another person’s permitted fields and active/inactive status, including a Coach, from the client directory. | **Keep** those edits. They must be available when the admin is managing Coaches, not only when browsing every client. |
| Coach views own permitted profile | An active person can view and update their own client-controlled fields. A Coach is that same person. | **Confirm** for Coaches: own permitted profile only. A Coach cannot change role, active status, or assignments. |
| Coach sees assigned sessions and their participants only | An active Coach sees the operational roster (who, phone, lesson, date, time) for session occurrences assigned to them. They cannot see other sessions, full profiles, billing, or admin tools. | **Keep.** Restate as Coach operations. Deactivation must remove those operations. |
| Assignment to Groups and/or Sessions, without destroying history | A session occurrence is today’s lesson reservation. An admin assigns **one** Coach to that occurrence. There is **no** Group entity and **no** attendance record. Changing the assigned Coach replaces the current Coach on that occurrence. Deactivation does not delete the occurrence. A new assignment does not require the Coach to be active. | **Keep** one Coach per existing session occurrence. **Add** the rule that a **new** assignment requires an active Coach. **Do not** clear existing assignments on deactivation. **Do not** invent Groups, attendance, or a second assignment model in this feature. |
| Deactivate / reactivate without losing history | Profile active/inactive already exists. An inactive Coach fails the Coach check, so roster access stops. Historical occurrences are not deleted. The Coach can still be stored on those occurrences. | **Confirm** and make the Coach outcome explicit: inactive means no normal Coach operations; reactivation restores them for current assignments; history stays attached to the same Coach. |
| Payroll and full scheduling | Not implemented. An unused trainer-availability window exists and is not assignment. | **Stay out of scope.** |

**Domain discrepancy:** Issue #11 asks the Coach model to follow the established Group/Session model, including attendance. The live domain has session occurrences (lesson reservations) and a single Coach assignment on each occurrence. Groups and attendance are not live records. This spec follows the live model and leaves Group assignment and attendance to the feature that introduces them.

**Does not replace** `005` (signup, own profile), `006`/`008` (role matrix, assignment, roster), or `009` (client directory, profile status, permitted participant fields). Those journeys stay in force except the Coach-directory and active-Coach assignment rules above.

---

## User Scenarios & Testing *(mandatory)*

Existing `005`, `006`/`008`, and `009` stories remain in force. Tests below cover only what F1.06 changes or makes explicit for Coaches.

### User Story 1 - Admin creates and maintains a Coach (Priority: P1)

An admin turns an existing academy person into a Coach and can later find that Coach, review their profile, and correct the information the academy is allowed to change. People who are already Coaches stay Coaches without a migration. Someone who is not an admin cannot create a Coach or give themselves or anyone else the Coach role.

**Why this priority**: The academy cannot operate Coach assignment until an admin can reliably recognize and maintain Coaches. Creation has to work for the next Coach without rewriting accounts that already exist.

**Independent Test**: As admin, assign the Coach role to an existing student and see them in the Coach list; update their phone; confirm an existing Coach is already listed with no migration. As that student before promotion, and as a Coach, attempt to assign the Coach role. Only the admin succeeds.

**Acceptance Scenarios**:

1. **Given** an authenticated admin and an existing person who is not a Coach, **When** the admin makes that person a Coach, **Then** the same profile is now recognized as a Coach and appears in Coach management.
2. **Given** people who are already Coaches, **When** this feature is used for the first time, **Then** those Coaches are manageable immediately and no account migration is required.
3. **Given** an authenticated admin, **When** they open Coach management, **Then** they can list Coaches and view and update each Coach’s permitted profile information.
4. **Given** a student, a Coach, or any non-admin, **When** they try to create a Coach or change someone’s role to Coach (including by using an identifier directly), **Then** the change is refused.
5. **Given** an admin managing Coaches, **When** they save, **Then** they update the existing profile of that authenticated person — no second Coach record is created.

---

### User Story 2 - Admin activates and deactivates a Coach without losing history (Priority: P1)

An admin deactivates a Coach who should stop teaching operations, then reactivates them later. Past sessions stay attached to that Coach. Deactivation does not delete the person, their profile, or their historical sessions.

**Why this priority**: Deactivation is an explicit acceptance criterion, and deleting a Coach would break session history.

**Independent Test**: Deactivate an active Coach who is assigned to a past session. The Coach can no longer open assigned-session operations. An admin still sees that session associated with that Coach. Reactivate the Coach; assigned-session operations work again for current assignments. The session row was not removed.

**Acceptance Scenarios**:

1. **Given** an admin and an active Coach, **When** the admin deactivates that Coach, **Then** the Coach can no longer perform normal Coach operations.
2. **Given** a deactivated Coach with past assigned sessions, **When** an admin inspects those sessions, **Then** the sessions still exist and remain associated with that Coach.
3. **Given** a deactivated Coach, **When** an admin reactivates them, **Then** normal Coach operations return for the sessions still assigned to them.
4. **Given** any deactivation or reactivation, **When** it completes, **Then** the login identity and the profile still exist; the action is not a delete.
5. **Given** a deactivated Coach, **When** they sign in, **Then** they can still view their own profile as read-only, consistent with inactive-client behavior, and they cannot use Coach operations.

---

### User Story 3 - Coach works only inside assigned sessions (Priority: P1)

An active Coach sees their own permitted profile information and the sessions assigned to them, including the permitted participant information for those sessions. They cannot open other sessions, other people’s full profiles, admin management, or financial and accounting functions. Guessing an identifier does not widen that scope.

**Why this priority**: Coach access is the operational promise of the role and is already the security boundary F1.06 must keep.

**Independent Test**: Coach assigned only to session A. They see their own profile, session A, and A’s permitted participant information. They cannot open session B’s participants, admin Coach management, or financial records. Clear the assignment; A disappears for that Coach.

**Acceptance Scenarios**:

1. **Given** an active Coach, **When** they open their profile, **Then** they see their permitted profile information and can update only the fields a person may update on their own profile.
2. **Given** an active Coach assigned to session A and not session B, **When** they view their sessions, **Then** they see A and A’s permitted participant information, and they do not see B.
3. **Given** an active Coach, **When** they request an unassigned session, its participants, admin Coach management, or financial/accounting information (including by changing an identifier), **Then** access is denied.
4. **Given** an admin removes the Coach from session A, **When** the Coach next requests A, **Then** access is denied and session A itself still exists.
5. **Given** a Coach who also has their own student bookings, **When** they use Coach operations, **Then** those operations do not grant other people’s financial records or admin powers.

---

### User Story 4 - Admin assigns an active Coach to a session occurrence (Priority: P2)

An admin assigns an active Coach to a session occurrence using the assignment the academy already has. The assignment is explicit and traceable on that occurrence. It does not require a separate Coach-management model, a Group, or a scheduling calendar. Assigning a deactivated Coach to a new or different session is refused. Existing assignments are left in place when the Coach is deactivated.

**Why this priority**: Assignment is what makes Coach access real. The rule that only an active Coach can be newly assigned is the F1.06 tightening; the assignment mechanism itself already exists.

**Independent Test**: Assign active Coach C to occurrence A. C can access A. Attempt to assign deactivated Coach D to occurrence B; the attempt fails and B is unchanged. Deactivate C; A remains associated with C, and C loses access until reactivation.

**Acceptance Scenarios**:

1. **Given** an active Coach and a session occurrence, **When** an admin assigns that Coach, **Then** the occurrence records that Coach and the Coach can access it under User Story 3.
2. **Given** a deactivated Coach, **When** an admin tries to assign them to a session occurrence, **Then** the assignment is refused.
3. **Given** a Coach already assigned to an occurrence, **When** an admin deactivates that Coach, **Then** the occurrence keeps that Coach and is not deleted.
4. **Given** an admin, **When** they assign a Coach, **Then** they do so on the existing session occurrence and do not create a second Coach or a second assignment system.
5. **Given** a non-admin, **When** they try to change who is assigned to a session, **Then** the change is refused.

---

### Edge Cases

- A Coach with no assignments can still view their own permitted profile and sees no sessions.
- Deactivation does not sign the Coach out immediately; the next Coach operation is refused, and their own profile becomes read-only on refresh, matching inactive-client behavior.
- An admin can still correct a deactivated Coach’s permitted profile fields without reactivating them first.
- Reassigning one occurrence replaces the Coach on that occurrence only. Other occurrences, and the session itself, stay. This feature does not keep a separate ledger of previous Coaches.
- Only one Coach is assigned to a session occurrence. A second Coach is not added beside the first.
- Promoting the last active admin into a Coach, or deactivating that admin, stays refused under the existing last-active-admin rule.
- The legacy accounting role is not a Coach and is not a way to gain Coach or admin operations.
- Anonymous visitors cannot read Coach profiles or session participants.
- Coach availability, a teaching calendar, payroll, Groups, and attendance are absent. Managing them is not part of this feature.
- A Coach cannot deactivate themselves, change their own role, or assign Coaches.

---

## Requirements *(mandatory)*

`005` own-profile rules, `006`/`008` role and roster rules, and `009` profile-status and participant-field rules stay in force unless tightened below.

### Functional Requirements

- **FR-001**: A Coach MUST be an existing application profile with the Coach role, tied to that person’s existing login. The system MUST NOT introduce a second Coach identity, a duplicate Coach record, or a separate assignment store.
- **FR-002**: An admin MUST be able to make an existing person a Coach. People who are already Coaches MUST remain Coaches without a migration. A non-admin MUST NOT create a Coach or change any person’s role to Coach, including by supplying an identifier directly.
- **FR-003**: An admin MUST be able to list Coaches and view and update a Coach’s permitted profile information (the same personal fields an admin may already update on a client profile). Admin Coach management MUST NOT create a parallel profile.
- **FR-004**: An active Coach MUST be able to view their own permitted profile information and update only their own client-controlled fields (name, phone, address, and date of birth). A Coach MUST NOT change their email, role, active status, or session assignments.
- **FR-005**: An admin MUST be able to deactivate and reactivate a Coach. Deactivation and reactivation MUST NOT delete the login, the profile, session occurrences, or other historical records. Those records MUST remain associated with the same Coach where that Coach is still the assigned Coach.
- **FR-006**: A deactivated Coach MUST NOT perform normal Coach operations, including viewing assigned sessions and their participants. A deactivated Coach MAY sign in and view their own profile as read-only. Reactivation MUST restore Coach operations for sessions still assigned to them.
- **FR-007**: An admin MUST be able to assign an active Coach to a session occurrence through the existing session-assignment model. A session occurrence MUST have at most one current Coach. Replacing that Coach with a different active Coach is allowed. Assigning a deactivated Coach, a person who is not a Coach, or a second concurrent Coach on the same occurrence MUST be refused.
- **FR-008**: Deactivating a Coach MUST NOT clear or delete existing session assignments. Removing or changing an assignment MUST NOT delete the session occurrence. A Coach MUST NOT access a session after they are no longer assigned to it.
- **FR-009**: An active Coach assigned to a session MUST be able to view that session and its permitted participant information (who the participant is, and their phone). A Coach MUST NOT view participants of unassigned sessions, MUST NOT open another person’s full profile, and MUST NOT use admin-only or financial/accounting functions.
- **FR-010**: Authorization for FR-002 through FR-009 MUST be enforced on the server. Hiding a screen or changing an identifier MUST NOT grant extra access.
- **FR-011**: This feature MUST NOT add payroll, compensation, coach availability, a scheduling calendar, Groups, or attendance. It MUST leave the existing session assignment as the integration point a later Group or attendance feature can use without a new Coach entity.
- **FR-012**: Existing student, admin, and Coach journeys from `005`, `006`/`008`, and `009` MUST keep working for people who are already signed in, including Coaches who already have the role.

### Key Entities

- **Coach** — a person whose application profile has the Coach role. The profile is the Coach; there is no separate Coach entity.
- **Coach profile** — that same profile: personal contact fields, role, and active/inactive status. Personal fields match the client-controlled fields in F1.04. Role and status are academy-controlled.
- **Session occurrence** — the existing lesson reservation that can carry one assigned Coach. This is the session F1.06 assigns and that a Coach is allowed to see.
- **Assignment** — the current Coach named on a session occurrence. It grants that Coach access to the occurrence and its permitted participant information. It is not a Group membership and not an availability window.
- **Participant** — the client on an assigned session occurrence. The Coach sees only the permitted operational information already defined for assigned participants (identity and phone).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can make an existing person a Coach and see that person in Coach management in the same session of testing, without creating a second account and without migrating Coaches who already exist.
- **SC-002**: 100% of non-admin attempts to create a Coach or to set any person’s role to Coach are denied, including attempts that supply an identifier directly.
- **SC-003**: An admin can deactivate a Coach and, in the same check, confirm (a) that Coach cannot open assigned-session operations, (b) at least one pre-existing assigned session is still associated with that Coach, and (c) reactivation restores those operations for sessions still assigned to them.
- **SC-004**: An active Coach assigned only to session A can see A and A’s permitted participant information, and is denied for session B, for admin Coach management, and for financial/accounting information. After the assignment is removed, A is denied as well.
- **SC-005**: 100% of attempts to newly assign a deactivated Coach, a non-Coach, or a second concurrent Coach to a session occurrence are denied. Replacing the current Coach with a different active Coach succeeds. Deactivating a Coach does not remove the Coach already stored on an existing occurrence.
- **SC-006**: A Coach can view and save their own permitted personal fields, and 100% of Coach attempts to change their own role, active status, or assignments are denied.
- **SC-007**: Introducing this feature does not require existing students, admins, or Coaches to re-register, and it does not add payroll or a scheduling calendar.

---

## Assumptions

> **Assumption:** Creating a Coach means an admin assigns the Coach role to a person who already has an account and profile. Admin-issued logins, invites, and set-password-on-behalf are out of scope, consistent with F1.04 and with reusing the current sign-in model. “No migration of existing Coach accounts” means Coaches who already have the role stay valid as they are.
>
> **Assumption:** A Coach may edit the same own-profile fields any active client may edit (name, phone, address, date of birth). They may not edit email, role, status, or assignments. Admins update those personal fields and the academy-controlled role and status. No Coach-only fields (qualifications, payroll, languages) are added.
>
> **Assumption:** Assignment stays one Coach per session occurrence, which is the live lesson reservation. Issue #11’s open choice “Group, Session, or both” is resolved to **Session occurrence only** because no Group entity exists. Group assignment waits for the feature that introduces Groups.
>
> **Assumption:** “More than one Coach on the same session” is resolved to **no**. One current Coach per occurrence matches the live model. A join of several Coaches is a later change.
>
> **Assumption:** Coach availability belongs to the later scheduling feature. The unused trainer-availability window is not Coach assignment and is not turned on here.
>
> **Assumption:** “Historical records remain auditable” means the session stays, still naming its current Coach, after deactivation or an explicit reassignment of a different occurrence. This feature does not add an immutable history of previous Coaches on the same occurrence.
>
> **Assumption:** Permitted participant information stays identity and phone, as F1.04 already set. This feature does not widen that set.
>
> **Assumption:** A deactivated Coach follows inactive-client sign-in: they can open their own profile read-only and cannot perform Coach operations. Deactivation is not a login ban and not a delete.
>
> **Assumption:** There is no minimum number of active Coaches. An admin may deactivate every Coach. The existing rule that the academy must keep one active admin still applies if the person being changed is an admin.
>
> **Assumption:** Swiss personal data stays limited to people with a business need: the Coach for their own profile, admins for Coach management, and the assigned Coach for a participant’s identity and phone.

---

## Non-goals

- A second login system, invite flow, or parallel Coach table.
- Payroll, compensation, contracts, or tax data.
- Coach availability, a teaching calendar, or the full scheduling product.
- Groups, class placement, and attendance products. This feature only keeps session assignment usable for those later features.
- More than one Coach on a session occurrence, or a history ledger of prior assignees.
- Changing which participant fields a Coach may see.
- Rebuilding signup, client management, booking, invoicing, or accounting.

---

## Compatibility

- Preserve `005` signup, session, and own-profile behavior.
- Preserve `006`/`008` student isolation, admin operational access, one-Coach session assignment, and assigned-session roster.
- Preserve `009` active/inactive profiles, last-active-admin protection, admin role assignment, and the coach participant view (identity and phone).
- This feature adds Coach-focused listing and maintenance, the refusal to newly assign an inactive Coach, and an explicit Coach deactivation outcome. It does not clear historical assignments.
- Server-side rules decide access. Hiding a screen is not authorization.

---

## Baseline coverage

| ID | Covered? |
|---|---|
| ACT-001, ACT-006 | Preserved — role remains the authorization attribute; inactive profiles keep own-profile read and lose Coach mutations |
| FEAT-AUTH-010 | Preserved — Coach profile stays 1:1 with the login identity |
| F1.02 assignment and roster | Preserved and tightened — new assignment requires an active Coach |
| F1.04 client status and field split | Preserved — Coach management reuses them; it does not replace the client directory |

---

## Open questions

None blocking. The four open decisions in issue #11 are resolved in Assumptions (session-only assignment, one Coach per occurrence, own-profile field split, availability deferred). Use `/speckit-clarify` if the academy instead wants Group assignment, several Coaches per session, admin-created logins, or a ledger of previous assignees.
