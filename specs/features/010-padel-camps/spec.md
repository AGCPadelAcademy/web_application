# Feature Specification: Padel Camps / Camps Registration (F1.25)

**Feature Branch**: `010-padel-camps`

**Created**: 2026-09-08

**Status**: Draft

**Input**: GitHub issue #36 — F1.25 Padel Camps / Camps Registration System. A reusable Camps / Events registration system so parents can discover a Padel Camp, register a child, select optional extras, receive an automatically generated invoice through the existing financial/accounting boundary, pay by bank transfer, and receive an automatic confirmation once payment is confirmed. Camp configuration, capacity, extras, registration windows, pricing and practical information must be manageable from Admin and must not be hardcoded around the first offering.

> **Forward spec (delta).** Living as-is for lesson booking remains [`001-lesson-booking`](../001-lesson-booking/spec.md). Living as-is for invoicing and Bexio financial operations remains [`007-bexio-integration`](../007-bexio-integration/spec.md) (F1.03). Living as-is for roles remains [`006-roles-and-permissions`](../006-roles-and-permissions/spec.md) / [`008-roles-and-permissions`](../008-roles-and-permissions/spec.md) (F1.02). Living as-is for client/profile identity remains [`009-client-management`](../009-client-management/spec.md) (F1.04). Marketing-only Spain trips remain [`FEAT-TRP-001`](../../baseline-system/requirements.md). This file states only what F1.25 adds.
>
> GitHub feature ID is **F1.25**. Spec folder follows sequential numbering under `specs/features/` (`010-padel-camps`), not the Notion path `specs/phase-1/F1.25-padel-camps/`.

---

## Gap analysis (current → target)

Inspected: GitHub issue #36, constitution, project context, baseline requirements (`FEAT-PUB-*`, `FEAT-TRP-001`, `FEAT-BKG-*`, `FEAT-LGL-*`, `XR-*`), reverse specs `001`–`006`, F1.03 (`007`), F1.02 (`008`), F1.04 (`009`), F1.16 issue #21 (waitlist, **Needs Spec** — not implemented), public routes, admin dashboard, and notification/email audit. Confirmed unless marked assumption.

| F1.25 rule | Current | This spec |
|---|---|---|
| Public Camps landing at `/camps` | No `/camps` route. Header/footer expose Home, Lessons, Trips, Tournaments, Contact. `/trips` is Spain travel marketing; CTA goes to `/contact` (`FEAT-TRP-001`). Camps are not bookable. | **Add** a public `/camps` discovery page for published academy Camps. **Keep** `/trips` as the existing Spain-trip marketing page. Camps are not lessons and are not trips. |
| Admin-managed Camp catalogue | Lesson catalogue is admin-edited data; Camps/events have no persisted catalogue. First Mini / Junior / Competition offering cannot be published without code. | **Add** Admin create/edit/publish/unpublish of Camps (name, description, dates, daily schedule, eligibility/ages, price, capacity, registration window, extras, practical information, published state). Mini / Junior / Competition values are **configuration**, not application logic. |
| Child registration | Lesson booking is for the authenticated student themselves (`FEAT-BKG-001`). There is no child-participant registration, no extras, no Camp eligibility check. | **Add** a parent/guardian registration for a child participant on a Camp, with extras, terms, eligibility, and a snapshot of pricing/context. |
| Parent/child vs client identity (F1.04) | The client **is** the authenticated profile (1:1 with login). There is no Child login and no second customer table. F1.04 forbids a parallel identity system. | **Reuse** the parent/guardian’s existing client profile as the customer. The child is a **participant captured on the registration**, not a second login. Do not create a parallel customer identity for Camps. |
| Invoice through F1.03 | F1.03 V1 eligibility is lesson bookings only; events/camps were reserved as future sources of the same financial boundary (`007` FR-013). Invoice email uses the existing notification path. Payment is confirmed only by financial reconciliation. | **Extend** that boundary so a valid Camp registration is a billable financial event: one idempotent invoice for the registration total, Camp + extras as line items, parent receives the invoice, payment is not implied by invoice creation. Camps MUST NOT call the accounting provider from the public/admin UI. |
| Capacity | Lessons have no public occupancy / last-place race (`FEAT-LES-004`–`008` retired). No Camp capacity. | **Add** Camp maximum places derived from canonical active registrations, enforced atomically, with a public full state (`Complet / Ausgebucht`). |
| Confirmation after payment | Lesson paid state comes from Bexio reconciliation. There is no Camp “you are confirmed, here is practical information” email. Invoice PDF email already exists for issued invoices (`007` FR-029a). | **Add** a Camp confirmation email **only** when payment is fully confirmed through the canonical financial workflow. Distinct from the invoice-delivery email. Idempotent. |
| Waitlist | F1.16 (issue #21) is not specified or built. No session or Camp waitlist exists. | **Add** an optional Camp waitlist that adopts F1.16 principles (does not consume capacity, deterministic order, conversion revalidates, no API bypass). Do **not** implement F1.16 session waitlist here. |
| Groups / calendar (F1.08 / F1.10) | No live group or session-calendar product. Lessons are catalogue products; the academy assigns class later. | Camps are **event-like commercial offerings** with configured start/end dates and daily hours. They MUST NOT be forced into recurring Group semantics. |
| Analytics | No conversion-tracking infrastructure in the live app. | **Add** the smallest funnel instrumentation for four events, without child/parent PII, without coupling Camps to a specific analytics vendor. |
| Admin registration operations | Admin tools: client directory, Bexio connection, coach assignment. No Camp or Camp-registration management. No CSV export of registrations. | **Add** Admin Camp management, registration list (pending vs paid/confirmed), remaining places, and authorized CSV/Excel-compatible export. |

**Does not replace** lesson booking, `/trips` marketing, F1.03 invoicing/reconciliation, F1.04 client identity, or F1.02 authorization. Those journeys stay in force.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin publishes a reusable Camp (Priority: P1)

An admin creates a Camp from configuration (name, description, dates, daily schedule, eligibility or age range, price, maximum places, registration opening and closing dates, optional extras, practical information) and publishes it. Later they can edit future capacity or unpublish it without deleting historical registrations. The first academy offering (Mini Camp 4–6 years CHF 199, Junior Camp 7–13 years CHF 349, Competition Camp for players with previous experience CHF 299) is entered as configuration, not as special-case product logic.

**Why this priority**: Without Admin-managed Camps, `/camps` cannot show real offerings and every new camp would need a code change. This is the client’s reusability requirement.

**Independent Test**: As admin, create and publish Camp A with two extras. As a visitor, see Camp A on `/camps`. Unpublish Camp A; it disappears from the public list while existing test registrations remain attached. Change capacity; subsequent availability uses the new maximum. A non-admin is refused.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they create a Camp with the required configuration and publish it, **Then** the Camp appears on `/camps` with its configured name, dates, schedule, eligibility, price, description, registration window/status, and a clear registration call to action.
2. **Given** a published Camp, **When** the admin unpublishes it, **Then** visitors no longer see it as an available offering, and existing registrations remain traceable to that Camp with their original prices and extras.
3. **Given** a Camp with existing registrations, **When** the admin increases or decreases future maximum places, **Then** subsequent availability checks use the new maximum and existing registrations are not invalidated or rewritten.
4. **Given** a student, coach, or visitor, **When** they attempt Admin Camp create/edit/publish, **Then** the operation is refused.
5. **Given** Mini, Junior, and Competition values supplied as configuration, **When** those Camps are published, **Then** they behave like any other Camp — the application does not special-case those names or prices.

---

### User Story 2 - Parent discovers published Camps on `/camps` (Priority: P1)

A parent arriving from Instagram, a Story, a QR code, WhatsApp, or a printed flyer opens `/camps` on a phone and sees published Camps with enough information to choose one: name, dates, hours, eligibility/ages, price, description, registration status or deadline, and whether places remain. Closed or full Camps are clearly marked (full uses wording such as `Complet / Ausgebucht`). A clear call to action starts registration when the Camp is open.

**Why this priority**: This is the client’s first V1 priority and the marketing URL for the whole journey.

**Independent Test**: Publish one open Camp, one unpublished Camp, one closed Camp, and one full Camp. Open `/camps` as a visitor on a mobile-width view. Only the intended published Camps appear, with correct status and CTAs.

**Acceptance Scenarios**:

1. **Given** published Camps, **When** a visitor opens `/camps`, **Then** they see each published Camp’s name, dates, schedule/hours, eligibility/ages, price, description, registration status/deadline, and availability where it is appropriate to show.
2. **Given** an unpublished Camp, **When** a visitor opens `/camps` or tries to open that Camp as an offering, **Then** it is not offered for registration.
3. **Given** a Camp whose registration window has not opened or has closed, **When** a visitor views it, **Then** they see a closed/not-open status and cannot submit a normal registration.
4. **Given** a full Camp, **When** a visitor views it, **Then** they see a full state such as `Complet / Ausgebucht` and cannot take a normal place.
5. **Given** a common mobile viewport, **When** a visitor browses `/camps` and a Camp detail, **Then** the layout, status, price, and CTA remain readable and usable without horizontal-only desktop chrome.

---

### User Story 3 - Parent registers a child and selects extras (Priority: P1)

An authenticated parent/guardian (the existing client) opens an open Camp with remaining places, enters child and parent details, optional extras, emergency contact, allergies/important information, and accepts terms. The running total updates when extras are selected. On submit, the system re-checks that the Camp is still open and has a place, validates eligibility, and creates exactly one registration. Retrying the same submission does not create a second registration. Invalid or incomplete input is rejected without a chargeable registration.

**Why this priority**: This is the client’s second V1 priority and the operational heart of the feature.

**Independent Test**: Sign in as parent A with a complete billing profile. Register an eligible child on an open Camp, select one extra, accept terms, submit twice. Exactly one registration exists; total equals base price + extra; snapshots retain the extra name and price. Repeat with an ineligible age and with the deadline passed — both refused.

**Acceptance Scenarios**:

1. **Given** an open Camp with remaining places and an authenticated parent with a usable client profile, **When** they complete child/parent details, extras, terms, review, and submit, **Then** exactly one registration is created for that child on that Camp.
2. **Given** extras on the Camp, **When** the parent selects or deselects an extra before submit, **Then** the displayed total equals the Camp base price plus the prices of currently selected extras, and after submit those selected extras and their prices are stored with the registration.
3. **Given** no extras selected, **When** the parent submits a valid registration, **Then** the total equals the Camp base price.
4. **Given** a Camp with a configured age range, **When** the child’s date of birth falls outside that range at the Camp start date, **Then** registration is refused and no chargeable registration is created.
5. **Given** a Camp with eligibility described only as experience (no age range), **When** the parent submits with the required experience/level field completed, **Then** registration is not refused solely for age.
6. **Given** a successful submit, **When** the parent retries or double-submits the same registration, **Then** a second registration and a second invoice are not created.
7. **Given** incomplete required fields or terms not accepted, **When** the parent submits, **Then** they see a clear validation error and no chargeable registration is created.
8. **Given** an unauthenticated visitor, **When** they start registration, **Then** they are sent through the existing sign-in/sign-up path and returned to the Camp registration (same pattern as lesson booking’s return-to behaviour).
9. **Given** a deactivated client (F1.04), **When** they attempt a new Camp registration, **Then** it is refused.

---

### User Story 4 - Registration produces one invoice; payment is separate (Priority: P1)

After a valid registration, the academy issues exactly one invoice for the registration total through the existing financial/accounting boundary. The invoice lists the Camp and any selected extras. The parent receives the invoice the same way they already receive lesson invoices (in-app access plus automatic invoice email). Creating the invoice does not mark the registration paid. The parent pays by bank transfer. Payment becomes confirmed only when the canonical financial reconciliation says the invoice is fully paid.

**Why this priority**: This is the client’s third V1 priority and the revenue path. It must reuse F1.03 rather than invent a second payments product.

**Independent Test**: Complete one valid registration. Confirm one invoice exists for that total with Camp and extra lines. Confirm registration is awaiting payment, not paid. Retry invoice after a timeout — still one invoice. Mark the invoice paid through the existing reconciliation path — registration becomes paid/confirmed.

**Acceptance Scenarios**:

1. **Given** a valid registration, **When** the financial operation runs, **Then** exactly one corresponding invoice is created for the validated total, with line items for the Camp and each selected extra.
2. **Given** an invoice already created for that registration, **When** issuance is retried (double submit, reload, timeout then retry), **Then** the existing invoice is reused and a second invoice is not created.
3. **Given** a newly invoiced registration, **When** the parent inspects status, **Then** they see awaiting payment (or equivalent), not paid/confirmed.
4. **Given** a full payment recorded through the canonical financial workflow, **When** synchronization runs, **Then** the registration is marked paid/confirmed without an admin typing the payment in the Camps screens.
5. **Given** a partial payment, **When** synchronization runs, **Then** the registration is not treated as fully paid/confirmed.
6. **Given** a student other than the registering parent, **When** they request that registration or its invoice, **Then** access is denied.
7. **Given** the accounting connection is temporarily unavailable after the registration is stored, **When** issuance is retried, **Then** the registration is not lost and a later successful issuance still produces only one invoice.

---

### User Story 5 - Capacity cannot be oversold (Priority: P1)

Available places are the Camp’s maximum minus canonical active registrations (not a hand-maintained counter). Two parents submitting for the last place cannot both receive it. A full Camp shows `Complet / Ausgebucht` and rejects further normal registrations. Cancelled or otherwise non-active registrations release a place. A waitlist entry, when waitlist is enabled, does not consume a place.

**Why this priority**: This is the client’s fourth V1 priority. Overselling a camp is an operational failure.

**Independent Test**: Set capacity to 1. Submit two valid concurrent registrations. At most one becomes an active place-holding registration. Public Camp shows full. Enable waitlist; a waitlist entry does not reduce remaining places further.

**Acceptance Scenarios**:

1. **Given** one remaining place and two concurrent valid registration attempts, **When** both are processed, **Then** at most one receives the final place and the other is refused or offered waitlist if enabled — never two active place-holding registrations.
2. **Given** a full Camp, **When** a parent tries a normal registration (including by repeating a previously valid request), **Then** it is refused and the public Camp shows a full state such as `Complet / Ausgebucht`.
3. **Given** an active registration that is cancelled while unpaid (where cancellation is allowed), **When** cancellation completes, **Then** a place is released for subsequent availability checks.
4. **Given** a waitlist-enabled full Camp, **When** a parent joins the waitlist, **Then** remaining places are unchanged.

---

### User Story 6 - Paid registration sends one confirmation email (Priority: P1)

Once payment is fully confirmed through the canonical financial workflow, the parent receives one confirmation email with child name, Camp, dates, schedule/hours, total amount, selected extras, and the Camp’s practical information. The invoice-issued email is not this confirmation. Re-running payment synchronization does not send a second confirmation.

**Why this priority**: This is the client’s fifth V1 priority and the operational close of the journey.

**Independent Test**: Confirm payment on a paid registration; one confirmation email is recorded as sent with the required content. Run reconciliation again; still one confirmation. Confirm that an unpaid invoiced registration has no confirmation email.

**Acceptance Scenarios**:

1. **Given** a registration whose invoice becomes fully paid, **When** confirmation processing runs, **Then** the parent receives one email containing child name, Camp name, dates, schedule/hours, total amount, selected extras, and practical Camp information.
2. **Given** a registration that is created or invoiced but not paid, **When** time passes, **Then** no Camp confirmation email is sent.
3. **Given** a confirmation already sent, **When** payment synchronization is reprocessed, **Then** a second confirmation email is not sent.
4. **Given** email delivery failure, **When** confirmation is retried, **Then** the registration and payment state remain intact and a later successful send still results in a single successful confirmation.

---

### User Story 7 - Full Camp can take a waitlist (Priority: P2)

When a Camp is full and waitlist is enabled for that Camp, a parent can join a waitlist for a child. The entry does not take a place and is not a paid registration. Queue order is deterministic (entry time). Direct identifier manipulation cannot skip the queue or exceed capacity. When a place becomes available, an admin can convert an eligible waitlist entry into a registration; conversion re-checks availability and eligibility at that moment. F1.16 session waitlist is not delivered here; only these principles are reused.

**Why this priority**: Required for full Camps, but the client ranked landing, registration, invoice, capacity, and confirmation first.

**Independent Test**: Fill a waitlist-enabled Camp. Parent B joins waitlist; capacity unchanged. Release one place. Convert B’s entry as admin; B gets a normal registration only if still eligible and a place still exists. A second conversion for the same place fails.

**Acceptance Scenarios**:

1. **Given** a full Camp with waitlist enabled, **When** an authenticated parent submits a waitlist entry for a child, **Then** exactly one active waitlist entry exists for that parent+child+Camp and no place is consumed.
2. **Given** an active waitlist entry, **When** the same parent tries a second active entry for the same child and Camp, **Then** it is refused.
3. **Given** two waitlist entries, **When** order is inspected, **Then** earlier entry time ranks ahead of later entry time.
4. **Given** a place becoming available, **When** an admin converts the next eligible waitlist entry, **Then** conversion succeeds only after revalidating capacity and eligibility, and produces a normal registration (then invoice) rather than a hidden bypass.
5. **Given** waitlist disabled or the Camp not full in a way that waitlist applies, **When** a parent tries to join waitlist via a direct request, **Then** they cannot obtain a place-holding registration through that path.
6. **Given** another parent’s waitlist identifier, **When** a parent requests or changes it, **Then** access is denied.

---

### User Story 8 - Admin reviews registrations and exports them (Priority: P2)

An admin opens Camp registrations and sees Camp, child, age, parent/guardian, phone, email, level/experience, extras, total, payment status, registration date, and remaining places. Pending-payment rows are visually and operationally distinct from paid/confirmed rows. The admin can export the list in a CSV/Excel-compatible file. Export and the list itself are admin-only.

**Why this priority**: Operations need the roster and payment view; export is explicitly requested where consistent with admin tooling.

**Independent Test**: Create one unpaid and one paid registration. As admin, distinguish them, see remaining places, export CSV with the listed fields. As a student, both the list and export are denied.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they open registrations for a Camp, **Then** they see Camp, child, age, parent/guardian, phone, email, level/experience, extras, total amount, payment status, registration date, and remaining places.
2. **Given** mixed unpaid and paid registrations, **When** the admin views the list, **Then** pending-payment and paid/confirmed are clearly distinguished.
3. **Given** an admin, **When** they export, **Then** they receive a CSV/Excel-compatible file of the authorized registration fields.
4. **Given** a non-admin, **When** they request the registration list or export, **Then** the operation is refused.

---

### User Story 9 - Conversion funnel can be counted without PII (Priority: P3)

The academy can count four conversion steps: Camps page visit, registration started, registration completed, and payment confirmed. Counts do not include child or parent names, emails, phones, dates of birth, or other unnecessary personal data. If no academy-wide analytics product exists yet, these events are still defined so a later vendor can map them without Camps depending on that vendor.

**Why this priority**: Requested for marketing, but must not block the registration revenue path.

**Independent Test**: Walk the four steps. Confirm four distinct events can be observed. Confirm payloads do not contain child/parent PII.

**Acceptance Scenarios**:

1. **Given** a visitor opening `/camps`, **When** the page is shown, **Then** a Camps-page-visit event can be recorded without PII.
2. **Given** a parent starting the registration flow for a Camp, **When** they begin, **Then** a registration-started event can be recorded without PII.
3. **Given** a successful registration submit, **When** it completes, **Then** a registration-completed event can be recorded without PII.
4. **Given** payment confirmation, **When** the registration becomes paid/confirmed, **Then** a payment-confirmed event can be recorded without PII.

---

### Edge Cases

- Registration after the deadline, before the opening date, or against an unpublished Camp is refused even if the visitor still has an old link.
- Changing Camp price, extras, or practical information after some registrations exist does not rewrite those registrations’ stored totals, extra lines, or confirmation snapshot; new registrations use the current configuration.
- Reducing capacity below the number of already-active registrations does not cancel those registrations; the Camp is treated as full until active registrations fall to the new maximum.
- Two children in the same family are two registrations (two places, two invoices). One registration cannot cover multiple weeks (deferred).
- Duplicate active registration of the same child (same parent, same Camp, same child identity) is refused.
- Guest checkout without an account is refused; the parent must use the existing client profile so invoicing and isolation stay on F1.04/F1.03.
- Incomplete billing profile: the existing completeness gate applies before a chargeable Camp registration is created, because the financial boundary bills the client profile.
- Competition Camp (experience eligibility, no age range): age is still collected; age-range validation runs only when a range is configured.
- Waitlist conversion of an ineligible child (now too old, Camp unpublished, or no remaining place) is refused; the next eligible entry may be considered.
- Unpaid registration cancellation by the registering parent is allowed and releases capacity; paid cancellation, refunds, sibling discounts, academy-student pricing, and promo codes are out of scope.
- Invoice email (existing F1.03 behaviour) and Camp confirmation email are different messages; success of one is not success of the other.
- Historical registrations remain readable by the parent (own) and by admins after the Camp is unpublished or edited.
- Direct guessing of another registration’s identifier never exposes another family’s child or parent data.
- Analytics events may include non-PII Camp identifier and funnel step; they MUST NOT include names, contact details, date of birth, allergies, or emergency contacts.
- English remains the live UI language (`XR-006`); the specified full-state label `Complet / Ausgebucht` is used for the full state. Full i18n is not this feature.
- `/trips` continues to be Spain-trip marketing with CTA to `/contact`. `/camps` does not replace it.

---

## Requirements *(mandatory)*

Lesson booking (`001`), financial/accounting integration (`007` / F1.03), roles (`006`/`008` / F1.02), and client identity (`009` / F1.04) stay in force. Camps add a new commercial offering; they do not change how a lesson is booked.

### Functional Requirements

#### Camp configuration

- **FR-001**: An admin MUST be able to create, edit, publish, and unpublish Camps without a code change. A Camp MUST be an event-like commercial offering with configurable name, description, start date, end date, daily schedule/hours, age range and/or eligibility criteria, base price, maximum capacity, registration opening date, registration closing/deadline date, published/active status, zero or more extras, and practical information for confirmation communication.
- **FR-002**: Mini Camp / Junior Camp / Competition Camp prices and eligibility in the first offering MUST be configuration values. Application behaviour MUST NOT hardcode those names, ages, or prices as the only supported Camps.
- **FR-003**: Published Camps MUST appear on the public `/camps` page with name, dates, schedule/hours, eligibility/ages, price, description, registration status/deadline, availability where appropriate, and a clear registration CTA when registration is open. Unpublished Camps MUST NOT be offered for public registration.
- **FR-004**: `/camps` MUST be suitable as the primary marketing URL (Instagram, Stories, QR, WhatsApp, flyer). The discovery and registration flow MUST be usable on common mobile viewport sizes, with clear fields, validation, extras, status, and CTAs.
- **FR-005**: Camps MUST NOT be modeled as recurring Groups or lesson catalogue items merely to reuse scheduling. Date and timezone handling MUST follow existing academy conventions. Generic session-calendar infrastructure MUST be reused only where it already fits; it MUST NOT be duplicated for Camps.

#### Registration

- **FR-006**: A chargeable Camp registration MUST be submitted by an authenticated parent/guardian who is the existing client profile (F1.04). The system MUST NOT create a second login or a parallel customer record for Camps. The child is a participant on the registration, not a separate customer identity.
- **FR-007**: A registration MUST capture at least: child first name, child last name, child date of birth, padel level/experience, parent/guardian name, parent/guardian phone, parent/guardian email, emergency contact, allergies/important information, and acceptance of applicable terms. Parent contact fields MAY be pre-filled from the client profile and MUST be snapshotted on the registration.
- **FR-008**: Terms acceptance MUST be persisted with timestamp and terms-version context consistent with existing reservation conventions. Registration MUST NOT proceed without acceptance.
- **FR-009**: When a Camp defines an age range, the child’s age at the Camp start date MUST fall inside that range or registration MUST be refused. When no age range is configured, age MUST still be stored but MUST NOT by itself cause refusal.
- **FR-010**: Registration MUST be refused when the Camp is unpublished, the registration window is not open, the deadline has passed, or the Camp is full — unless the request is a waitlist join that is allowed under FR-024. Invalid or incomplete input MUST NOT create a chargeable registration.
- **FR-011**: Repeated submission of the same registration intent MUST NOT create duplicate registrations or duplicate invoices.
- **FR-012**: A parent MUST be able to register more than one child as **separate** registrations. One registration MUST cover exactly one child and exactly one Camp offering (multi-week-in-one-registration is out of scope).
- **FR-013**: A parent MUST see only their own Camp registrations and related invoices. Direct use of another registration’s identifier MUST be denied. Admins MAY view all Camp registrations. Coaches have no Camp-management capability in this feature.
- **FR-014**: Deactivated clients MUST NOT create new Camp registrations (F1.04). Existing Camp registrations remain attached to that client.
- **FR-015**: Before a chargeable registration is created, the parent’s client profile MUST satisfy the existing billing-profile completeness rule used for lesson invoicing, so the financial boundary can bill the same customer.

#### Extras and money

- **FR-016**: A Camp MAY define zero or more extras, each with name, description, price, and active/configured state. Lunch is an example only and MUST NOT be hardcoded.
- **FR-017**: Selected extras MUST increase the registration total by their configured prices at submission time. Total MUST equal Camp base price plus selected extras. Amounts MUST be in CHF (`XR-001`) and MUST follow the project’s decimal-safe money rules (constitution §V).
- **FR-018**: Selected extras, their prices, the Camp base price, and the total MUST be persisted on the registration so historical totals remain reproducible after later configuration changes.

#### Capacity

- **FR-019**: Available places MUST be derived from the Camp’s configured maximum minus canonical **active** (place-holding) registrations. A manually decremented counter MUST NOT be the sole authority.
- **FR-020**: Capacity enforcement MUST be concurrency-safe: two simultaneous valid registrations MUST NOT both consume the final place.
- **FR-021**: A full Camp MUST display a clear full state such as `Complet / Ausgebucht` and MUST reject further normal registrations.
- **FR-022**: Cancelled or otherwise non-place-holding registrations MUST release capacity according to the registration lifecycle. Unpaid cancellation by the registering parent MUST be supported and MUST release the place. Paid cancellation/refund is out of scope.
- **FR-023**: Admin changes to future maximum capacity MUST apply to subsequent availability checks without invalidating or rewriting existing registrations.

#### Waitlist

- **FR-024**: A Camp MAY expose a waitlist when full and waitlist is enabled for that Camp. A waitlist entry MUST NOT consume capacity and MUST NOT be a confirmed or chargeable registration.
- **FR-025**: At most one active waitlist entry MUST exist per parent + child + Camp. Ordering MUST be deterministic by entry time. A user MUST NOT modify another user’s waitlist entry. Direct API/resource-id access MUST NOT bypass capacity or ownership (F1.16 principles).
- **FR-026**: Conversion from waitlist to registration MUST be an explicit admin action in this feature, MUST revalidate availability and eligibility atomically, and MUST then follow the normal registration + invoice path. Conversion MUST NOT silently reserve a place without that revalidation. F1.16 session waitlist is not delivered here.

#### Financial / payment state

- **FR-027**: Registration lifecycle and financial/payment state MUST remain distinct. Creating an invoice MUST NOT mark the registration paid. Minimum registration distinctions: created/awaiting payment; paid/confirmed; cancelled where applicable; waitlisted where applicable. Payment states MUST reuse the existing financial synchronization meanings (awaiting bank payment, partially paid, paid, cancelled) rather than a second conflicting payment machine.
- **FR-028**: A valid chargeable registration MUST create exactly one financial operation/invoice through the existing F1.03 provider-neutral financial/accounting boundary. Camps MUST NOT call the accounting provider from UI or Camp domain code. Bexio remains the accounting source of truth for the invoice document and recorded payments.
- **FR-029**: The invoice MUST represent the Camp and each selected extra as appropriate line items for the validated total in CHF, using the academy’s existing tax treatment for customer invoices.
- **FR-030**: The registration MUST store the durable correlation to the financial operation and external invoice reference (F1.03 two-sided correlation). Invoice creation MUST be idempotent: retries and lost-response recovery MUST reuse the existing invoice.
- **FR-031**: The parent MUST receive the invoice according to the existing F1.03 delivery workflow (in-app document access plus automatic invoice email). Invoice-email failure MUST NOT undo the registration.
- **FR-032**: Payment MUST be confirmed only through the canonical financial/payment reconciliation workflow (bank transfer against the invoice; no card/Stripe — `XR-005`). Partial payment MUST NOT confirm the registration.

#### Confirmation communication

- **FR-033**: When a registration becomes fully paid/confirmed through that financial workflow, the system MUST send one confirmation email to the parent including child name, Camp, dates, schedule/hours, total amount, selected extras, and practical Camp information. Confirmation MUST NOT be sent merely because registration or invoice creation succeeded.
- **FR-034**: Confirmation sending MUST be idempotent. Reprocessing an already-confirmed payment MUST NOT send a duplicate. Delivery MUST reuse the existing notification/email infrastructure and MUST be auditable the same way other customer emails are.

#### Admin, security, tracking

- **FR-035**: An admin MUST be able to view registrations with Camp, child, age, parent/guardian, phone, email, level/experience, extras, total amount, payment status, registration date, and remaining places, and MUST be able to distinguish pending-payment from paid/confirmed. Non-admins MUST NOT perform Admin Camp or registration-management operations, including by calling the backend directly (F1.02; `XR-003`).
- **FR-036**: Admins MUST be able to export the registration list in a CSV/Excel-compatible format. Export MUST be restricted to authorized admins and MUST include only fields justified for operations (the FR-035 set).
- **FR-037**: Public users MUST be able to create registrations only through the intended flow. Authorization for FR-006–FR-036 MUST be enforced on the server. Hiding a button is not sufficient.
- **FR-038**: Accounting credentials and tokens MUST remain server-side (F1.03). Child/parent PII MUST NOT appear in analytics events. Historical registrations MUST remain traceable after Camps are unpublished or edited.
- **FR-039**: The flow MUST record four conversion events — Camps page visit, registration started, registration completed, payment confirmed — using existing analytics if present, otherwise the smallest vendor-neutral event set. Events MUST NOT include unnecessary child/parent PII.
- **FR-040**: Critical registration, capacity, payment-state, and confirmation behaviours MUST be covered by appropriate automated tests so F1.24 can include them in integration/regression (this feature supplies the coverage; F1.24 is not implemented here).

### Key Entities

- **Camp** — A reusable event-like commercial offering (not a lesson, not a trip, not a recurring Group). Holds current configuration: identity, copy, dates, daily hours, eligibility/age range, price, capacity, registration window, publication state, practical information.
- **Camp extra** — An optional add-on belonging to a Camp (name, description, price, active state). Example: lunch. Configuration, not a hardcoded product type.
- **Camp registration** — One child on one Camp, submitted by a parent/guardian client. Snapshots child details, parent contact, extras and prices, totals, terms acceptance, and Camp context needed for history and confirmation. Place-holding when active/awaiting payment or paid; not place-holding when cancelled or waitlisted.
- **Child participant** — The registered child as captured on the registration (name, date of birth, level/experience, allergies). Not a login identity. Not a second client profile.
- **Parent/guardian** — The authenticated client profile who submits and pays. Reuses F1.04; billed through F1.03 contact mapping.
- **Waitlist entry** — Interest in a full Camp for one child. Does not consume capacity. Converted only through revalidated registration.
- **Financial operation / invoice** — The existing F1.03 billable document for this registration total. Accounting source of truth remains the connected accounting system.
- **Camp confirmation notice** — The post-payment email distinct from invoice delivery.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can create a valid Camp and publish it so it appears on `/camps` with its configured information, in under 5 minutes once signed in, without a code change.
- **SC-002**: 100% of published open Camps with remaining places show a usable registration CTA on `/camps`; 100% of unpublished Camps do not appear as bookable offerings.
- **SC-003**: A parent with a complete client profile can finish the discovery-to-submit path for an open Camp (including extras and terms) in under 5 minutes on a mobile-width screen, with the displayed total matching base price plus selected extras.
- **SC-004**: 100% of valid submissions for an open Camp with remaining places create exactly one registration; 100% of retries of that same submission create zero additional registrations and zero additional invoices.
- **SC-005**: 100% of registrations after the deadline, against a closed/unpublished Camp, or with a child outside a configured age range are refused with no chargeable registration.
- **SC-006**: With one remaining place and two concurrent valid registration attempts, at most one place-holding registration exists afterward; the public Camp then shows a full state such as `Complet / Ausgebucht`.
- **SC-007**: 100% of valid chargeable registrations produce exactly one invoice through the existing financial boundary for the correct total; invoice creation never by itself marks the registration paid.
- **SC-008**: 100% of fully paid registrations result in exactly one confirmation email containing child name, Camp, dates, schedule/hours, total, extras, and practical information; a second reconciliation run sends zero additional confirmation emails.
- **SC-009**: 100% of non-admin attempts to manage Camps, list all registrations, or export registrations are denied; 100% of parent attempts to read another family’s registration are denied.
- **SC-010**: After a configuration change to price or extras, previously stored registration totals still match what the parent was charged at submit time.
- **SC-011**: A waitlist entry on a full Camp leaves remaining places unchanged; converting it succeeds only when a place and eligibility still exist.
- **SC-012**: The four funnel steps can be counted in a test walkthrough without any child or parent PII appearing in the tracked payload.

---

## Assumptions

- Parent/guardian is the existing authenticated client. Guest/anonymous paid registration would create a parallel customer path and break F1.04 / F1.03 contact mapping. Sign-in/sign-up with return-to the Camp is the intended public funnel, matching lesson booking.
- Child records live on the registration. A dedicated Child client table is not introduced here; later kids features may attach children to profiles without rewriting Camp history.
- Age is computed on the Camp **start date** in the academy’s local (Switzerland) calendar dates.
- First Mini / Junior / Competition rows are operational seed/configuration, not feature logic.
- `/trips` stays Spain travel marketing (`FEAT-TRP-001`). `/camps` is the new local/academy Camp registration product. Home/header navigation SHOULD expose Camps so the marketing URL is reachable without only a QR code; that is an additive public-nav change, not a replacement of Trips.
- Waitlist conversion is **admin-triggered** in V1 (F1.16 itself leaves offer/timeout/notification open). Automatic “email the next parent an invoice” is not assumed.
- Unpaid parent cancellation mirrors F1.03 unpaid lesson cancel enough to release Camp capacity; paid refunds are not designed here.
- English UI copy remains the live language; `Complet / Ausgebucht` is the specified full-state wording rather than a full i18n project.
- No analytics vendor exists in the app today. V1 defines four named funnel events that can be recorded first-party and mapped later.
- Invoice VAT/tax follows the live F1.03 academy configuration (currently 0% on customer invoices); Camps do not invent a second tax policy.
- Existing customer-email audit is the confirmation idempotency/audit trail, extended to Camp confirmation without a second mail product.
- F1.08 / F1.10 / F1.16 are not dependencies for this spec’s delivery. Camps waitlist is self-contained. Groups/calendar are not blocked on and not reused as the Camp container.
- F1.24 will later collect regression suites; this feature still owns tests for its own critical flows (FR-040).
- Emergency contact is a required free-text or name+phone pair captured on the registration; the issue listed it without a schema, so the registration must include a usable emergency contact the academy can call.
- Level/experience is declared by the parent (structured choice or short text configured with the Camp). This feature does not score or import Playtomic (F1.05).

---

## Non-goals

- Sibling discounts, academy-student special pricing, discount/promo codes, or multiple weeks in one registration (explicitly deferred by issue #36).
- Replacing `/trips` Spain packages, tournament registration, or lesson booking.
- Forcing Camps into recurring Group, membership, or lesson-catalogue semantics.
- Implementing F1.16 session waitlist, F1.08 groups, F1.10 calendar/sessions, F1.05 levels, or F1.24’s full QA programme.
- A second customer/identity system, admin-provisioned parent logins, or making the child an authenticated user.
- Card payments or Stripe (`XR-005`).
- Calling the accounting provider from the browser or from Camp UI code.
- Paid-registration refunds, credit notes, or admin “mark as paid” that bypasses financial reconciliation.
- Full multilingual site (DeepL / DE-FR-IT i18n).
- Vendor-specific analytics platforms as a Camps dependency.

---

## Compatibility

- Preserve lesson booking, My Payments for lessons, and F1.03 invoice/reconciliation for lesson bookings.
- Preserve `/trips` marketing-only behaviour.
- Preserve F1.04: one profile per login; Camps attach to that profile as parent/guardian.
- Preserve F1.02: admin via role enforced server-side; no email-based admin.
- Extend F1.03 eligibility from “lesson bookings only” to also include Camp registrations as a new financial source, using the same provider-neutral boundary, idempotency, correlation, invoice email, and reconciliation.
- Additive public route `/camps`; unknown-URL redirect (`FEAT-PUB-004`) still applies to everything else.
- Do not opportunistically migrate `bookings.price` text debt or other unrelated schema cleanup (constitution §V).

---

## Baseline coverage

| ID | Covered? |
|---|---|
| FEAT-PUB-001 … FEAT-PUB-004 | Preserved; `/camps` is additive discovery |
| FEAT-TRP-001 | Preserved — trips stay marketing-only; Camps are a different product |
| FEAT-BKG-001 … FEAT-BKG-009 | Preserved for lessons; Camps are a separate registration |
| FEAT-LGL-001 / FEAT-LGL-002 | Extended — Camp registration also requires terms acceptance |
| WF-007 / XR-001 / XR-005 | Preserved — CHF, bank transfer, no Stripe |
| XR-003 / ACT-003 | Tightened for new Admin Camp operations |
| F1.03 `007` FR-013 future sources | This spec is that future source for Camps |
| F1.04 identity | Reused; child is not a second client |
| F1.16 | Principles reused for Camp waitlist only |

---

## Open questions

None blocking. Defaults are in Assumptions. Use `/speckit-clarify` if the academy wants guest checkout without an account, automatic waitlist-to-invoice offers, or Camps to replace `/trips`.
