# Feature Specification: Club Management (F1.07)

**Feature Branch**: `011-club-management`

**Created**: 2026-10-05

**Status**: Draft

**Input**: GitHub issue #12 — F1.07 Gestión de clubs. Central management of the clubs/locations where AGC Padel Academy operates. Admins create, view, update, activate, and deactivate clubs used by Groups, Sessions, Coaches, Bookings, and future financial workflows. Students and coaches cannot manage clubs. Deactivation is non-destructive. One Club concept only.

> **Forward spec (delta).** Living as-is for roles remains [`006-roles-and-permissions`](../006-roles-and-permissions/spec.md) / [`008-roles-and-permissions`](../008-roles-and-permissions/spec.md) (F1.02). Living as-is for client identity remains [`009-client-management`](../009-client-management/spec.md) (F1.04). Living as-is for lesson booking remains [`001-lesson-booking`](../001-lesson-booking/spec.md). The public academy address in [`FEAT-PUB-003`](../../baseline-system/requirements.md) stays marketing copy. This file states only what F1.07 adds.
>
> GitHub feature ID is **F1.07**. Spec folder follows sequential numbering under `specs/features/` (`011-club-management`).

---

## Gap analysis (current → target)

Inspected: domain model, baseline requirements, live feature specs `001` / `006` / `008` / `009` / `010`, and application sources. Confirmed unless marked assumption.

| F1.07 rule | Current | This spec |
|---|---|---|
| One managed Club/location | No Club, venue, or location catalogue exists. The public footer shows one fixed academy address. Camps, lessons, and bookings do not reference a club. | **Introduce** Club as the single location record for academy operations. Do not add a second location concept. Do not turn the footer address into a club automatically. |
| Admins create, view, update, activate, and deactivate clubs | No club management exists for any role. | **Add** an admin club catalogue with those actions. |
| Students and coaches cannot manage clubs | They have no club actions today. | **Keep** them out of club management. Hiding the screen is not enough; a direct request is refused. |
| Stable identity for history | Groups, Sessions (as their own records), Attendance, and club-priced finance do not exist yet. Bookings and profiles exist and are not tied to a club. | A Club keeps one identity for its whole life, including while inactive. Renaming or editing it does not detach anything already linked to it. |
| Deactivation is non-destructive | Nothing to deactivate. Client deactivation in F1.04 is the closest pattern: status change, history kept. | **Same idea for clubs.** Deactivate and reactivate. No delete. |
| Inactive clubs unavailable for new use | No “new operation that requires an active club” exists yet (no group placement, no session location). | **Define** the rule now: only an active club may be chosen for a new use. This feature exposes that choice. Later features must use it and must not copy a private location list. |
| Groups and Sessions reference the Club | Neither entity is in the live domain. F1.02 “session” means a lesson booking occurrence, not a club session. | **Define** the relationship contract only. This feature does not build scheduling, group management, pricing, or billing. |
| Clients are not owned by a club | A profile is a person, not a member of a location. | **Keep.** A client is not assigned to a club by this feature. |
| Coaches at a club | Coaches are profiles assigned to booking occurrences (F1.02). There is no club assignment. | **Do not** add a coach-to-club roster here. A future Group or Session points at one Club; coach assignment stays on that Group or Session. |

**Discrepancy:** Issue #12 says to reuse an existing Club/Location/Venue model if present. None is present in the domain model or the application. Introducing Club is the justified single model, not a parallel one.

**Does not replace** lesson booking, client management, camps, or role rules. Those journeys stay in force.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin creates and maintains a club (Priority: P1)

An admin opens club management, creates a club with the information needed to recognize the location, and later corrects that information. The club remains the same club after edits. Students, coaches, and anyone who is not an admin cannot create or change a club, including by bypassing the screen.

**Why this priority**: Without a catalogue of real locations, later groups, sessions, and bookings have nowhere stable to point.

**Independent Test**: As an admin, create a club with a name and optional address and contact details, then change the name and address and see the same club. As a student and as a coach, attempt to create and to edit that club. Only the admin succeeds.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they create a club with a valid name, **Then** the club is saved and appears in the club catalogue.
2. **Given** an authenticated admin and an existing club, **When** they update its name, address, or contact information, **Then** the changes are saved on that same club.
3. **Given** a student, a coach, or a signed-out visitor, **When** they try to create or update a club (including by sending the request directly), **Then** the change is refused and no club is created or modified.
4. **Given** an admin, **When** they try to save a club with no name, or with a name that is only spaces, **Then** the club is not saved and they are told the name is required.
5. **Given** an existing club named “Club Norte”, **When** an admin tries to create or rename another club to the same name ignoring letter case and surrounding spaces, **Then** the save is refused and both clubs stay as they were.
6. **Given** clubs already saved, **When** an admin opens club management, **Then** they can see every club, active and inactive, with enough information to tell them apart (name, place, status).

---

### User Story 2 - Admin deactivates and reactivates a club without losing history (Priority: P1)

An admin marks a club inactive when the academy should stop using it for new work. Anything already linked to that club stays linked and stays readable by whoever was already allowed to see it. The admin can reactivate the club later and it becomes available again. The club is never deleted.

**Why this priority**: Locations close or pause. Deleting them would break the history the academy must still audit.

**Independent Test**: Create a club, attach a sample historical link that names that club, deactivate the club, and confirm the link still names it and the club is absent from clubs offered for new use. Reactivate it and confirm it is offered again. Confirm the club record still exists throughout.

**Acceptance Scenarios**:

1. **Given** an active club, **When** an admin deactivates it, **Then** it is no longer offered for a new use that requires an active club, and the club record still exists.
2. **Given** a deactivated club that already has historical groups, sessions, bookings, attendance, or financial records, **When** someone authorized to see those records opens them, **Then** they still name the original club and none of those records were deleted or moved to another club.
3. **Given** a deactivated club, **When** an admin reactivates it, **Then** it is offered again for new use.
4. **Given** any club, **When** an admin looks for a delete action, **Then** none is available; stopping use is deactivation only.
5. **Given** a student, a coach, or a signed-out visitor, **When** they try to activate or deactivate a club, **Then** the change is refused.

---

### User Story 3 - One Club for future groups and sessions (Priority: P2)

Later group and session work can point at this Club and must not invent another location list. A group has one home club. A session either uses its group’s club or, when it has no group, names one club directly. People are not owned by a club. This story is the contract those later features must follow; it does not build groups, sessions, schedules, prices, or invoices.

**Why this priority**: The issue requires the relationship now so location logic is not copied into every later feature. The catalogue in stories 1 and 2 is still useful before groups exist.

**Independent Test**: Confirm the club catalogue is the only place a club is defined. Confirm a new use can select only an active club from that catalogue. Confirm a client profile has no home-club field added by this feature. Confirm a coach has no separate club-membership list added by this feature.

**Acceptance Scenarios**:

1. **Given** this feature is in place, **When** a later group is associated with a location, **Then** that association is exactly one Club from this catalogue, not a second location record.
2. **Given** a group with a home club, **When** a session belongs to that group, **Then** the session uses that same club.
3. **Given** a session that does not belong to a group, **When** it needs a location, **Then** it references exactly one Club from this catalogue.
4. **Given** a client, **When** an admin manages clubs, **Then** the client is not given a home club and is not listed as belonging to a club.
5. **Given** a coach, **When** an admin manages clubs, **Then** the coach is not assigned to clubs from this screen; coach assignment stays on the future group or session.
6. **Given** a deactivated club, **When** someone tries to choose it for a new group, session, or other new use, **Then** the choice is refused. An existing link to that club is left unchanged.

---

### Edge Cases

- Deactivating a club that is already inactive leaves it inactive. Reactivating a club that is already active leaves it active. Neither action deletes or duplicates the club.
- An admin can correct the name, address, or contact details of an inactive club without reactivating it. Those edits still apply to the same club, including on historical records that show the club’s current identifying text.
- A club created and never used can still only be deactivated, not deleted, so its identity is not recycled.
- Two clubs may share a street address; they may not share a name (comparison ignores case and surrounding spaces).
- Address and contact details may be left empty at creation. The admin can fill them in later. Emptiness does not block saving when the name is valid and unique.
- The public footer address is not a club. Creating, editing, or deactivating clubs does not change the public contact footer.
- A person who can already see a historical booking, group, or session can still see the club named on that record after deactivation. They do not gain a club catalogue or any club management action.
- Choosing a club for a new use when every club is inactive yields no selectable club. The admin must reactivate or create an active club first.
- A direct request that names an inactive club for a new association is refused even if the screen hid that club.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide one Club as the only location record for academy operations. Groups, sessions, bookings, and later pricing MUST reference that Club when they need a location, and MUST NOT introduce a second club or location catalogue.
- **FR-002**: An authenticated admin MUST be able to create a club, view every club, and update an existing club’s identifying information.
- **FR-003**: A club MUST have a name. The name is required, must not be blank or only spaces, and must be unique among clubs when compared without regard to letter case or surrounding spaces.
- **FR-004**: A club MAY include a location description (address or place) and contact information (phone, email, or both). These MAY be empty.
- **FR-005**: A club MUST be either active or inactive. A newly created club is active.
- **FR-006**: An authenticated admin MUST be able to deactivate an active club and reactivate an inactive club.
- **FR-007**: Deactivation and reactivation MUST keep the same club identity. The system MUST NOT delete a club, and MUST NOT delete or reassign historical groups, sessions, bookings, attendance, or financial records because a club was deactivated or edited.
- **FR-008**: A deactivated club MUST NOT be selectable for a new operation that requires an active club. Historical records that already name that club remain readable under their existing authorization.
- **FR-009**: Students, coaches, people with no operational role, and signed-out visitors MUST NOT create, update, activate, or deactivate clubs. The refusal MUST hold when they bypass the club screen. Hiding the screen is not sufficient.
- **FR-010**: Only admins MUST be able to open the club catalogue. Other people MUST NOT browse the list of clubs from this feature.
- **FR-011**: When groups exist, each group MUST have exactly one home Club. A group MUST NOT belong to more than one club.
- **FR-012**: A session that belongs to a group MUST use that group’s Club. A session that does not belong to a group MUST reference exactly one Club directly. This feature does not allow a grouped session to take place at a different club from its group.
- **FR-013**: Clients MUST NOT be owned by a club. This feature MUST NOT add a home-club assignment on the client.
- **FR-014**: Coaches MUST NOT be given a club-membership list by this feature. Which coach works a group or session stays with that group or session.
- **FR-015**: Club-specific prices, opening hours, court calendars, and billing rules are out of this feature. The club record MUST NOT become a second pricing or scheduling product.
- **FR-016**: The published academy contact address MUST remain independent of the club catalogue. Managing clubs MUST NOT change that public contact text by itself.

### Key Entities

- **Club**: A location where the academy operates. It has a stable identity, a unique name, optional place and contact details, and an active or inactive status. It is not a person and not a product.
- **Group** (relationship only; not built here): A future class group with exactly one home Club.
- **Session** (relationship only; not built here): A future occurrence that uses its group’s Club, or exactly one Club when it has no group. This is not the same thing as today’s lesson booking.
- **Client**: An existing person profile. Not owned by a Club.
- **Coach**: An existing person with the coach role. Not given a club roster by this feature.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can create a club and see it in the catalogue in under 2 minutes, without help from another person.
- **SC-002**: In acceptance tests, 100% of create, update, activate, and deactivate attempts by a non-admin are refused, and the stored clubs are unchanged.
- **SC-003**: After a club is deactivated, 100% of pre-existing records that named that club still name it, and a check of those records finds none deleted by the deactivation.
- **SC-004**: In a catalogue of at least 20 clubs, an admin can find a named club and tell whether it is active in under 30 seconds.
- **SC-005**: Every new location choice offered by the product comes from this club catalogue’s active clubs. A review of the product finds no second place where clubs or venues are created.
- **SC-006**: An admin can correct a club’s name or address, deactivate it, and later reactivate it, and staff can still recognize historical records as belonging to that same club.

---

## Assumptions

> **Assumption:** No Club entity exists today. The footer address (Durisolstrasse 3, 5612 Villmergen, plus phone and email) is public contact copy under `FEAT-PUB-003`, not a managed club. Admins create clubs explicitly. That address is not imported as a club.

> **Assumption:** “Admin” is the existing admin role from F1.02. Students and coaches are the other live roles. The unused accounting role cannot manage clubs.

> **Assumption:** Required operational identity is the unique club name plus active/inactive status. Address and contact details are optional and can be completed later. No opening hours, court list, or price list is stored on the club in this feature (issue open decision on operational rules: those rules belong to later scheduling and pricing features).

> **Assumption:** A group belongs to exactly one club, not many (issue open decision). A session does not override its group’s club (issue open decision). One-off sessions with no group still name exactly one club. Moving a single session to another venue is deferred with scheduling.

> **Assumption:** Deactivated clubs stay visible in the admin catalogue so staff can read and correct them, and they stay visible on historical records. They are not offered for new groups, sessions, bookings, or other new uses, including manual admin creation of those future records (issue open decision). Editing the inactive club’s own details is still allowed.

> **Assumption:** There is no delete. An unused club is deactivated so its identity cannot be reused by a different location.

> **Assumption:** “New operations requiring an active club” means any future create or reassignment of a group, session, booking, or similar record onto a club. This feature defines and enforces the active-club rule at the club boundary. It does not implement those operations. Existing links are never cleared on deactivation.

> **Assumption:** Who may read a historical booking, group, or session does not change. This feature does not widen student or coach access. If such a record shows its club, the viewer may see that club’s identifying information as part of the record.

> **Assumption:** Camp offerings (F1.25) are a separate product. This feature does not attach camps to clubs and does not treat a camp as a club.

## Out of Scope

- Scheduling, calendars, and court availability.
- Group management and class assignment.
- Pricing, memberships, and billing.
- Attendance.
- Changing which coach is assigned to a session.
- Public marketing pages, other than leaving the existing contact footer unchanged.
- Importing or synchronizing external venue directories.

## Dependencies

- F1.02 roles: only the admin role may manage clubs; students and coaches stay restricted to their existing permissions.
- Future group, session, and booking-location work must consume this Club and the active-club rule instead of defining another location.
