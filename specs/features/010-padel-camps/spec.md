# Feature Specification: Padel Camps / Camps Registration (F1.25)

**Feature Branch**: `010-padel-camps`

**Created**: 2026-09-08

**Status**: Draft

**Input**: GitHub issue #36 — F1.25 Padel Camps / Camps Registration System. A reusable Camps / Events registration system so parents can discover a Padel Camp, register a child, select optional extras, receive an automatically generated invoice through the existing financial/accounting boundary, pay by bank transfer, and receive an automatic confirmation once payment is confirmed. Camp configuration, capacity, extras, registration windows, pricing and practical information must be manageable from Admin and must not be hardcoded around the first offering. Follow-up 2026-09-08: one parent can have multiple children; a Children page lists them, holds each child’s personal information, and gives access to that child’s invoices so the same children can be reused for future Camps.

> **Forward spec (delta).** Living as-is for lesson booking remains [`001-lesson-booking`](../001-lesson-booking/spec.md). Living as-is for invoicing and Bexio financial operations remains [`007-bexio-integration`](../007-bexio-integration/spec.md) (F1.03). Living as-is for roles remains [`006-roles-and-permissions`](../006-roles-and-permissions/spec.md) / [`008-roles-and-permissions`](../008-roles-and-permissions/spec.md) (F1.02). Living as-is for client/profile identity remains [`009-client-management`](../009-client-management/spec.md) (F1.04). Marketing-only Spain trips remain [`FEAT-TRP-001`](../../baseline-system/requirements.md). This file states only what F1.25 adds.
>
> GitHub feature ID is **F1.25**. Spec folder follows sequential numbering under `specs/features/` (`010-padel-camps`), not the Notion path `specs/phase-1/F1.25-padel-camps/`.

---

## Clarifications

### Session 2026-09-08

- Q: Can one parent have several children, and should those children persist beyond a single Camp form? → A: **Yes.** A parent owns a reusable list of children (dependents, not logins). A Children page lists them, holds each child’s personal information, and gives access to that child’s Camp invoices. The same children are selected again for future Camps. Historical registrations still snapshot the child data used at submit time.

### Session 2026-09-09

- Q: Should the create-child form include padel level? → A: **No.** Padel level is removed from the create-child form. It stays on the child record, is edited on the child profile-management view (FR-006e), and registrations keep snapshotting it. This supersedes the level dropdown + info-indicator idea from the 2026-09-08 evolution review.
- Q: What does Remove do for a child with history? → A: Remove asks for explicit confirmation, then hard-deletes **only** when the child has no registrations or invoices; otherwise removal is refused with an explanation. The Archive action is removed from the UI (existing archived records stay valid).
- Q: One invoice for several children? → A: **No.** FR-012 stays mandatory: one registration and one invoice per child. Registering several children means separate registrations, each in its own flow. There is no combined invoice.
- Q: Manual date-of-birth format? → A: DD.MM.YYYY text entry (Swiss convention), validated before save; no calendar picker in the create-child form.
- Q: Can several children be registered in one submission? → A: No — see the FR-012 answer above; each child is registered in a separate registration flow.

### Session 2026-09-09 (round 2 — flyers and member pricing)

- Q: Camp flyer? → A: A Camp MAY carry an optional flyer image, managed by the admin from the Camp form (upload, preview, replace, remove) and shown on the public Camp card; clicking it opens an accessible larger view that never loses form or page state.
- Q: Where does "academy member" come from? → A: **Interim (until F1.09):** the parent self-declares an active membership with a checkbox at registration; the member price then applies and the registration is flagged for admin verification in the registration list and CSV export. **F1.09 handover:** an automatic check — membership active at the moment of registration (no month matching, so a Christmas camp opened in October works); members then see only the member price; a membership bought at month start whose payment is still pending at registration time still counts, and the admin flag extends to that pending case so the academy can talk to the parent directly.
- Q: Who sees which price? → A: Until F1.09 the system cannot know who is a member, so public pages show both prices when a member price exists; member-only display arrives with F1.09.

### Session 2026-09-09 (round 3 — listing layout, price placement, type filters)

- Q: Camp type filters on `/camps`? → A: **Yes.** Below the Padel Camps description, show one filter per distinct admin-configured Camp type among the published Camps on the page, plus a control that restores the full list. There is no pre-existing type enum; Mini / Junior / Competition remain configuration (FR-002), not hardcoded filter labels. A Camp MAY have an optional `camp_type`. Camps without a type appear only in the All-Camps view.
- Q: `/camps` card layout and flyer? → A: One Camp card per row, using the row width. The page description uses the same width as the card container and aligns with it. The flyer on each card is larger than the C2 thumbnail, keeps its aspect ratio (no extra crop or stretch), and still opens the existing larger view.
- Q: Where is the price shown? → A: **Supersedes the round-2 public-page display rule.** Usual and academy-member prices MUST NOT appear on `/camps` cards. On the individual Camp page they appear **only** inside the Submit registration card. The C2 self-declared membership option lives in that card; changing it MUST update the displayed total, which MUST match the amount submitted, invoiced, and paid. Member-only automatic display still waits for F1.09.
- Q: `+ Add new Child` on registration? → A: **Remove it** from the Camp registration flow (it reads as adding several children to one Camp). Child create/manage stays on the Children page. FR-012 stays: several children means several separate registrations. Terms-draft restore remains.

### Session 2026-09-09 (round 4 — invoice preview after registration)

- Q: After a successful Camp registration, how does the parent review and pay the invoice? → A: **Immediately, in-app.** Present the invoice generated for that registration in the same preview used for Adult Memberships / lesson bookings (PDF + QR bank-transfer slip, then a direct proceed-to-pay action). The parent MUST NOT have to open another section first to find the invoice. There is no separate membership billing product; “Membership payment” means that existing lesson invoice/QR/bank-transfer flow. Creating the invoice still does not mark the registration paid (FR-027). FR-012 is unchanged (one registration and one invoice per child).
- Q: Where can the parent find that invoice later? → A: On the relevant child’s profile/registration area **and** on the parent’s My Payments list, still associated with that Camp registration and child. Do not fold Camp registrations into `bookings`.
- Q: Are `/camps` flyers visible on a phone-width view? → A: **Yes.** A published Camp’s flyer MUST remain visible and tappable at a mobile-width viewport (keep-aspect `object-contain`; no collapsed/zero-height image). The larger view is unchanged.

### Session 2026-09-09 (round 5 — listing order and payment-card date)

- Q: In what order should `/camps` list Camps? → A: **Week, then Mini → Junior → Competition.** Keep grouping by `start_date` (Week 1 then Week 2, as today). Within a week, list Mini, then Junior, then Competition. Other or empty `camp_type` values sort after those three. This is a **listing rank** for configured type labels, not a type enum and not hardcoded filter chips (FR-002). Filter chips stay derived from distinct types on the page and SHOULD follow the same rank.
- Q: Why does My Payments show N/A or a wrong date? → A: Lesson cards used `booking_date`, which is **null** on bookings created after the 2026-09-02 calendar removal (`FEAT-BKG-004`). The payment-card date MUST be `created_at` (when the booking/registration/invoice was created) for both lesson and Camp rows. Do not backfill `booking_date` or restore a self-serve calendar.

---

## Gap analysis (current → target)

Inspected: GitHub issue #36, constitution, project context, baseline requirements (`FEAT-PUB-*`, `FEAT-TRP-001`, `FEAT-BKG-*`, `FEAT-LGL-*`, `XR-*`), reverse specs `001`–`006`, F1.03 (`007`), F1.02 (`008`), F1.04 (`009`), F1.16 issue #21 (waitlist, **Needs Spec** — not implemented), public routes, admin dashboard, and notification/email audit. Confirmed unless marked assumption.

| F1.25 rule | Current | This spec |
|---|---|---|
| Public Camps landing at `/camps` | No `/camps` route. Header/footer expose Home, Lessons, Trips, Tournaments, Contact. `/trips` is Spain travel marketing; CTA goes to `/contact` (`FEAT-TRP-001`). Camps are not bookable. | **Add** a public `/camps` discovery page for published academy Camps. **Keep** `/trips` as the existing Spain-trip marketing page. Camps are not lessons and are not trips. |
| Admin-managed Camp catalogue | Lesson catalogue is admin-edited data; Camps/events have no persisted catalogue. First Mini / Junior / Competition offering cannot be published without code. | **Add** Admin create/edit/publish/unpublish of Camps (name, description, dates, daily schedule, eligibility/ages, price, capacity, registration window, extras, practical information, published state). Mini / Junior / Competition values are **configuration**, not application logic. |
| Child registration | Lesson booking is for the authenticated student themselves (`FEAT-BKG-001`). There is no child-participant registration, no extras, no Camp eligibility check. | **Add** a parent/guardian registration for a saved child on a Camp, with extras, terms, eligibility, and a snapshot of pricing/context. |
| Parent/child vs client identity (F1.04) | The client **is** the authenticated profile (1:1 with login). There is no Child login, no children list, and no second customer table. F1.04 forbids a parallel identity system. | **Reuse** the parent/guardian’s existing client profile as the paying customer. **Add** durable **children** as dependents of that profile (not logins, not a second customer identity). A parent may have several children. |
| Children page | No family/children area. Profile is only the logged-in person. Camp history would otherwise be re-typed per event. | **Add** a Children page where the parent lists their children, maintains each child’s personal information, and opens that child’s Camp invoices. The same child records MUST be selectable for future Camps. |
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

1. **Given** an authenticated admin, **When** they create a Camp with the required configuration and publish it, **Then** the Camp appears on `/camps` with its configured name, dates, schedule, eligibility, description, registration window/status, and a clear registration call to action. **(Amended 2026-09-09 C3)** Price is not shown on the listing card; it appears on the Camp detail inside the Submit registration card.
2. **Given** a published Camp, **When** the admin unpublishes it, **Then** visitors no longer see it as an available offering, and existing registrations remain traceable to that Camp with their original prices and extras.
3. **Given** a Camp with existing registrations, **When** the admin increases or decreases future maximum places, **Then** subsequent availability checks use the new maximum and existing registrations are not invalidated or rewritten.
4. **Given** a student, coach, or visitor, **When** they attempt Admin Camp create/edit/publish, **Then** the operation is refused.
5. **Given** Mini, Junior, and Competition values supplied as configuration, **When** those Camps are published, **Then** they behave like any other Camp — the application does not special-case those names or prices.

---

### User Story 2 - Parent discovers published Camps on `/camps` (Priority: P1)

A parent arriving from Instagram, a Story, a QR code, WhatsApp, or a printed flyer opens `/camps` on a phone and sees published Camps with enough information to choose one: name, dates, hours, eligibility/ages, description, registration status or deadline, and whether places remain. They can filter by Camp type or return to all Camps. Closed or full Camps are clearly marked (full uses wording such as `Complet / Ausgebucht`). A clear call to action starts registration when the Camp is open. Price is not on the listing; it is shown on the Camp detail inside the Submit registration card.

**Why this priority**: This is the client’s first V1 priority and the marketing URL for the whole journey.

**Independent Test**: Publish one open Camp, one unpublished Camp, one closed Camp, and one full Camp. Open `/camps` as a visitor on a mobile-width view. Only the intended published Camps appear, with correct status and CTAs.

**Acceptance Scenarios**:

1. **Given** published Camps, **When** a visitor opens `/camps`, **Then** they see each published Camp’s name, dates, schedule/hours, eligibility/ages, description, registration status/deadline, and availability where it is appropriate to show — **not** the usual or academy-member price. **(Amended 2026-09-09 C3)** Each Camp occupies its own row; the flyer (when present) is large and keep-aspect; the page description matches the card-container width. **(Amended 2026-09-09 C4)** On a mobile-width viewport the flyer remains visible and tappable. **(Amended 2026-09-09 C5)** Camps are listed by start date (earlier week first), and within a week Mini then Junior then Competition.
6. **(Added 2026-09-09 C3)** **Given** published Camps with configured types, **When** a visitor selects a type filter below the Padel Camps description, **Then** only Camps of that type are listed; **When** they choose All Camps, **Then** the full published list returns. **(Amended 2026-09-09 C5)** Filter chips remain derived from distinct types (not a hardcoded-only Mini/Junior/Competition enum) and SHOULD follow Mini → Junior → Competition then any other types.

---

### User Story 3 - Parent maintains several children on the Children page (Priority: P1)

An authenticated parent opens a Children page, sees every child attached to their client profile, and can add another child or update a child’s personal information (name, date of birth, padel level/experience, allergies/important information, emergency contact). From the same page they can open each child’s Camp invoices (awaiting payment or paid). Those children remain available for later Camps so the parent does not re-enter the same child for every event.

**Why this priority**: The academy needs one family to register more than one child, and the same children must be reusable for future Camps. Without a durable children list, every camp would collect a throwaway participant.

**Independent Test**: As parent A, add child X and child Y, edit Y’s allergies, and open X’s invoice after a test registration. As parent B, confirm A’s children are invisible. Register Y on a second Camp by selecting Y from the list without retyping Y’s identity.

**Acceptance Scenarios**:

1. **Given** an authenticated parent, **When** they open the Children page, **Then** they see a list of only their own children (empty until they add one).
2. **Given** an authenticated parent, **When** they add a child with the required personal information, **Then** that child appears in their list and remains available for later Camp registration.
3. **Given** a parent with more than one child, **When** they open the Children page, **Then** each child is listed separately and can be opened to view or edit that child’s personal information.
4. **Given** an existing child, **When** the parent updates permitted personal information, **Then** the new values are stored and shown on the next visit, and later Camp registrations for that child use the current child record (historical registrations keep their snapshot — see FR-018a).
5. **Given** a child with Camp invoices, **When** the parent opens that child, **Then** they can access that child’s invoices and payment status without seeing another child’s invoices mixed in as if they were the same person.
6. **Given** parent A, **When** they request parent B’s child list, a child identifier, or a child’s invoices, **Then** access is denied.
7. **Given** a child who already has a Camp registration or invoice, **When** the parent tries to remove that child, **Then** the child is not hard-deleted; history stays attached. **(Amended 2026-09-09)** Removal requires explicit confirmation and is refused with an explanation when history exists; a child without history is hard-deleted after confirmation. The Archive action is removed from the UI.

---

### User Story 4 - Parent registers a saved child and selects extras (Priority: P1)

An authenticated parent/guardian (the existing client) opens an open Camp with remaining places, chooses one of their saved children, confirms parent contact details, optional extras, membership (when the Camp defines a member price), and terms. The running total in the Submit registration card updates when extras or the membership option change. On submit, the system re-checks that the Camp is still open and has a place, validates eligibility against that child, and creates exactly one registration for that child. Retrying the same submission does not create a second registration. Invalid or incomplete input is rejected without a chargeable registration.

**Why this priority**: This is the client’s second V1 priority and the operational heart of the feature.

**Independent Test**: Sign in as parent A with a complete billing profile and two saved children. Register eligible child X on an open Camp, select one extra, accept terms, submit twice. Exactly one registration exists for X; total equals base price + extra; snapshots retain the extra name and price. Register child Y as a second place. Repeat with an ineligible age and with the deadline passed — both refused.

**Acceptance Scenarios**:

1. **Given** an open Camp with remaining places and an authenticated parent with a usable client profile and at least one saved child, **When** they select that child, complete extras, terms, review, and submit, **Then** exactly one registration is created for that child on that Camp.
2. **Given** a parent with no saved children yet, **When** they start registration, **Then** the child selector is empty until they add a child on the Children page. **(Amended 2026-09-09 C3)** The registration form MUST NOT offer `+ Add new Child` (that action is only on the Children page). FR-012 still allows several children via separate registrations.
3. **Given** extras on the Camp, **When** the parent selects or deselects an extra before submit, **Then** the displayed total equals the Camp base price plus the prices of currently selected extras, and after submit those selected extras and their prices are stored with the registration.
4. **Given** no extras selected, **When** the parent submits a valid registration, **Then** the total equals the Camp base price.
5. **Given** a Camp with a configured age range, **When** the selected child’s date of birth falls outside that range at the Camp start date, **Then** registration is refused and no chargeable registration is created.
6. **Given** a Camp with eligibility described only as experience (no age range), **When** the parent submits with the required experience/level field completed on that child, **Then** registration is not refused solely for age.
7. **Given** a successful submit, **When** the parent retries or double-submits the same registration, **Then** a second registration and a second invoice are not created.
8. **Given** incomplete required fields or terms not accepted, **When** the parent submits, **Then** they see a clear validation error and no chargeable registration is created.
9. **Given** an unauthenticated visitor, **When** they start registration, **Then** they are sent through the existing sign-in/sign-up path and returned to the Camp registration (same pattern as lesson booking’s return-to behaviour).
10. **Given** a deactivated client (F1.04), **When** they attempt a new Camp registration or to add a child, **Then** it is refused.
11. **(Added 2026-09-09)** **Given** a Camp with a member price, **When** the parent declares an active academy membership at submit, **Then** the registration total uses the member price and the registration is flagged for admin review; **Given** the same Camp, **When** the parent does not declare it, **Then** the usual price applies and no flag is set. **(Amended 2026-09-09 C3)** That total is displayed only inside the Submit registration card and updates when the membership option or extras change; it MUST match the invoiced amount.

---

### User Story 5 - Registration produces one invoice; payment is separate (Priority: P1)

After a valid registration, the academy issues exactly one invoice for the registration total through the existing financial/accounting boundary. The invoice lists the Camp and any selected extras. The parent receives the invoice the same way they already receive lesson invoices (in-app access plus automatic invoice email). **(Amended 2026-09-09 C4)** Immediately after a successful submit, the parent is shown that registration’s invoice in the existing in-app preview (PDF + QR slip) with a direct way to proceed to pay — they do not first navigate to another section. The same invoice remains reopenable from the child’s profile and from My Payments. Creating the invoice does not mark the registration paid. The parent pays by bank transfer. Payment becomes confirmed only when the canonical financial reconciliation says the invoice is fully paid.

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
8. **Given** a parent with invoices for two different children, **When** they open each child on the Children page, **Then** each child’s Camp invoices are listed with that child and they can open the document the same way they open other academy invoices.
9. **(Added 2026-09-09 C4)** **Given** a successful Camp registration, **When** submit completes, **Then** the generated invoice is presented immediately for preview with a proceed-to-pay action (existing lesson/Membership QR/PDF flow), without requiring the parent to open My Children or My Payments first. Previewing does not mark the registration paid.
10. **(Added 2026-09-09 C4)** **Given** a Camp registration invoice, **When** the parent later opens My Payments, **Then** that invoice is listed alongside lesson invoices, remains associated with that registration and child, and can be reopened. FR-012 grouping is unchanged.

---

### User Story 6 - Capacity cannot be oversold (Priority: P1)

Available places are the Camp’s maximum minus canonical active registrations (not a hand-maintained counter). Two parents submitting for the last place cannot both receive it. A full Camp shows `Complet / Ausgebucht` and rejects further normal registrations. Cancelled or otherwise non-active registrations release a place. A waitlist entry, when waitlist is enabled, does not consume a place.

**Why this priority**: This is the client’s fourth V1 priority. Overselling a camp is an operational failure.

**Independent Test**: Set capacity to 1. Submit two valid concurrent registrations. At most one becomes an active place-holding registration. Public Camp shows full. Enable waitlist; a waitlist entry does not reduce remaining places further.

**Acceptance Scenarios**:

1. **Given** one remaining place and two concurrent valid registration attempts, **When** both are processed, **Then** at most one receives the final place and the other is refused or offered waitlist if enabled — never two active place-holding registrations.
2. **Given** a full Camp, **When** a parent tries a normal registration (including by repeating a previously valid request), **Then** it is refused and the public Camp shows a full state such as `Complet / Ausgebucht`.
3. **Given** an active registration that is cancelled while unpaid (where cancellation is allowed), **When** cancellation completes, **Then** a place is released for subsequent availability checks.
4. **Given** a waitlist-enabled full Camp, **When** a parent joins the waitlist, **Then** remaining places are unchanged.

---

### User Story 7 - Paid registration sends one confirmation email (Priority: P1)

Once payment is fully confirmed through the canonical financial workflow, the parent receives one confirmation email with child name, Camp, dates, schedule/hours, total amount, selected extras, and the Camp’s practical information. The invoice-issued email is not this confirmation. Re-running payment synchronization does not send a second confirmation.

**Why this priority**: This is the client’s fifth V1 priority and the operational close of the journey.

**Independent Test**: Confirm payment on a paid registration; one confirmation email is recorded as sent with the required content. Run reconciliation again; still one confirmation. Confirm that an unpaid invoiced registration has no confirmation email.

**Acceptance Scenarios**:

1. **Given** a registration whose invoice becomes fully paid, **When** confirmation processing runs, **Then** the parent receives one email containing child name, Camp name, dates, schedule/hours, total amount, selected extras, and practical Camp information.
2. **Given** a registration that is created or invoiced but not paid, **When** time passes, **Then** no Camp confirmation email is sent.
3. **Given** a confirmation already sent, **When** payment synchronization is reprocessed, **Then** a second confirmation email is not sent.
4. **Given** email delivery failure, **When** confirmation is retried, **Then** the registration and payment state remain intact and a later successful send still results in a single successful confirmation.

---

### User Story 8 - Full Camp can take a waitlist (Priority: P2)

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

### User Story 9 - Admin reviews registrations and exports them (Priority: P2)

An admin opens Camp registrations and sees Camp, child, age, parent/guardian, phone, email, level/experience, extras, total, payment status, registration date, and remaining places. Pending-payment rows are visually and operationally distinct from paid/confirmed rows. The admin can export the list in a CSV/Excel-compatible file. Export and the list itself are admin-only.

**Why this priority**: Operations need the roster and payment view; export is explicitly requested where consistent with admin tooling.

**Independent Test**: Create one unpaid and one paid registration. As admin, distinguish them, see remaining places, export CSV with the listed fields. As a student, both the list and export are denied.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they open registrations for a Camp, **Then** they see Camp, child, age, parent/guardian, phone, email, level/experience, extras, total amount, payment status, registration date, and remaining places.
2. **Given** mixed unpaid and paid registrations, **When** the admin views the list, **Then** pending-payment and paid/confirmed are clearly distinguished.
3. **Given** an admin, **When** they export, **Then** they receive a CSV/Excel-compatible file of the authorized registration fields.
4. **Given** a non-admin, **When** they request the registration list or export, **Then** the operation is refused.

---

### User Story 10 - Conversion funnel can be counted without PII (Priority: P3)

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
- Duplicate active registration of the **same saved child** on the same Camp is refused. Two siblings on the same Camp are allowed.
- Editing a child’s personal information after a registration does not rewrite that registration’s historical snapshot (name, age/DOB, extras, prices, practical copy used at confirmation time).
- A parent with zero children can add the first child from the Children page or during Camp registration; both paths create the same kind of child record.
- Archiving is removed from the Children UI (2026-09-09): a child without registrations or invoices can be removed after explicit confirmation; a child with history cannot be removed, and past registrations/invoices stay attached.
- A child is not a login and cannot sign in; invoices remain the parent’s financial documents, grouped by child for display.
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

- **FR-001**: An admin MUST be able to create, edit, publish, and unpublish Camps without a code change. A Camp MUST be an event-like commercial offering with configurable name, description, start date, end date, daily schedule/hours, age range and/or eligibility criteria, base price, maximum capacity, registration opening date/time, registration closing/deadline date/time, published/active status, zero or more extras, and practical information for confirmation communication. **(Amended 2026-09-09)** A Camp additionally supports an optional flyer image, an optional academy-member price alongside the usual price, and an optional Camp type (admin-configured text, not a hardcoded Mini/Junior/Competition enum).
- **FR-001a**: Camp flyer management lives in the admin Camp form: upload, immediate in-form preview before save, preview of the stored flyer when editing, replace, and remove. Clicking a preview opens an accessible larger view that can be closed (including keyboard dismissal) without submitting the form or losing form state. Flyers MUST be stored in private storage; flyers of published Camps are publicly readable, and flyers of unpublished Camps MUST NOT be readable by non-admins.
- **FR-001b**: The public Camp card MUST show the flyer on the right side of the same card container, responsively stacked on small screens, with a non-interactive fallback when no flyer exists; clicking a real flyer opens the larger view without losing page state or causing navigation. **(Amended 2026-09-09 C3)** `/camps` shows one Camp card per row using the row width; the flyer is large enough for that layout and MUST keep its aspect ratio (no extra cropping or stretching). The Padel Camps description uses the same width as the card container and aligns with it. **(Amended 2026-09-09 C4)** On a mobile-width viewport the flyer MUST remain visible and tappable (not collapsed to zero height).
- **FR-002**: Mini Camp / Junior Camp / Competition Camp prices, eligibility, and type labels in the first offering MUST be configuration values. Application behaviour MUST NOT hardcode those names, ages, prices, or type filters as the only supported Camps.
- **FR-003**: Published Camps MUST appear on the public `/camps` page with name, dates, schedule/hours, eligibility/ages, description, registration status/deadline, availability where appropriate, and a clear registration CTA when registration is open. **(Amended 2026-09-09 C3)** Usual and academy-member prices MUST NOT appear on `/camps` cards. Below the Padel Camps description, `/camps` MUST offer a filter for each distinct Camp type among the listed published Camps and a control to show all Camps again. Unpublished Camps MUST NOT be offered for public registration. **(Amended 2026-09-09 C5)** The listing MUST sort by `start_date` ascending, then Mini → Junior → Competition (other/empty types after). That rank is a display convention for configured type labels; it MUST NOT become a type enum or the only allowed Camps (FR-002).
- **FR-003a**: On the individual Camp page, the Camp price (usual or academy-member, plus selected extras) MUST appear only inside the Submit registration card. Changing the membership option MUST update that displayed total. The displayed total MUST be the amount used for registration, payment, and invoice.
- **FR-004**: `/camps` MUST be suitable as the primary marketing URL (Instagram, Stories, QR, WhatsApp, flyer). The discovery and registration flow MUST be usable on common mobile viewport sizes, with clear fields, validation, extras, status, and CTAs.
- **FR-005**: Camps MUST NOT be modeled as recurring Groups or lesson catalogue items merely to reuse scheduling. Date and timezone handling MUST follow existing academy conventions. Generic session-calendar infrastructure MUST be reused only where it already fits; it MUST NOT be duplicated for Camps.

#### Children (parent-owned dependents)

- **FR-006**: A chargeable Camp registration MUST be submitted by an authenticated parent/guardian who is the existing client profile (F1.04). The system MUST NOT create a second login or a parallel paying-customer record for Camps. Children MUST be durable dependents of that parent profile, not authenticated users and not a second Client identity.
- **FR-006a**: A parent MUST be able to have more than one child. The parent MUST have a Children page that lists only their children, lets them add a child, and lets them view and update each child’s personal information: first name, last name, date of birth, padel level/experience, allergies/important information, and emergency contact. Emergency contact MAY be empty on the stored child record; it becomes required at registration submit (FR-007). **(Amended 2026-09-09)** The create-child form collects first name, last name, date of birth (manual DD.MM.YYYY text entry, no calendar picker), allergies/important information, emergency contact (country prefix selected/entered first, then the national number, stored E.164), and an optional profile image; padel level/experience is **not** collected at creation and is maintained on the child profile-management view (FR-006e). Form labels use sentence-case capitalization and the centered form presents a centered title.
- **FR-006e**: Selecting a child (or its Edit action) MUST open a child profile-management view following the existing profile-management interaction pattern: all of the child’s information (including padel level/experience), editable fields, profile-image replace and delete, a default avatar/SVG representation when no image exists, and that child’s Camp invoices.
- **FR-006f**: Child cards MUST offer exactly Edit and Remove. Remove MUST require explicit confirmation in a modal before anything is deleted, MUST hard-delete the child only when no registrations or invoices exist for that child, and MUST refuse with an explanation when history exists (FR-006d). The Archive UI action is removed.
- **FR-006b**: The same child records MUST be reusable for future Camps. Camp registration MUST select an existing child from the parent’s list; adding a new child happens on the Children page (FR-006a), not from the registration form. It MUST NOT create a throwaway child that cannot be reused.
- **FR-006c**: From the Children page, the parent MUST be able to access each child’s Camp invoices (status and document) separately. The billed customer remains the parent. Direct use of another parent’s child identifier MUST be denied.
- **FR-006d**: A child with historical registrations or invoices MUST NOT be hard-deleted; removal is refused with an explanation and history stays attached. **(Amended 2026-09-09)** A child **without** history MAY be hard-deleted after explicit confirmation (FR-006f); the archive/hide action is removed from the UI, and existing archived records remain valid. Admins MAY view children belonging to a client in an operational context; they MUST NOT invent a second login for the child.
- **FR-014**: Deactivated clients MUST NOT create new Camp registrations, add children, or change child personal information (F1.04). Existing children, registrations, and invoices remain attached and readable.

#### Registration

- **FR-007**: A registration MUST be for exactly one saved child and MUST snapshot at least: child first name, child last name, child date of birth, padel level/experience, parent/guardian name, parent/guardian phone, parent/guardian email, emergency contact, allergies/important information, and acceptance of applicable terms. Parent contact fields MAY be pre-filled from the client profile. Child personal fields MUST come from the selected child record (editable before submit if the parent updates that child). Emergency contact (a usable name + phone the academy can call) is REQUIRED at submit time even when the stored child record leaves it empty.
- **FR-008**: Terms acceptance MUST be persisted with timestamp and terms-version context consistent with existing reservation conventions. Registration MUST NOT proceed without acceptance.
- **FR-008a**: When a parent opens Terms and Conditions from the registration flow, returning from the Terms page MUST navigate back to the page the terms were opened from — never the home page — and the registration draft (selected child, selected extras, terms state, membership claim, and other entered registration data) MUST be preserved so the parent continues without re-entering anything. **(Amended 2026-09-09 C3)** The registration form MUST NOT offer `+ Add new Child`; child creation remains on the Children page.
- **FR-009**: When a Camp defines an age range, the selected child’s age at the Camp start date MUST fall inside that range or registration MUST be refused. When no age range is configured, age MUST still be stored but MUST NOT by itself cause refusal.
- **FR-010**: Registration MUST be refused when the Camp is unpublished, the registration window is not open, the deadline has passed, or the Camp is full — unless the request is a waitlist join that is allowed under FR-024. Invalid or incomplete input MUST NOT create a chargeable registration.
- **FR-011**: Repeated submission of the same registration intent MUST NOT create duplicate registrations or duplicate invoices (registration-level guard here; invoice-level idempotency is FR-030 — one mechanism per layer, not two).
- **FR-012**: A parent MUST be able to register more than one child as **separate** registrations (one place and one invoice per child). One registration MUST cover exactly one child and exactly one Camp offering (multi-week-in-one-registration is out of scope).
- **FR-013**: A parent MUST see only their own children, Camp registrations, and related invoices. Direct use of another registration’s or child’s identifier MUST be denied. Admins MAY view all Camp registrations. Coaches have no Camp-management capability in this feature.
- **FR-015**: Before a chargeable registration is created, the parent’s client profile MUST satisfy the existing billing-profile completeness rule used for lesson invoicing, so the financial boundary can bill the same customer.

#### Extras and money

- **FR-016**: A Camp MAY define zero or more extras, each with name, description, price, and active/configured state. Lunch is an example only and MUST NOT be hardcoded.
- **FR-017**: Selected extras MUST increase the registration total by their configured prices at submission time. Total MUST equal Camp base price plus selected extras. Amounts MUST be in CHF (`XR-001`) and MUST follow the project’s decimal-safe money rules (constitution §V).
- **FR-017a**: A Camp MAY define an academy-member price in addition to the usual price; both are CHF `numeric` per §V. **(Added 2026-09-09)** Interim until F1.09: the parent self-declares an active academy membership at submit; when claimed and the Camp defines a member price, the registration total MUST use the member price and the registration MUST be flagged as member-price-claimed for admin review (admin list + CSV). A claim on a Camp without a member price MUST be refused. **(Amended 2026-09-09 C3)** The membership option and the live total live in the Submit registration card (FR-003a). When F1.09 ships, the claim is replaced by an automatic active-at-registration membership check, a membership whose payment is still pending still qualifies, and the admin flag extends to that pending case.
- **FR-018**: Selected extras, their prices, the Camp base price, and the total MUST be persisted on the registration so historical totals remain reproducible after later configuration changes.
- **FR-018a**: Each registration MUST snapshot the child personal information used at submit time. Later edits on the Children page MUST NOT rewrite past registration snapshots, invoices, or confirmation content.

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

- **FR-027**: Registration lifecycle and financial/payment state MUST remain distinct. Creating an invoice MUST NOT mark the registration paid. Minimum registration distinctions: created/awaiting payment; paid/confirmed; cancelled where applicable. Waitlisted is a state of a **waitlist entry** (FR-024), not of a registration. Payment states MUST reuse the existing financial synchronization meanings (awaiting bank payment, partially paid, paid, cancelled) rather than a second conflicting payment machine.
- **FR-028**: A valid chargeable registration MUST create exactly one financial operation/invoice through the existing F1.03 provider-neutral financial/accounting boundary. Camps MUST NOT call the accounting provider from UI or Camp domain code. Bexio remains the accounting source of truth for the invoice document and recorded payments.
- **FR-029**: The invoice MUST represent the Camp and each selected extra as appropriate line items for the validated total in CHF, using the academy’s existing tax treatment for customer invoices.
- **FR-030**: The registration MUST store the durable correlation to the financial operation and external invoice reference (F1.03 two-sided correlation). Invoice creation MUST be idempotent: retries and lost-response recovery MUST reuse the existing invoice.
- **FR-031**: The parent MUST receive the invoice according to the existing F1.03 delivery workflow (in-app document access plus automatic invoice email). Invoice-email failure MUST NOT undo the registration. The parent MUST also be able to reopen that invoice from the corresponding child on the Children page. **(Amended 2026-09-09 C4)** Immediately after a successful registration submit, the parent MUST be shown that registration’s invoice in the existing lesson/Membership in-app preview, with a direct proceed-to-pay action, without first navigating to another section. The same invoice MUST remain listed on My Payments. “Membership payment” means the existing lesson PDF/QR/bank-transfer flow; Camps MUST NOT add a second payment processor. If issuance is still queued, the preview MUST show a pending/not-ready state rather than implying the registration failed.
- **FR-032**: Payment MUST be confirmed only through the canonical financial/payment reconciliation workflow (bank transfer against the invoice; no card/Stripe — `XR-005`). Partial payment MUST NOT confirm the registration.

#### Confirmation communication

- **FR-033**: When a registration becomes fully paid/confirmed through that financial workflow, the system MUST send one confirmation email to the parent including child name, Camp, dates, schedule/hours, total amount, selected extras, and practical Camp information. Confirmation MUST NOT be sent merely because registration or invoice creation succeeded.
- **FR-034**: Confirmation sending MUST be idempotent. Reprocessing an already-confirmed payment MUST NOT send a duplicate. Delivery MUST reuse the existing notification/email infrastructure and MUST be auditable the same way other customer emails are.

#### Admin, security, tracking

- **FR-035**: An admin MUST be able to view registrations with Camp, child, age, parent/guardian, phone, email, level/experience, extras, total amount, payment status, registration date, and remaining places, and MUST be able to distinguish pending-payment from paid/confirmed. Non-admins MUST NOT perform Admin Camp or registration-management operations, including by calling the backend directly (F1.02; `XR-003`).
- **FR-036**: Admins MUST be able to export the registration list in a CSV/Excel-compatible format. Export MUST be restricted to authorized admins and MUST include only fields justified for operations (the FR-035 set).
- **FR-037**: Public users MUST be able to create registrations only through the intended flow. Authorization for FR-006–FR-036 MUST be enforced on the server, including child list, child edits, and per-child invoices. Hiding a button is not sufficient.
- **FR-038**: Accounting credentials and tokens MUST remain server-side (F1.03). Child/parent PII MUST NOT appear in analytics events. Historical registrations MUST remain traceable after Camps are unpublished or edited.
- **FR-039**: The flow MUST record four conversion events — Camps page visit, registration started, registration completed, payment confirmed — using existing analytics if present, otherwise the smallest vendor-neutral event set. Events MUST NOT include unnecessary child/parent PII.
- **FR-040**: Critical registration, capacity, payment-state, confirmation, and parent/child isolation behaviours MUST be covered by appropriate automated tests so F1.24 can include them in integration/regression (this feature supplies the coverage; F1.24 is not implemented here).

### Key Entities

- **Camp** — A reusable event-like commercial offering (not a lesson, not a trip, not a recurring Group). Holds current configuration: identity, copy, dates, daily hours, eligibility/age range, usual price and optional academy-member price, capacity, registration window, publication state, practical information, and an optional flyer image.
- **Camp extra** — An optional add-on belonging to a Camp (name, description, price, active state). Example: lunch. Configuration, not a hardcoded product type.
- **Camp registration** — One saved child on one Camp, submitted by a parent/guardian client. Snapshots child details, parent contact, extras and prices, totals, terms acceptance, and Camp context needed for history and confirmation. Place-holding when active/awaiting payment or paid; not place-holding when cancelled or waitlisted.
- **Child** — A durable dependent of one parent/guardian client (not a login, not a second paying customer). Holds personal information used across future Camps: name, date of birth, level/experience, allergies/important information, emergency contact, and an optional profile image kept in owner-scoped private storage. Listed on the Children page; created via the centered create-child form (no level field there); maintained in the child profile-management view.
- **Parent/guardian** — The authenticated client profile who owns the children list, submits registrations, and pays. Reuses F1.04; billed through F1.03 contact mapping.
- **Waitlist entry** — Interest in a full Camp for one child. Does not consume capacity. Converted only through revalidated registration.
- **Financial operation / invoice** — The existing F1.03 billable document for this registration total. Accounting source of truth remains the connected accounting system.
- **Camp confirmation notice** — The post-payment email distinct from invoice delivery.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can create a valid Camp and publish it so it appears on `/camps` with its configured information, in under 5 minutes once signed in, without a code change.
- **SC-002**: 100% of published open Camps with remaining places show a usable registration CTA on `/camps`; 100% of unpublished Camps do not appear as bookable offerings.
- **SC-003**: A parent with a complete client profile and a saved eligible child can finish the discovery-to-submit path for an open Camp (including extras and terms) in under 5 minutes on a mobile-width screen, with the displayed total matching base price plus selected extras.
- **SC-003a**: A parent can add two children on the Children page, edit one child’s personal information, and see only those children — in under 3 minutes once signed in. A second parent cannot see the first parent’s children.
- **SC-003b**: After two siblings are registered for Camps, the parent can open each child’s invoices from the Children page and reach the correct document for that child without seeing the other child’s invoices presented as that child’s.
- **SC-004**: 100% of valid submissions for an open Camp with remaining places create exactly one registration for the selected child; 100% of retries of that same submission create zero additional registrations and zero additional invoices.
- **SC-005**: 100% of registrations after the deadline, against a closed/unpublished Camp, or with a child outside a configured age range are refused with no chargeable registration.
- **SC-006**: With one remaining place and two concurrent valid registration attempts, at most one place-holding registration exists afterward; the public Camp then shows a full state such as `Complet / Ausgebucht`.
- **SC-007**: 100% of valid chargeable registrations produce exactly one invoice through the existing financial boundary for the correct total; invoice creation never by itself marks the registration paid.
- **SC-007a**: After a successful Camp submit, 100% of cases present that registration’s invoice in-app immediately (or a pending state if the document is not yet ready) with a proceed-to-pay path; the parent can later reopen the same invoice from the child profile and from My Payments.
- **SC-008**: 100% of fully paid registrations result in exactly one confirmation email containing child name, Camp, dates, schedule/hours, total, extras, and practical information; a second reconciliation run sends zero additional confirmation emails.
- **SC-009**: 100% of non-admin attempts to manage Camps, list all registrations, or export registrations are denied; 100% of parent attempts to read another family’s children, registrations, or child invoices are denied.
- **SC-010**: After a configuration change to price or extras, previously stored registration totals still match what the parent was charged at submit time.
- **SC-011**: A waitlist entry on a full Camp leaves remaining places unchanged; converting it succeeds only when a place and eligibility still exist.
- **SC-012**: The four funnel steps can be counted in a test walkthrough without any child or parent PII appearing in the tracked payload.

---

## Assumptions

- Parent/guardian is the existing authenticated client. Guest/anonymous paid registration would create a parallel customer path and break F1.04 / F1.03 contact mapping. Sign-in/sign-up with return-to the Camp is the intended public funnel, matching lesson booking.
- Children are **dependents of that parent**, not logins and not a second paying customer. One parent may have many children. This is the family model for Camps and for future Camps; it is not F1.04 client-directory duplication and it is not a kids-academy membership product (F1.18+).
- Child personal information on the Children page is: first name, last name, date of birth, padel level/experience, allergies/important information, emergency contact. Parent billing name/phone/email/address stay on the parent profile.
- The Children page is the ongoing home for those records and for per-child Camp invoices. Parents add children there, then select them during Camp registration (the registration form does not offer `+ Add new Child`). **(Amended 2026-09-09 C4)** Camp invoices are also listed on My Payments alongside lesson invoices; they are not stored as `bookings` rows.
- “Membership payment experience” in this product is the Adult Memberships / lesson booking invoice preview (PDF + QR bank-transfer slip) and My Payments reopen path. There is no separate membership billing table or checkout.
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
- A second customer/identity system, admin-provisioned parent logins, or making the child an authenticated user. Children are dependents of the parent client only.
- Card payments or Stripe (`XR-005`).
- Calling the accounting provider from the browser or from Camp UI code.
- Paid-registration refunds, credit notes, or admin “mark as paid” that bypasses financial reconciliation.
- Full multilingual site (DeepL / DE-FR-IT i18n).
- Vendor-specific analytics platforms as a Camps dependency.

---

## Compatibility

- Preserve lesson booking, F1.03 invoice/reconciliation for lesson bookings, and the existing My Payments lesson rows. **(Amended 2026-09-09 C4)** Extend My Payments to also list Camp registration invoices without folding Camps into `bookings`. **(Amended 2026-09-09 C5)** The My Payments card date is `created_at` (when the booking or Camp registration was created). It MUST NOT depend on nullable `booking_date` and MUST NOT show N/A when `created_at` exists. Do not backfill `booking_date` or restore a self-serve calendar (`FEAT-BKG-004`).
- Preserve `/trips` marketing-only behaviour.
- Preserve F1.04: one profile per login; that profile is the parent/guardian and paying customer. Children are additional **dependent** records of that profile, not extra logins and not a parallel client directory.
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
| F1.04 identity | Reused as the parent/paying customer; children are dependents, not second clients |
| F1.16 | Principles reused for Camp waitlist only |

---

## Open questions

None blocking. Defaults are in Assumptions. Use `/speckit-clarify` if the academy wants guest checkout without an account, automatic waitlist-to-invoice offers, Camps to replace `/trips`, or children to become their own logins.
