# Feature Specification: Level System (F1.05)

**Feature Branch**: `011-level-system`

**Created**: 2026-09-10

**Status**: Draft

**Input**: GitHub issue #10 — F1.05 Sistema de niveles (Notion F1.04). Centralized level management for AGC Padel Academy: Declared, Playtomic, and Official Academy levels stay distinct; Official Academy level is authoritative for academy decisions; admins manage definitions and assignments with history; clients view official level and may update declared level; coaches see permitted participant levels; a single reusable compatibility rule is available to later Group, Session, Booking, Recovery, Coach, and Client work.

> **Forward spec (delta).** Living as-is for signup, own-profile, and billing completeness remains [`005-auth-and-profile-completion`](../005-auth-and-profile-completion/spec.md). Living as-is for roles and coach roster remains [`006-roles-and-permissions`](../006-roles-and-permissions/spec.md) / [`008-roles-and-permissions`](../008-roles-and-permissions/spec.md) (F1.02). Living as-is for the client profile, admin directory, deactivation, and academy-controlled field protection remains [`009-client-management`](../009-client-management/spec.md) (F1.04). Child camp experience (`padel_level` on children / camp registrations) remains [`010-padel-camps`](../010-padel-camps/spec.md) (F1.25). This file states only what F1.05 adds.
>
> GitHub feature ID is **F1.05** (Bexio took F1.03, shifting original Notion F1.04). Original Notion page remains F1.04. Spec folder follows sequential numbering under `specs/features/` (`011-level-system`), not the Notion path `specs/phase-1/F1.04-level-system/`.

---

## Gap analysis (current → target)

Inspected: F1.04 spec (`009`), F1.02 specs (`006`/`008`), F1.25 camps spec (`010`), domain model, baseline backend snapshot, live profile and admin client directory, coach roster, and child `padel_level`. Confirmed unless marked assumption.

| F1.05 rule | Current | This spec |
|---|---|---|
| Three distinct level sources on the client | No declared, Playtomic, or official academy level on the client profile. F1.04 explicitly deferred them here. Child camp records have a free-text `padel_level` (parent-declared experience), not an official academy level. | **Add** Declared, Playtomic (informational), and Official Academy levels on the existing client profile. Keep sources explicit. Do **not** reuse or rename child camp experience as the academy level system. |
| Official Academy level is authoritative | No academy level exists. Lesson booking does not use skill rank. Class assignment is a later spec. | **Add** Official Academy level as the only level used for academy decisions and compatibility. Declared and Playtomic MUST NOT drive those decisions in this feature. |
| Admin manages the academy level catalog | No catalog. Child experience is free text (placeholder examples: beginner / intermediate / advanced). | **Add** admin create / update / deactivate of academy level definitions. The scale is the catalog the academy maintains — not a hardcoded list. Used definitions are deactivated, not deleted. |
| Admin assigns / changes official level with history | Admin can edit client-controlled fields and academy-controlled role/status (`009`). No official level and no history. | **Add** admin assignment and change of official academy level on another client. Each change is recorded; previous assignments are not overwritten. |
| Client views official level; cannot change it | Students cannot write academy-controlled fields (`009` FR-004). Official level does not exist yet. | **Keep** that write-protection and apply it to official academy level. **Add** read of own official / declared / Playtomic values on the client’s own profile. |
| Client may update declared level | Students edit permitted own-profile fields (`009`). Declared level does not exist. | **Add** declared level as a client-controlled field: the owning active student may set or change it from the active academy catalog. Admins may also set it. |
| Playtomic is informational only | No Playtomic field or integration. F1.25 states camps do not import Playtomic (deferred to F1.05). | **Add** optional informational Playtomic value, recorded manually when available. **Do not** add a Playtomic product connection or auto-copy into official academy level. |
| Coach sees participant levels; cannot change official level | Coach sees assigned-session identity + phone (`009` US4). F1.04 assumed official level would later join that permitted view. Issue draft also said coaches can assign official level; later coach, security, and acceptance text forbid it. | **Add** official / declared / Playtomic visibility for participants of sessions assigned to the coach. **Coaches cannot assign or change official levels, definitions, or compatibility rules.** |
| Centralized compatibility | No group/session product and no compatibility rule. Suggested next spec `class-assignment` places students into groups by skill rank. Current lesson booking has no session matching. | **Add** one reusable compatibility rule based on official academy levels, configurable by admins. Expose it for later Group / Session / Booking / Recovery consumers. **Do not** change today’s catalogue lesson booking, which has no session/level matching. |
| Authorization / isolation | F1.02 + F1.04: students only own profile; coaches only assigned participants; admins operational; hiding a screen is not authorization; identifier manipulation is denied. | **Reuse.** Apply the same rules to level definitions, assignments, history, Playtomic values, and compatibility configuration. |

**Does not replace** `005` (own billing profile), `006`/`008` (roles, roster), `009` (client directory, deactivation, field-level protection), or `010` (child camp experience). Those journeys stay in force.

---

## User Scenarios & Testing *(mandatory)*

Existing `005` / `006` / `008` / `009` stories **remain in force**. Tests below cover only what F1.05 changes.

### User Story 1 - Admin maintains the academy level catalog (Priority: P1)

An admin opens level configuration and defines the academy’s available levels (name, order, and whether each is available for new use). They can later rename, reorder, or deactivate a definition. Non-admins cannot change the catalog.

**Why this priority**: Every assignment, declared-level choice, and compatibility rule depends on a shared catalog. Without it there is nothing to assign.

**Independent Test**: As admin, create two levels, rename one, deactivate one. Confirm a student or coach cannot create or change definitions. Confirm a deactivated definition cannot be newly assigned.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they manage academy levels, **Then** they can create, update, and deactivate level definitions according to the academy’s configured catalog.
2. **Given** an authenticated student or coach, **When** they attempt to create, update, or deactivate a level definition (including by bypassing the screen), **Then** the change is refused and the catalog is unchanged.
3. **Given** a deactivated level definition, **When** an admin tries to newly assign it as a client’s official academy level, **Then** the assignment is refused.
4. **Given** a level definition that has already been assigned or used in history, **When** an admin deactivates it, **Then** the definition is no longer offered for new assignment and historical records still name that definition.

---

### User Story 2 - Admin assigns and changes a client’s official academy level (Priority: P1)

An admin opens an existing client and assigns an official academy level from the catalog. If the client already has one, the admin can change it. The new value is the one academy logic uses afterwards. The previous value remains in history with when it changed and who changed it.

**Why this priority**: Official academy level is the authoritative source the rest of the academy will use. Assignment plus history is the core operational value of this feature.

**Independent Test**: Assign official level L1 to client A. Change it to L2. Confirm A’s current official level is L2, history still shows L1 → L2 with time and the admin as actor, and a student cannot perform the same change.

**Acceptance Scenarios**:

1. **Given** an admin and an existing client, **When** the admin assigns an official academy level from the active catalog, **Then** that value is stored as the client’s official academy level and a history record is created.
2. **Given** a client who already has official level L1, **When** an admin changes it to L2, **Then** L2 is the current official academy level for subsequent academy logic and the L1 assignment remains in history (previous level, new level, time, responsible actor).
3. **Given** an authenticated student, **When** they attempt to assign or change their own or another client’s official academy level, **Then** the change is refused and stored values (including history) are unchanged.
4. **Given** a coach, **When** they attempt to assign or change a participant’s official academy level, **Then** the change is refused.
5. **Given** an admin viewing a client, **When** they inspect level information, **Then** they see all three sources (official, declared, Playtomic when present) and the official-level history.

---

### User Story 3 - Client views official level and maintains declared level (Priority: P1)

An authenticated client opens their profile, sees their official academy level (read-only), their declared level, and Playtomic information when it exists. They can set or update their declared level from the active catalog. They cannot change official level, level definitions, or compatibility rules, and they cannot see another client’s levels.

**Why this priority**: Clients must understand the academy’s authoritative level without being able to rewrite it. Declared level is the client-provided counterpart and is the only level they may edit.

**Independent Test**: As client A, view official level (read-only), save declared level, confirm it persists. Attempt to change official level and to open client B’s levels. Only A’s declared-level save succeeds.

**Acceptance Scenarios**:

1. **Given** an authenticated client, **When** they view their profile, **Then** they see their official academy level, declared level, and Playtomic value when one is recorded, each labelled so the source is obvious.
2. **Given** an authenticated client with an active profile, **When** they set or update their declared level from the active catalog, **Then** the change is stored and shown again on the next visit.
3. **Given** an authenticated client, **When** they try to change their official academy level, level definitions, or compatibility rules, **Then** the change is refused.
4. **Given** client A, **When** they request client B’s level information (including by using B’s identifier directly), **Then** access is denied.
5. **Given** an existing signed-in client from before this feature, **When** they open their profile, **Then** they can still use it; missing level values are empty until set, and booking completeness is unchanged.

---

### User Story 4 - Playtomic stays informational (Priority: P2)

When a Playtomic level is available, an admin can record it on the client. Authorized viewers see it as informational. It never becomes the official academy level by itself.

**Why this priority**: The issue requires the three sources to stay distinct and forbids automatic Playtomic → academy synchronization. Recording the value without an integration is enough for this slice.

**Independent Test**: Admin records Playtomic value P on client A without changing official level L. A and the admin see P labelled as Playtomic. Official level remains L. A cannot change P or L.

**Acceptance Scenarios**:

1. **Given** an admin and a client with official level L, **When** the admin records a Playtomic value, **Then** authorized users can see that value as informational and L remains the official academy level.
2. **Given** a recorded Playtomic value, **When** no separate explicit business rule has been approved to copy it, **Then** it MUST NOT replace or silently update the official academy level.
3. **Given** a client, **When** they view their profile, **Then** they can see a recorded Playtomic value and cannot change it.
4. **Given** no Playtomic value, **When** anyone authorized views the client, **Then** Playtomic is shown as not available rather than inventing a value.

---

### User Story 5 - Coach sees permitted participant levels only (Priority: P2)

A coach continues to use assigned-session access from F1.02 / F1.04. For a participant of a session assigned to them, they can see that participant’s official, declared, and Playtomic levels. They cannot change those values, cannot manage the catalog or compatibility rules, and cannot see unrelated clients’ levels.

**Why this priority**: Coaches need level context to run a session; they must not become a second admin for academy-controlled levels.

**Independent Test**: Coach assigned to occurrence A only. Coach sees A’s participant levels. Coach cannot change them. Coach cannot see client B (not in A). Remove the assignment; A’s levels disappear for that coach.

**Acceptance Scenarios**:

1. **Given** a coach assigned to session occurrence A, **When** they open the participant in A, **Then** they see that participant’s official academy level, declared level, and Playtomic value when present.
2. **Given** a coach assigned to A and not B, **When** they request client B’s level information, **Then** access is denied.
3. **Given** a coach, **When** they attempt to change official level, declared level, Playtomic value, definitions, or compatibility rules, **Then** the change is refused.
4. **Given** an admin removes the coach from occurrence A, **When** the coach next requests that participant’s levels, **Then** access is denied.

---

### User Story 6 - One reusable compatibility rule (Priority: P2)

An admin configures which official academy levels may share a group or session. Any later operation that asks “are these official levels compatible?” uses that same rule. An incompatible pairing is refused by consumers that enforce the rule. Declared and Playtomic values are not inputs to the rule.

**Why this priority**: The issue exists so Group, Session, Booking, Recovery, Coach, and Client features do not invent their own comparisons. Shipping the rule now is the contract those features will consume.

**Independent Test**: Configure L1 compatible with L1 only. Evaluate L1 vs L1 (compatible) and L1 vs L2 (incompatible). Confirm a consumer that enforces the rule refuses the incompatible pairing. Confirm a second consumer asking the same question gets the same answer. Confirm today’s catalogue lesson booking (no session matching) is unchanged.

**Acceptance Scenarios**:

1. **Given** configured compatibility rules, **When** compatibility is evaluated for two official academy levels, **Then** the centralized rule is used and the result is compatible or incompatible.
2. **Given** the same pair of official levels, **When** two different consumers ask the same question, **Then** they receive the same result from the same rule (no second algorithm).
3. **Given** an operation that enforces compatibility, **When** the client’s official academy level is incompatible with the target group/session level, **Then** the operation is refused according to the configured rules.
4. **Given** a client with no official academy level, **When** an operation that enforces compatibility is attempted, **Then** the result is not compatible and the operation is refused.
5. **Given** today’s lesson catalogue booking (no session or group matching), **When** this feature ships, **Then** a client can still book a lesson without a new level-compatibility block on that existing path.

---

### Edge Cases

- A client with no official, declared, or Playtomic value can still sign in, edit permitted profile fields, and book a lesson under existing `005`/`001` rules. Empty official level only blocks operations that explicitly enforce compatibility.
- Declared level may be empty. Emptiness does not block profile completeness for booking (completeness stays the existing billing fields from `005`).
- A deactivated client (`009`) can still **see** their own levels and cannot **change** declared level until reactivated. Admins can still assign or change official level on a deactivated client.
- Changing official level does not rewrite older history rows. History is append-only.
- First official assignment (no previous value) is still recorded: previous level may be empty, new level, time, and actor are present.
- Deactivating a definition that is someone’s current official level leaves that current assignment in place until an admin changes it; it cannot be newly assigned to anyone else.
- Compatibility configuration that names a later-deactivated definition remains visible in history/configuration but cannot be used to newly treat that definition as an assignable level.
- If no extra compatible pairs are configured, only two clients (or a client and a group/session) with the **same** official academy level are compatible.
- Playtomic may be missing, stale, or in a different scale than academy levels; the product still must not copy it into official academy level.
- A coach who is also a student on their own booking keeps own-profile rights (including declared-level edit when active); that does not grant other clients’ levels or official-level write.
- Identifier manipulation (guessing another client’s id) is denied the same way as a hidden button (`009` FR-011, F1.02).
- Child camp `padel_level` is not an official academy level. Editing a child’s camp experience does not change a parent’s or child’s (non-login) academy level, because children have no academy-level assignment in this feature.
- Groups, session calendar, recovery, and class assignment do not exist yet; “session occurrence” remains today’s F1.02 assigned lesson reservation until those features land. Compatibility is still defined and testable without those products.

---

## Requirements *(mandatory)*

`005` own-profile and completeness, `006`/`008` role isolation and coach assignment, and `009` client directory / deactivation / academy-controlled write protection stay in force unless tightened below.

### Functional Requirements

- **FR-001**: The system MUST represent three distinct level sources on the existing client profile: **Declared** (provided by the client), **Playtomic** (informational when available), and **Official Academy** (assigned/validated by AGC). Each source MUST remain explicit wherever it is shown or stored. The system MUST NOT collapse them into a single undifferentiated “level”.
- **FR-002**: Official Academy level MUST be the only level used for academy decisions in this feature, including compatibility. Declared and Playtomic MUST NOT substitute for it.
- **FR-003**: An admin MUST be able to create, update, and deactivate academy level definitions (the catalog). Non-admin users MUST NOT modify definitions. A definition that has been assigned or appears in history MUST NOT be hard-deleted; deactivation is the removal path.
- **FR-004**: New official-level assignments and new declared-level choices MUST use **active** catalog definitions. A deactivated definition MUST remain readable on existing assignments and in history.
- **FR-005**: An admin MUST be able to assign and change another client’s official academy level. A client MUST NOT change official academy level (own or another’s). A coach MUST NOT assign or change official academy level.
- **FR-006**: Every successful official-level assignment or change MUST append a history record that includes at least previous official level (empty on first assignment), new official level, timestamp, and the responsible actor. Historical records MUST NOT be overwritten or deleted by later changes.
- **FR-007**: An authenticated client MUST be able to view their own official, declared, and Playtomic values. A client MUST NOT view another client’s level information, including by supplying another identifier.
- **FR-008**: An active client MUST be able to set or update **only** their own declared level, choosing from the active catalog (or leaving it empty). Admins MAY set a client’s declared level. Clients MUST NOT modify Playtomic values, official levels, definitions, or compatibility rules.
- **FR-009**: An admin MUST be able to record, update, or clear a client’s Playtomic value when information is available. Playtomic MUST be displayed as informational. The system MUST NOT automatically copy Playtomic into official academy level. This feature MUST NOT introduce a Playtomic product connection or import job.
- **FR-010**: A coach MUST see official, declared, and Playtomic values only for participants of session occurrences assigned to them (F1.02 assignment). A coach MUST NOT access unrelated clients’ levels, MUST NOT manage the catalog or compatibility rules, and MUST NOT change another client’s level values.
- **FR-011**: An admin MUST be able to view all three level sources and official-level history for any client.
- **FR-012**: The system MUST provide a single reusable compatibility rule whose inputs are official academy levels (client vs client, or client vs group/session target). Compatibility MUST NOT be reimplemented per consumer. Admins MUST be able to configure which official levels are compatible. If no extra pairs are configured, only identical official levels are compatible.
- **FR-013**: When a consumer enforces compatibility, the system MUST refuse an incompatible pairing, including when the client has no official academy level. Consumers that do not yet exist (Group, Session calendar, Recovery, class assignment) are not delivered here; they MUST be specified to call this rule rather than inventing their own.
- **FR-014**: Existing catalogue lesson booking (`001`) MUST remain bookable without a new compatibility check, because that path has no group/session matching today.
- **FR-015**: Authorization for FR-003–FR-013 MUST be enforced by the product, not only by hiding a screen. Direct identifier manipulation MUST be denied the same way as a hidden control (F1.02 / `XR-003` / `009` FR-011).
- **FR-016**: Level data MUST attach to the existing client profile (`009` FR-001). The system MUST NOT create a second user identity or a parallel client record for levels.
- **FR-017**: Child camp experience on children / camp registrations (`010`) MUST remain a separate declared-experience field. This feature MUST NOT treat it as Official Academy level and MUST NOT require a Playtomic import for camps.
- **FR-018**: Existing signup, own-profile billing fields, deactivation, coach roster, and Bexio payment flows MUST continue to work. New level fields MUST be optional so existing clients remain valid without an assigned level.

### Key Entities

- **Academy level definition** — A named step in the academy’s catalog (what the academy calls a level). Has a display name, relative order, and active/inactive availability for new use. Created and maintained only by admins.
- **Official Academy level** — The academy-validated current level of a client, chosen from the catalog. Academy-controlled. Authoritative for academy decisions and compatibility.
- **Declared level** — The level the client says they are, chosen from the same catalog (or empty). Client-controlled on an active own profile; also writable by an admin.
- **Playtomic level** — Optional informational value recorded when available. Not a catalog definition. Not authoritative. No automatic sync into official academy level.
- **Official level history record** — An append-only fact that official academy level changed (or was first assigned): previous value, new value, when, who. Not overwritten.
- **Compatibility rule** — The single academy-configured answer to whether two official academy levels may share a group or session. Default: same official level only, plus any extra pairs an admin configures.
- **Client profile** — Existing F1.04 client. Levels attach here; they do not create a second person.
- **Session occurrence / assignment / participant** — As in F1.02: until class placement exists, the lesson reservation and its assigned coach. Coach level access is granted only through that assignment.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a review of any client who has all three values, 100% of authorized views show Declared, Playtomic, and Official Academy as separately labelled sources; official is the value used for a subsequent compatibility check.
- **SC-002**: 100% of non-admin attempts to create, change, or deactivate academy level definitions are denied; an admin can complete create → rename → deactivate in one sitting.
- **SC-003**: 100% of client and coach attempts to change a client’s official academy level are denied; an admin change succeeds and, in the same check, history still contains the previous official level, the new level, a timestamp, and the admin as actor.
- **SC-004**: An active client can save a declared level from the catalog and see it again on the next visit; 100% of that client’s attempts to change official level or Playtomic are denied.
- **SC-005**: 100% of client A attempts to read client B’s level information (including after bypassing the screen or using B’s identifier) are denied.
- **SC-006**: Recording a Playtomic value never changes the official academy level in the same operation; official remains whatever it was before the Playtomic save.
- **SC-007**: A coach assigned only to occurrence A retrieves permitted levels for A’s participant and is denied for a client who is not in A; after assignment removal, A’s participant levels are also denied. 100% of that coach’s attempts to change official level fail.
- **SC-008**: The same official-level pair yields the same compatible/incompatible result when evaluated twice (including from two intended consumers). An enforcing evaluation of an incompatible pair, or of a client with no official level, is refused.
- **SC-009**: After this feature is available, an existing client with no levels can still sign in and complete a catalogue lesson booking under pre-existing rules (no new mandatory level gate on that path).
- **SC-010**: An admin can find a client, assign or change official academy level, and confirm the new value plus history, in under 3 minutes once they are signed in.

---

## Assumptions

- The existing profile **is** the client (`009`). Levels attach to that profile.
- The academy level **scale is the admin-managed catalog**, not a hardcoded list. Brownfield and business docs do not define a fixed scale (child camp experience is free text). Admins create whatever names and order the academy uses; the catalog can change later without redefining the three source types.
- Used definitions are **deactivated, never hard-deleted**, matching the issue’s configuration acceptance text and the constitution’s no-silent-delete rule.
- **Declared level is editable after registration** by the owning active client, from the active catalog. That matches “clients may update their declared level where exposed” and F1.04’s client-controlled field pattern.
- **Playtomic is entered manually by an admin** when they have the information. No Playtomic connection, file import, or auto-sync is in this feature (issue deferred scope + integration constraints).
- **Coaches cannot assign or change official academy levels** in this feature. The issue’s early “admins and coaches can assign” line is treated as superseded by the later coach capabilities, security requirements, and acceptance criteria, which all forbid coach writes. Expanding coach write would need an explicit later authorization rule.
- F1.04 already expected official level to join the **coach’s permitted participant view**. This spec delivers that read, plus declared and Playtomic, still without billing/address/email/role/status.
- **Compatibility default** when no extra pairs are configured: only identical official academy levels are compatible. Admins configure additional pairs if the academy wants mixed-level groups. No numeric “plus/minus one” matrix is invented.
- Compatibility is **defined and testable now**. Group, Session calendar, Recovery, and class-assignment products are **consumers**, not part of this delivery. Catalogue lesson booking stays as it is (`FR-014`).
- A client with **no official academy level** is not compatible for enforcing consumers. Empty official level does not block today’s lesson booking.
- Child `padel_level` in F1.25 stays parent-declared camp experience. Unifying children into the academy catalog is out of scope.
- “Assigned session” remains F1.02’s assigned lesson reservation until a later class/group feature redefines session.
- Swiss personal data rules from `009` still apply: level information is limited to the owner, admins, and (for assigned participants) the assigned coach.
- History’s “responsible actor” is the signed-in user who performed the change, when the application can identify them (normal admin UI path).

---

## Non-goals

- A Playtomic product integration, ranking import, or automatic Playtomic → Official Academy mapping (deferred unless separately specified).
- Replacing or scoring F1.25 child camp experience as Official Academy level.
- Building Groups (F1.08), session calendar (F1.10), recovery, waitlist, or class-assignment UIs. Those features must consume this compatibility rule when they are specified.
- Changing today’s catalogue lesson booking to require a level or to reject by compatibility.
- Coach write access to official levels, definitions, or compatibility rules.
- A second client/user identity for levels.
- Hard-deleting level definitions, history rows, or client profiles.
- Memberships, attendance, or skill-rank placement into groups (later `class-assignment`).

---

## Compatibility

- Preserve `005` student profile edit and completeness-before-booking.
- Preserve `006`/`008` student isolation, admin operational access, coach assignment, and roster.
- Preserve `009` admin client directory, deactivation, and academy-controlled write protection. Official academy level becomes an academy-controlled field under those same rules; declared level becomes a client-controlled field.
- Preserve `010` child/camp declared experience as a separate concept.
- Preserve F1.02: hiding a screen is not authorization.
- Additive optional fields only; existing clients without levels remain valid.
- Do not invent a second comparison algorithm in booking, recovery, or camps in this slice.

---

## Baseline coverage

| ID | Covered? |
|---|---|
| FEAT-PRF-001 … FEAT-PRF-004 | Preserved (`005`/`009`); this spec adds optional level fields without changing completeness |
| ACT-001 … ACT-007 | Preserved; coach/admin/student powers for levels follow F1.02 / F1.04 |
| XR-003 | Tightened — level catalog, assignment, history, and compatibility configuration must hold without the UI |
| Suggested `class-assignment` | Not delivered; this spec provides the official level + compatibility rule that spec will need |

---

## Open questions

None blocking. Defaults are in Assumptions. Use `/speckit-clarify` if the academy wants a fixed published scale instead of an admin catalog, adjacent-level mixing by default, client-editable Playtomic, coach write of official levels, or a compatibility gate on today’s lesson booking.
