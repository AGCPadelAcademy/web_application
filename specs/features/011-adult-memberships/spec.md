# Feature Specification: Adult Memberships (F1.09)

**Feature Branch**: `011-adult-memberships`

**Created**: 2026-09-17

**Status**: Draft

**Input**: GitHub issue #14 — F1.09 Memberships de adultos. Manage adult Memberships as recurring fixed-place commitments linked to a Group. A Membership is not a generic credit wallet; it represents recurring participation in one Group and provides the basis for future Session participation.

> **Forward spec (delta).** Living as-is for lesson catalogue and one-off lesson reservations remains [`001-lesson-booking`](../001-lesson-booking/spec.md). Living as-is for invoicing and Bexio remains [`007-bexio-integration`](../007-bexio-integration/spec.md) (F1.03). Living as-is for roles remains [`006-roles-and-permissions`](../006-roles-and-permissions/spec.md) / [`008-roles-and-permissions`](../008-roles-and-permissions/spec.md) (F1.02). Living as-is for client identity remains [`009-client-management`](../009-client-management/spec.md) (F1.04). Camps member-price self-declaration remains [`010-padel-camps`](../010-padel-camps/spec.md) (F1.25) until a later confirmed handover. This file states only what F1.09 adds.
>
> GitHub feature ID is **F1.09**. Spec folder follows sequential numbering under `specs/features/` (`011-adult-memberships`), not a Notion path. Working git branch for this specify run: `sdd/f1-09-memberships-de-adultos`.

---

## Clarifications

### Session 2026-10-05

Answers given by the product owner on GitHub issue #14 (CLARIFICATION REQUIRED thread).

- Q: What happens to the live `/lessons` catalogue "Adult Memberships" products when F1.09 ships? → A: **Option A — Keep them separate.** `/lessons` booking stays; F1.09 is an Admin-created Group commitment beside it.
- Q: When Admin cancels a Membership, when does the fixed Group place actually stop? → A: **Option B — End of the already-paid month.** The place continues through the current billed period.
- Q: Can an Admin pause/resume a Membership in F1.09 V1? → A: **Option A — Operable now.** Admin can Pause (fixed place stops) and resume to Active.

### Session 2026-10-31

Answers given by the product owner in the billing-rules review. This session refines the 2026-10-05 cancellation answer. The 1st-of-the-previous-month Terms notice is no longer the rule to leave unenforced.

- Q: When is an adult Membership invoiced? → A: Once per calendar month. On the 1st, F1.09 creates one chargeable period for that month. F1.26 issues and collects the invoice. Dates are calendar dates in the academy timezone.
- Q: What happens if that invoice is still unpaid on the 1st of the next month? → A: F1.09 creates one cancel-fee intent of **10% of that month’s membership price**. Example: the August period is issued on 1 August; if it is unpaid on 1 September, the fee is charged on 1 September. The place for the unpaid month lasts through the end of that month. No further membership month is created for that non-payment.
- Q: When can the client cancel, and which month is still paid? → A: The client may cancel their own Membership. On or before the **20th**, the place lasts through the end of the current month and the next month is not charged. After the 20th, the cancellation is still accepted, the next month is still charged on the 1st, and the place lasts through the end of that next month.

---

## Gap analysis (current → target)

Inspected: GitHub issue #14 (authoritative), constitution, project context, baseline requirements (`FEAT-LES-002`, unused memberships/credits, `BC-CAMP-002`), domain model §2.8–2.9, live unused `memberships` / `credits` tables, `/lessons` catalogue grouping, Terms “Membership Cancellation Conditions”, F1.04 field-protection, F1.08 Groups (#13), F1.10 Sessions (#15), F1.11 Booking (#16), F1.12 adult cancellations (#17), F1.13 Recovery (#18), F1.25 Camps (#36), F1.26 automatic collection (#54). Confirmed unless marked assumption.

| F1.09 rule | Current | This spec |
|---|---|---|
| Adult Membership = Client + one recurring Group | Unused `memberships` rows (0). Domain notes describe a **credit/token wallet** tied to a future plan, not a Group place. No live Group, Session, Level, or Club product. | **Add** Membership as a recurring **fixed-place commitment**: exactly one Client and exactly one Group. **Do not** introduce a generic credit balance. Unused credit-token semantics in the domain notes are **superseded for adults** by this issue. |
| Active Membership gives a fixed Group place across generated Sessions | No Group roster. F1.08 (not specified/built) will hold Group fixed participants. F1.10 will generate Sessions. F1.11 will own Booking capacity. | **Add** the commercial/lifecycle source of an adult fixed place. Recognition on generated Sessions and Booking duplicate-prevention are **contracts** with F1.08 / F1.10 / F1.11 — this spec does not reimplement Group CRUD, Session generation, or the Booking engine. |
| Lifecycle: Pending Payment, Active, Paused, Cancelled, Expired | Unused table has a boolean `active` only. | **Add** those five states, reject invalid transitions, and keep an auditable history of valid changes. |
| Manual Admin activation | No activation workflow. Lesson “Adult Memberships” on `/lessons` are catalogue products booked like any lesson (`is_subscription = true`). | **Add** Admin-only create + manual activate. Automatic activation from confirmed payment is **out** (Phase 2 / F1.26). |
| Monthly charge on the 1st, and a 10% fee if that month stays unpaid | No membership billing calendar. F1.26 must not invent one. | **Add** one chargeable calendar-month period on the 1st for an Active Membership. If that period is still unpaid on the 1st of the next month, **add** one cancel-fee intent of 10% of that month’s price and do not open another membership month. F1.26 issues the invoices. |
| Cancelling one Session does not cancel the Membership | No customer cancel action (copy-only 48 h). F1.12 will own adult Session cancellation. | **Guarantee** the Membership and Group assignment stay intact when a single Session is cancelled. Delegate the cancellation/Recovery rules to F1.12 / F1.13. |
| Membership cancellation stops future participation; history remains | Live Terms require notice by the 1st of the previous month, no refund, otherwise auto-renew. **Not enforced** in the application. The 2026-10-05 answer stopped the place at the end of the already-paid month and left the Terms notice unenforced. | **Replace** that notice with the 20th cutoff (session 2026-10-31). The client or an Admin may cancel. On or before the 20th, the place lasts through the end of the current month and the next month is not charged. After the 20th, the next month is still charged and the place lasts through the end of that next month. History is preserved. |
| Academy closures keep the Group assignment | No closure product. | **Keep** the fixed Group assignment across academy closures. Money adjustments belong to pricing/financial features, not here. |
| Authorization | Students cannot write academy-controlled membership/group fields (F1.04 FR-004). Admins manage clients. Coaches have roster-only access. Unused memberships table allows the owner to read their own row. | **Admin-only** create / activate / pause / expire. The owning client **may cancel** their own Membership under FR-012. An Admin may cancel any Membership. Clients may view their own Membership. Coaches do not get unrestricted Membership management. Server-side authorization is authoritative. |
| Catalogue label “Adult Memberships” | `/lessons` splits cards into Adult Memberships vs Individual Sessions (`FEAT-LES-002`). Those are bookable lesson products with invoices, not Group places. | **Keep separate** (Q1, Option A): the `/lessons` booking path stays; F1.09 is an Admin-created Group commitment beside it. |
| Camp academy-member price | F1.25: parent self-declares membership; F1.25 spec promises F1.09 will auto-check Active (and Pending Payment) membership at Camp registration. **Not in issue #14.** | **Out of this issue’s scope.** Do not implement the Camp handover here unless product later adds it to F1.09. |

**Does not replace** `001` (lesson catalogue/booking), `007` (Bexio/invoices), `005`/`009` (client identity), or `006`/`008` (roles). Neighboring features F1.08, F1.10, F1.11, F1.12, F1.13, F1.26 remain the owners of Groups, Sessions, Booking, Session cancellation, Recovery, and automatic collection.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin creates an adult Membership (Priority: P1)

An Admin selects a valid existing Client and a valid recurring Group and creates a Membership that is associated with exactly one of each. The Membership starts in a supported lifecycle state (normally Pending Payment) and is visible to that Admin afterwards. A student, coach, or visitor cannot create a Membership.

**Why this priority**: Without a Membership record linked to one Client and one Group, nothing else in this feature can exist.

**Independent Test**: As Admin, create a Membership for Client A and Group G. Confirm it is stored as A+G only. Repeat as a student and as a coach — both attempts are refused. Creating a second Membership for the same Client and the same Group while the first is still a competing live state is refused.

**Acceptance Scenarios**:

1. **Given** an Admin, a valid Client, and a valid Group, **When** the Admin creates a Membership, **Then** exactly one Membership exists for that Client and that Group in a supported starting state (Pending Payment unless the Admin is also completing activation in the same authorized flow).
2. **Given** an Admin, **When** they attempt to create a Membership without a Client or without a Group, **Then** the create is refused and no Membership is stored.
3. **Given** a student, coach, or unauthenticated visitor, **When** they attempt to create a Membership (including by bypassing the Admin screen), **Then** the attempt is refused.
4. **Given** Client A already has a live Membership (Pending Payment, Active, or Paused) for Group G, **When** an Admin tries to create another Membership for A+G, **Then** the second create is refused so there are no duplicate fixed places in the same Group.

---

### User Story 2 - Admin manually activates a Membership (Priority: P1)

An Admin reviews a Membership that is waiting for payment and explicitly marks it Active. Payment confirmation from the bank or accounting system does **not** activate it in this slice. After activation, the academy treats the Client as holding the fixed place in that Group.

**Why this priority**: Issue #14 states activation is currently manual; automatic activation is Phase 2.

**Independent Test**: Activate a Pending Payment Membership as Admin — it becomes Active. Attempt the same as a student — refused. Observe that a paid invoice alone (without Admin activation) leaves the Membership not Active.

**Acceptance Scenarios**:

1. **Given** an Admin and a Membership in Pending Payment, **When** the Admin activates it, **Then** the Membership is Active and the change is auditable (who, when, from/to state).
2. **Given** a non-Admin, **When** they attempt to activate a Membership, **Then** the Membership stays Pending Payment.
3. **Given** a Membership whose related invoice or bank payment is already confirmed, **When** no Admin activation has occurred, **Then** the Membership is still not Active in this slice.
4. **Given** a Membership that is Cancelled or Expired, **When** an Admin attempts the normal Pending-Payment activation, **Then** the transition is refused.

---

### User Story 3 - Active Membership confers a fixed Group place without duplicate reservations (Priority: P1)

Once a Membership is Active, the Client is recognized as a fixed participant of that Group’s generated Sessions. The academy does not also create a separate ordinary Booking merely to keep that person assigned. Capacity and duplicate-reservation rules stay with Group / Session / Booking owners; this feature supplies the Membership fact they consult.

**Why this priority**: This is the product meaning of an adult Membership (issue objective).

**Independent Test**: With Membership Active for A in Group G, generated Sessions of G list A as a fixed participant. No second overlapping fixed place or duplicate Booking is created for A on those Sessions from the Membership itself.

**Acceptance Scenarios**:

1. **Given** an Active Membership for Client A and Group G, **When** Sessions are generated for G, **Then** A is recognized as a fixed participant of those Sessions.
2. **Given** that Active Membership, **When** the system would otherwise create a normal Booking only to express the same fixed place, **Then** it MUST NOT create a duplicate reservation for A on that Session.
3. **Given** a Membership that is not Active (Pending Payment, Paused, Expired, or Cancelled whose FR-012 effective date has passed), **When** Sessions are generated for G, **Then** A is not treated as a current fixed participant from that Membership.
4. **Given** a Cancelled Membership whose FR-012 effective date has NOT passed (still inside the already-paid month), **When** Sessions are generated for G, **Then** A remains a fixed participant until that effective date.
5. **Given** two different Clients with Active Memberships in Group G, **When** Sessions are generated, **Then** both are recognized as distinct fixed participants (no collapsing of people).

---

### User Story 4 - Cancelling one Session leaves the Membership intact (Priority: P1)

A Client or Admin cancels a single Session reservation according to the academy’s Session-cancellation feature. The Membership stays Active (or in its previous state). The Client keeps the recurring Group / fixed place for other Sessions. Recovery, if any, is created by the Recovery feature — not by inventing a credit balance here.

**Why this priority**: Explicit acceptance criterion and a documented failure mode if Membership were modelled as a wallet of remaining classes.

**Independent Test**: Cancel one Session for an Active member. Membership remains Active, Group assignment unchanged, historical records still present. No generic credit is minted here.

**Acceptance Scenarios**:

1. **Given** Client A with an Active Membership in Group G and a concrete Session S of G, **When** S is cancelled through the canonical adult cancellation feature, **Then** the Membership remains Active and the Group assignment is unchanged.
2. **Given** that cancellation, **When** historical Sessions, Bookings, Attendance, or Recovery records for A are inspected, **Then** they still exist and still belong to A.
3. **Given** a valid cancellation that entitles Recovery, **When** Recovery is created, **Then** it is created by the Recovery feature as a domain entitlement — not as a Membership credit balance.
4. **Given** this feature alone, **When** no cancellation product is present yet, **Then** F1.09 still MUST NOT offer a “cancel Membership by cancelling one Session” action.

---

### User Story 5 - Client or Admin cancels a Membership and history is preserved (Priority: P1)

The owning client, or an Admin, cancels a Membership when the client should no longer keep the recurring place. The 20th decides whether the next month is still charged. Past Sessions, Bookings, Attendance, and Recovery remain. A cancelled Membership may still retain Recovery entitlements that were generated while it was Active; those rules stay with Recovery.

**Why this priority**: Stopping the commitment without destroying history is a stated Definition of Done item, and the product owner set the 20th as the notice cutoff.

**Independent Test**: Cancel an Active Membership on the 20th and another after the 20th. The first keeps the place only through the current month and creates no next-month charge. The second still cancels, creates the next month’s charge, and keeps the place through the end of that next month. A client cannot cancel another person’s Membership. Historical records remain.

**Acceptance Scenarios**:

1. **Given** the owning client or an Admin, and an Active (or Paused / Pending Payment) Membership, **When** they cancel it on or before the 20th, **Then** the Membership is Cancelled, the change is auditable, the place lasts through the end of the current month, and the next month is not charged.
2. **Given** the same actors, **When** they cancel after the 20th, **Then** the cancellation is accepted, the next month is still charged on the 1st, and the place lasts through the end of that next month.
3. **Given** that cancellation, **When** historical Sessions, Bookings, Attendance, and Recovery are inspected, **Then** none were deleted or reassigned.
4. **Given** Recovery entitlements created from valid Session cancellations while the Membership was Active, **When** the Membership is cancelled, **Then** those Recovery records are not deleted by this feature.
5. **Given** a client, coach, or visitor, **When** they attempt to cancel a Membership they do not own, **Then** the attempt is refused.

---

### User Story 6 - Lifecycle transitions are enforced and auditable (Priority: P2)

The academy can tell which state a Membership is in. Illegal jumps (for example Expired → Active via the ordinary activation path, or a client changing any state other than cancelling their own Membership) are refused. Every successful state change leaves a record of who did it, when, and which states were involved.

**Why this priority**: Required for operational trust and for later automatic activation (F1.26) to have a single state machine to signal.

**Independent Test**: Attempt invalid transitions as Admin — all refused, stored state unchanged. Perform a valid activation and a valid cancellation — both appear in the audit history.

**Acceptance Scenarios**:

1. **Given** a Membership in a given state, **When** an unauthorized or undefined transition is requested, **Then** the request is refused and the stored state is unchanged.
2. **Given** a valid Admin transition, **When** it completes, **Then** an audit record exists with actor, time, previous state, and new state.
3. **Given** a Paused Membership, **When** an Admin resumes it to Active, **Then** the Client is again a fixed participant and the transition is auditable.
4. **Given** an Expired Membership, **When** anyone requests ordinary activation or pause, **Then** the transition is refused (a new Membership may be created instead if US1 allows it).

---

### User Story 7 - Client can see their own Membership; others cannot manage it (Priority: P2)

The Client can see that they have a Membership, which Group it is for, and whether it is waiting for payment, Active, Paused, Cancelled, or Expired. They can cancel their own Membership under the 20th rule. They cannot create, activate, or pause one. Another Client cannot see or change it. Coaches do not receive an unrestricted Membership-admin surface.

**Why this priority**: Privacy and F1.02/F1.04 ownership rules; secondary to Admin operations.

**Independent Test**: Client A sees only A’s Memberships. Client B is denied A’s Membership. Coach cannot activate or create. Admin can still manage A’s Membership.

**Acceptance Scenarios**:

1. **Given** Client A with a Membership, **When** A opens their Membership information, **Then** they see their own Membership(s) including Group and current state.
2. **Given** Client B, **When** they request A’s Membership by identifier, **Then** access is denied.
3. **Given** a coach, **When** they attempt create/activate/cancel on a Membership they do not own as a Client, **Then** the attempt is refused.
4. **Given** a deactivated Client (F1.04), **When** they view history, **Then** they can still see past Membership records; they cannot obtain a new Active fixed place until the client is active again and an Admin creates/activates according to this spec.

---

### User Story 8 - Monthly charge on the 1st and a fee if it stays unpaid (Priority: P1)

On the 1st of each calendar month, an Active Membership becomes one chargeable period for that month. F1.26 turns that period into the invoice. If that period is still unpaid when the next 1st arrives, the place for the unpaid month has already run to the end of that month, and F1.09 adds one cancel fee of 10% of that month’s membership price instead of opening another membership month.

**Why this priority**: The product owner required automatic monthly billing and a non-payment fee. F1.26 cannot choose this calendar.

**Independent Test**: An Active Membership produces one August charge on 1 August and no second August charge if the job runs again. If August is unpaid on 1 September, one fee of 10% of the August price exists and September is not opened as a membership month. If August was paid, 1 September opens September only.

**Acceptance Scenarios**:

1. **Given** an Active Membership, **When** the 1st job runs, **Then** exactly one chargeable period exists for that calendar month, including after a retry.
2. **Given** that period was issued on 1 August and is still unpaid on 1 September, **When** the 1st job runs, **Then** one cancel-fee intent of 10% of the August membership price exists, the place is not extended into September, and no September membership period is created.
3. **Given** the August period is paid before 1 September, **When** the 1st job runs, **Then** September is the membership period and no August fee is created.
4. **Given** a Membership cancelled on or before the 20th, **When** the next 1st arrives, **Then** that next month is not charged.
5. **Given** a Membership cancelled after the 20th, **When** the next 1st arrives, **Then** that next month is charged once and the place lasts through the end of that month.

---

### Edge Cases

- Creating a Membership for a deactivated Client is refused (the person is still the same Client historically, but they are not eligible for a new live fixed place until reactivated).
- Creating a Membership for a missing, invalid, or non-recurring Group is refused. This feature does not invent a Group.
- A Client MAY hold Memberships in **different** Groups at the same time; they MUST NOT hold two live (Pending Payment, Active, or Paused) Memberships in the **same** Group.
- Academy closure days do not clear the Group assignment on an Active or Paused Membership; whether a particular Session exists that day is owned by the calendar/closures features.
- Individual Session cancellation, late cancellation, and No Show do not change Membership state.
- Cancelled and Expired are terminal for that Membership record; returning the person to the Group requires a new Membership (or an explicit Admin correction path, which this spec does not add).
- Pause is Admin-operable in this slice (Q3, Option A): pausing an Active Membership stops the fixed place while Paused; resuming returns the Membership to Active. Clients cannot self-pause.
- Payment recorded in accounting without Admin activation does not grant a fixed place.
- Direct identifier guessing or hidden-button bypass is denied the same way as the UI.
- Unused credit-token balances MUST NOT be consulted or incremented to represent a Membership place or a cancelled Session.
- A chargeable month is created on the 1st only for an Active Membership, and for a Membership cancelled after the 20th of the previous month whose next month has not yet been charged. A Paused or Pending Payment Membership does not start a new month.
- Cancelling on the 20th is on time. Cancelling on the 21st charges the next month.
- If the month issued on the 1st is still unpaid on the 1st of the next month, the 10% fee is created and that Membership does not receive another membership-month charge. Paying the original month later does not remove the fee.
- The fee uses the price already on that month’s charge. This feature does not send the invoice; F1.26 does.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: An adult Membership MUST be associated with exactly one Client and exactly one recurring Group. The Client MUST be the existing application profile (F1.04). The Group MUST be the academy’s recurring Group (F1.08). The system MUST NOT invent a second person record or a second Group merely to store the Membership.
- **FR-002**: A Membership MUST NOT be a generic credit wallet, token balance, or remaining-class counter. Recovery entitlements stay owned by F1.13.
- **FR-003**: Only an Admin MAY create, activate, pause, resume, or expire a Membership. The owning client MAY cancel their own Membership, and an Admin MAY cancel any Membership. A client, coach, or visitor MUST NOT cancel a Membership they do not own, and MUST NOT create, activate, pause, resume, or expire one, including by calling the backend directly.
- **FR-004**: Membership creation MUST refuse a missing/invalid Client, a missing/invalid Group, a deactivated Client, or a second live Membership for the same Client and same Group.
- **FR-005**: Supported lifecycle states are **Pending Payment**, **Active**, **Paused**, **Cancelled**, and **Expired**. Invalid transitions MUST be rejected. Valid changes MUST be auditable (actor, time, previous state, new state).
- **FR-006**: Membership activation in this slice MUST be an explicit Admin action. Confirmed payment MUST NOT by itself activate the Membership. Automatic activation from confirmed payment is deferred (Phase 2 / F1.26).
- **FR-007**: An Active Membership MUST cause the Client to be recognized as a fixed participant for generated Sessions of the linked Group.
- **FR-008**: Fixed-place participation MUST integrate with the canonical Session and Booking model so that the Membership does not create duplicate fixed participants or duplicate Bookings for the same Client and Session. Group capacity, Session generation, and Booking concurrency remain owned by F1.08, F1.10, and F1.11 respectively.
- **FR-009**: Cancelling an individual Session MUST NOT cancel the Membership, MUST NOT remove the recurring Group assignment, and MUST NOT delete historical Sessions, Bookings, Attendance, or Recovery. Session-cancellation eligibility and Recovery creation MUST be delegated to F1.12 and F1.13.
- **FR-010**: Cancellation by the owning client or by an Admin MUST stop future participation from that Membership according to FR-012, MUST NOT delete historical Sessions, Bookings, Attendance, or Recovery, and MAY leave Recovery entitlements that were generated while the Membership was Active.
- **FR-011**: Pause MUST be Admin-operable in this slice (Q3, Option A): an Admin MAY pause an Active Membership — the fixed place stops while Paused — and MAY resume a Paused Membership to Active. Clients MUST NOT self-pause.
- **FR-012**: Calendar dates use the academy timezone. The 20th is included in the on-time side. When the owning client or an Admin cancels on or before the 20th, the place lasts through the end of the current month and the next month MUST NOT be charged. When they cancel after the 20th, the cancellation is accepted, the next month MUST still be charged on the 1st, and the place lasts through the end of that next month. Historical participation before the effective date remains. The published Terms notice (by the 1st of the previous month) is replaced by this cutoff.
- **FR-013**: Academy closures MUST NOT clear the Membership’s Group assignment. Financial adjustments for closed days belong to pricing/financial workflows, not this feature.
- **FR-014**: Clients MAY view their own Memberships (Group and state) and MAY cancel only their own. They MUST NOT view or cancel another Client’s Membership. Coaches MUST NOT receive unrestricted Membership administration. F1.04 deactivation MUST prevent a new live fixed place until the Client is active again; historical Membership rows remain attached to the same Client.
- **FR-015**: Authorization for these requirements MUST be enforced on the server. Hiding a control is not sufficient.
- **FR-016**: This feature MUST remain compatible with the existing invoice / bank-transfer architecture (no Stripe/card payments). It MUST NOT add a second accounting system and MUST NOT treat invoice issue as Membership activation.
- **FR-017**: The live `/lessons` catalogue grouping “Adult Memberships” vs “Individual Sessions” MUST remain a separate bookable lesson-product path (Q1, Option A). F1.09 Memberships are Admin-created Group commitments beside it; this slice MUST NOT remove, rename, replace, or auto-convert that catalogue path, and buying a catalogue “Adult Membership” product MUST NOT by itself create an F1.09 Membership.
- **FR-018**: Camp member-price automatic check, member-only Camp price display, and pending-membership-payment Camp admin flags are **not** requirements of issue #14. They stay with F1.25’s interim self-declaration until a later approved handover.
- **FR-019**: Level and Club rules MUST be reused from their owning features (F1.05, F1.07) when a Group already carries them. Membership MUST NOT implement a second level-comparison or club-assignment algorithm.
- **FR-020**: Existing lesson bookings, Camp registrations, invoices, and client profiles MUST keep working unchanged except for the additive Membership behaviour above.
- **FR-021**: On the 1st of each calendar month, an Active Membership MUST produce exactly one chargeable period for that month, including after a retry. A Membership cancelled after the 20th of the previous month MUST still produce that next month once. A Paused or Pending Payment Membership MUST NOT start a new month. This feature creates the chargeable period only. F1.26 issues and collects the invoice. Invoice issue MUST NOT by itself activate the Membership.
- **FR-022**: If a month’s charge is still unpaid on the 1st of the next month, F1.09 MUST create exactly one cancel-fee intent of 10% of that month’s membership price and MUST NOT create another membership-month charge for that non-payment. The place for the unpaid month lasts through the end of that month and no further. Paying the original month after the fee exists MUST NOT remove the fee. F1.26 invoices the fee; this feature does not send it.

### Key Entities

- **Client** — the existing application profile of an authenticated person (F1.04). Not a second customer table.
- **Group** — a recurring academy training arrangement (F1.08). Membership does not create Groups.
- **Membership** — the adult commercial and lifecycle commitment linking exactly one Client to exactly one Group, with states Pending Payment, Active, Paused, Cancelled, Expired. Source of the adult fixed place. Not a credit wallet.
- **Fixed place** — the right of an Active Membership’s Client to be treated as a standing participant of that Group’s generated Sessions, without a duplicate ordinary Booking solely to express that standing assignment.
- **Session** — a concrete occurrence generated from a Group (F1.10). Cancelling one Session is not cancelling the Membership.
- **Booking** — canonical reservation of a concrete Session (F1.11). Membership fixed-place must not duplicate it.
- **Recovery** — domain entitlement from a valid Session cancellation (F1.13). May outlive a cancelled Membership; not a Membership credit.
- **Audit record** — who changed a Membership, when, from which state to which state.
- **Lesson catalogue “Adult Memberships”** — existing `/lessons` products with `is_subscription = true`. Confirmed distinct from the F1.09 Membership entity (Q1, Option A): a separate bookable product path that does not create or become an F1.09 Membership.
- **Chargeable month** — one calendar month of an Active Membership, created on the 1st, with that month’s membership price. Not an invoice.
- **Cancel fee** — one charge of 10% of an unpaid month’s membership price, created on the 1st of the next month. Not a second membership month.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Admin can create a Membership for a valid Client and Group in under 2 minutes once both records are chosen, and 100% of creates without a Client or Group are refused.
- **SC-002**: 100% of non-Admin attempts to create or activate a Membership are refused; stored Memberships are unchanged.
- **SC-003**: After Admin activation, 100% of generated Sessions of the linked Group in a subsequent check recognize that Client as a fixed participant; a non-Active Membership yields 0% recognition from that Membership.
- **SC-004**: Activating or attaching a Membership never produces a second overlapping Booking for the same Client and Session solely to represent the fixed place (duplicate count = 0).
- **SC-005**: After a single Session cancellation, 100% of inspected Memberships remain in the same lifecycle state they had before that cancellation, and the Group assignment is still present.
- **SC-006**: After a cancellation on or before the 20th, Sessions after the current month no longer treat the Client as a fixed participant and the next month is not charged. After a cancellation after the 20th, the next month is charged once and Sessions after that next month no longer treat the Client as a fixed participant. In both cases, 100% of previously stored historical Session, Booking, Attendance, and Recovery records for that Client still exist.
- **SC-011**: On a given 1st, 100% of Active Memberships have exactly one chargeable period for that month. 100% of months still unpaid on the following 1st have exactly one fee of 10% of that month’s price and zero further membership-month charges. A paid month produces zero fees.
- **SC-007**: 100% of undefined lifecycle transitions are refused; every successful state change has an audit entry that a reviewer can match to actor and from/to states.
- **SC-008**: 100% of Client B attempts to read or change Client A’s Membership are denied; Client A can still see their own Membership state on the first try.
- **SC-009**: No new card-payment path and no generic credit balance appear in Membership create, activate, Session cancel, or Membership cancel checks.
- **SC-010**: Existing `/lessons` booking and invoice flow for current catalogue products still completes for a returning student after this feature is present (no re-registration, no broken Book Now); the catalogue path remains separate per FR-017.

---

## Assumptions

- Issue #14 is authoritative over older domain notes that described Membership as a credit-token wallet. Those notes remain as **historical discrepancy** (`domain-model.md` §2.8–2.9, baseline “Memberships / credit tokens”). Planning MUST NOT revive a generic credit balance to satisfy F1.09.
- Client = existing profile. Group, Session, Level, Club, Booking engine, Session cancellation, and Recovery are neighboring F1 features (F1.08, F1.10, F1.05, F1.07, F1.11, F1.12, F1.13). This spec defines Membership behaviour and the **contracts** those features consume; it does not specify their internal design.
- Implementation of US3 (fixed place on generated Sessions) is **blocked on an identifiable Group and Session generation**. Specify can proceed; build order is Groups (F1.08) then Sessions (F1.10) / Booking (F1.11) consuming this Membership rule.
- Starting state on create is **Pending Payment** unless the Admin is explicitly activating in the same authorized operation.
- A “live” Membership for duplicate-place checks means Pending Payment, Active, or Paused. Cancelled and Expired do not block a later new Membership for the same Client+Group.
- Clients cannot self-serve subscribe in this slice (Admin-only create), matching issue #14. They can cancel their own Membership under FR-012. F1.26 adds client auto-pay opt-in on an existing Membership.
- Manual activation workflow: Admin opens the Membership and confirms activation. No extra payment-proof UI is required here; the academy may use existing invoice/bank tools out of band.
- The monthly membership price is the amount F1.09 puts on that month’s chargeable period. The cancel fee is 10% of that amount. This spec does not add a separate price catalog.
- The published Terms notice (by the 1st of the previous month) is replaced by the 20th cutoff in FR-012. The website copy is stale until someone updates it. No refund rule in the Terms is unchanged; this spec still does not add a refund.
- F1.26 owns issuing and collecting the invoice and the fee. F1.09 owns the 1st calendar, the 20th cutoff, the 10% fee intent, and the Membership state.
- Coach access stays F1.02 roster semantics; this spec does not add a coach Membership-admin screen.
- English UI copy may say “Membership”; the GitHub title remains “Memberships de adultos”.
- Swiss personal data on a Membership (who is assigned to which Group) is visible to the owning Client and to Admins; not to other Clients.

---

## Dependencies

- **F1.04 / `009`** — Client identity and deactivation.
- **F1.02 / `006`+`008`** — Admin vs student vs coach authorization.
- **F1.08 (issue #13)** — Group as the recurring structure and operational roster/capacity. Not built.
- **F1.10 (issue #15)** — Session generation that recognizes Active Membership fixed participants. Not built.
- **F1.11 (issue #16)** — Canonical Booking without duplicate Membership reservations. Not built.
- **F1.12 (issue #17)** — Adult Session cancellation; MUST leave Membership/Group intact.
- **F1.13 (issue #18)** — Recovery entitlements; MUST NOT be replaced by a Membership credit.
- **F1.03 / `007`** — Existing invoice/bank-transfer path; no Stripe; no second ledger.
- **F1.26 (issue #54)** — Issues and collects the monthly period and the 10% cancel fee. It does not choose the calendar, the cutoff, or the fee. Automatic activation from payment remains F1.26’s signal, not this slice.
- **F1.05 / F1.07** — Level and Club, reused via Group, not reimplemented here.

---

## Non-goals

- Automatic activation or renewal from confirmed payment (F1.26 / Phase 2).
- Stripe, card payments, or a second payment processor.
- Generic credit wallet, token earn/redeem, or remaining-class counters.
- Implementing Group CRUD, Session generation, Booking concurrency, Session cancellation rules, Recovery expiry, Attendance persistence, Level algorithms, or Club management.
- Replacing or converting the live `/lessons` “Adult Memberships” catalogue (Q1, Option A: keep separate).
- Camp member-price automatic membership detection (F1.25 handover) — not in issue #14.
- Client self-service purchase of a Group Membership.
- Sending the invoice or the fee (F1.26) and choosing a payment rail.
- Kids semesters, trials, one-off classes, waitlist, or trips/tournaments.
- Hard-deleting Membership or participation history.

---

## Compatibility

- Preserve `/lessons` catalogue and booking (`001`); Q1 (Option A) keeps that path separate from F1.09.
- Preserve F1.03 invoice/QR/bank-transfer; invoice issue ≠ Membership Active.
- Preserve F1.04 profile-as-client; Membership attaches to that profile.
- Preserve F1.02 server-side authorization; Membership is academy-controlled (students cannot write it — already named in F1.04 FR-004).
- Preserve unused `credits` table without putting it into this product path (constitution: do not delete tables unless instructed).
- Do not modify F1.25 Camp registration in this slice.
- Do not rewrite historical lesson bookings to look like Memberships.

---

## Discrepancies (documentation vs issue #14)

These are recorded so planning does not “fix” them by inventing a hybrid product:

1. **`domain-model.md` §2.9 / baseline unused `memberships`**: Membership described as subscription + future credit drawdown (`plan_id`, `active` boolean). Issue #14 forbids a generic credit-balance model and requires Client+Group+lifecycle states. **Issue wins.** Schema evolution is a planning concern; this spec does not prescribe tables.
2. **Baseline TODO `memberships-credits`**: “tokens from weeks-in-month and academy-open; academy redeems into classes.” **Superseded for adult Memberships** by issue #14. Token redeem is not F1.09.
3. **F1.08 “Group can contain fixed participants”** vs **F1.09 “Active Membership gives the fixed place”**: treated as one adult place with two layers (Membership = commercial source; Group roster = operational list), not two independent adult rosters. If product instead wants Group-only rosters with Membership as billing-only, that would contradict issue #14’s objective and must be an explicit change to the issue.
4. **F1.25 FR-017a handover** (auto Active/Pending-Payment check at Camp registration) is a Camps commitment **not present** in issue #14. Left out of F1.09 requirements (FR-018).
5. **Live Terms** specify notice by the 1st of the previous month. The product owner replaced that with the 20th cutoff on 2026-10-31 (FR-012). The website copy is stale until it is edited. The spec does not silently keep the old Terms rule.

---

## Baseline coverage

| ID | Covered? |
|---|---|
| FEAT-LES-002 (catalogue Adult Memberships) | Preserved (FR-017 resolved: keep separate) |
| FEAT-BKG-* lesson booking | Preserved (FR-020) |
| XR-005 no Stripe | Preserved (FR-016) |
| BC-CAMP-002 member-price self-declare | Unchanged (FR-018) |
| Unused memberships/credits capability | Product meaning redefined by this spec; credits unused |

---

## Open questions

All three `[NEEDS CLARIFICATION]` markers were resolved on 2026-10-05 via GitHub issue #14 (see Clarifications):

1. **FR-017 — live catalogue “Adult Memberships”**: **Option A — keep them separate.** `/lessons` booking stays; F1.09 is an Admin-created Group commitment beside it.
2. **FR-012 — cancellation effective date**: **Option B — end of the already-paid month.** The place continues through the current billed period; the live Terms notice rule stays unenforced.
3. **FR-011 — Pause**: **Option A — operable now.** Admin can Pause (fixed place stops) and resume to Active.

Related items never given a marker (defaults in Assumptions / Non-goals): Camp F1.25 handover stays out; automatic activation stays out; unused credit-token model stays out; Groups/Sessions remain neighboring owners.
