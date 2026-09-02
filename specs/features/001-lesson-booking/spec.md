# Feature Specification: Lesson Booking

**Feature Branch**: `001-lesson-booking`  
**Created**: 2026-08-19  
**Updated**: 2026-09-02  
**Status**: Draft (reverse-engineered, as-is)  
**Input**: Live capability on `/lessons`

> Reverse spec of **observed** behavior. **Intended** = documented or shown in copy but not implemented. Bugs are in Known gaps, not in FR-*.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse catalogue (Priority: P1)

A visitor opens `/lessons` and sees active lessons grouped into Adult Memberships and Individual Sessions. There is no date picker or time-slot grid.

**Why this priority**: Discovery is public and required before any booking.

**Independent Test**: Open `/lessons` signed out; catalogue loads; no calendar or occupancy grid is shown.

**Acceptance Scenarios**:

1. **Given** the `lessons` table has active rows, **When** `/lessons` loads, **Then** cards show `name`, `price_amount` CHF, `description`, and “Cancellation: 48 h” (`src/pages/LessonsPage.jsx` LessonCard; `supabase.from('lessons').select('*').eq('is_active', true).order('price_amount')`).
2. **Given** `is_subscription` true/false, **When** the page renders, **Then** cards are split into those two sections (`LessonsPage.jsx` `subscriptionLessons` / `singleSessions`).
3. **Given** `/lessons` is loaded, **When** the visitor looks at the page, **Then** there is no calendar, date selector, or 30-minute slot grid.

---

### User Story 2 - Authenticated student books a lesson (Priority: P1)

A signed-in student with a complete profile accepts terms, creates a pending booking, and is taken into invoice generation.

**Why this priority**: This is the live revenue path (`docs/sdd-brownfield/project-context.md`).

**Independent Test**: Sign in, complete profile, Book Now, accept terms, confirm; a `bookings` row exists with `status=pending_payment`, `payment_status=pending`, and null `booking_date` / `start_time` / `end_time`.

**Acceptance Scenarios**:

1. **Given** no session, **When** Book Now is clicked, **Then** navigate to `/login?return_to=/lessons?product=<lesson_code>` (`LessonsPage.jsx` `handleBookNow`).
2. **Given** a session and incomplete profile (`src/lib/profileValidation.js` `isProfileComplete`), **When** Book Now is clicked, **Then** `ProfileCompletionModal` opens and no booking is inserted (`handleBookNow`).
3. **Given** a complete profile, **When** Book Now is clicked, **Then** the confirm dialog shows billing snapshot, comments, terms checkbox, and total (`LessonsPage.jsx` Dialog).
4. **Given** terms unchecked, **When** Generate Invoice is clicked, **Then** a toast blocks the action (`handleConfirmAndPay` / `t.termsError`).
5. **Given** terms accepted, **When** Generate Invoice is clicked, **Then** `createBooking(buildBookingPayload(...))` inserts the row then `requestInvoice` is called (`executeBookingAndInvoice`).

---

### Edge Cases

- **Observed:** Book Now does **not** collect a date or time. `buildBookingPayload` is called with `bookingDate: null` and `selectedTime: null`, so `booking_date` / `start_time` / `end_time` are null (`src/lib/bookings.js`).
- **Observed:** Spanish copy exists in `translations.ES` but `lang` is hardcoded `"EN"` (`LessonsPage.jsx`).
- **Observed:** `?product=<lesson_code>` is written into `return_to` but **never read** on `/lessons` — no auto-select of the lesson.
- **Observed:** Booking insert and invoice invoke are sequential; invoice failure leaves the booking (`executeBookingAndInvoice` try/catch after insert). Recovery is 002 / FEAT-PAY-003.
- There is **no** cancel action on this page (copy “48 h” is not enforced).

---

## Requirements *(mandatory)*

### Functional Requirements

Observed unless marked intended.

- **FR-001**: `/lessons` MUST list active `lessons` ordered by `price_amount` (`LessonsPage.jsx`; `api-contracts.md` §2.2; policy `lessons_public_read`).
- **FR-002**: Catalogue MUST split on `is_subscription`.
- **FR-003**: Cards MUST show name, CHF amount, description, 48 h cancellation copy.
- **FR-004**: `/lessons` MUST NOT show a calendar, date picker, or time-slot occupancy grid.
- **FR-005**: New bookings from `/lessons` MUST insert with `booking_date`, `start_time`, and `end_time` null (academy assigns the class later).
- **FR-006**: Unauthenticated Book Now MUST redirect to login with `return_to`.
- **FR-007**: Incomplete profile MUST open `ProfileCompletionModal` and MUST NOT insert a booking.
- **FR-008**: Booking MUST require terms acceptance in the confirm dialog.
- **FR-009**: Insert payload MUST match `buildBookingPayload`: `user_id`, `lesson_code`, `lesson_name`, `price` as `"<amount> CHF"`, `booking_date` null, times null, `duration_minutes`, `status=pending_payment`, `payment_status=pending`, `client_email`, `client_phone`, `notes` (`bookings.js`; FK `bookings.lesson_code` → `lessons.lesson_code`, migration `0003`).
- **FR-010**: After insert the page MUST call `requestInvoice` (invoice behavior owned by 002). When `booking_date` is null, `invoice_date` MUST default to today (`yyyy-MM-dd`).
- **FR-011**: On invoice success the page MUST open `InvoicePreviewModal` then navigate to `/payments` on close (`InvoicePreviewModal.jsx` `onClose`).

### Key Entities

- **Lesson** (`lessons`): public catalogue; `lesson_code`, `name`, `price_amount`, `duration_minutes`, `is_subscription`, `is_active` (`domain-model.md`, `supabase-backend.md`).
- **Booking** (`bookings`): lesson↔client reservation; owner `user_id`. Date/time remain nullable until class assignment.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Anonymous visitors can load the catalogue without auth and without seeing a calendar.
- **SC-002**: A signed-in student with a complete profile can create a pending booking from `/lessons`.
- **SC-003**: Unauthenticated Book Now never inserts a row (RLS insert `auth.uid() = user_id`; `supabase-backend.md` §5).

---

## Data impact

- **Read:** `lessons` (anon/authenticated).
- **Write:** `bookings` INSERT (authenticated owner). Invoice writes are 002 (service role inside `generate-invoice-pdf`).
- **Not written here:** `memberships`, `credits`, `availability` (empty / unused).
- **`booking_slots`:** view still exists (migration `0006`) but is **not** consumed by `/lessons`. `fetchDayBookings` remains in `bookings.js` unused by this page.

---

## Auth / security impact

- Route `/lessons` is public (`src/App.jsx`).
- Insert RLS: `auth.uid() = user_id` (`supabase-backend.md` §5).
- Invoice invoke requires session JWT (`bookings.js` `requestInvoice`) — see 002.
- `ProtectedRoute` is not used on this page.

---

## UI impact

- Route: `/lessons` → `LessonsPage.jsx`.
- Page shows catalogue cards only (no calendar section).
- Modals: confirm `Dialog`, `ProfileCompletionModal`, `InvoicePreviewModal`.
- Header “Book Now” lands here (`FEAT-PUB-001` / WF-002).
- Language switcher is not implemented (`lang` fixed EN).

---

## Non-goals

- Trip or tournament booking (`TripsPage` / `TournamentsPage` marketing only).
- Customer cancel / refund (copy only).
- Memberships drawing credits (future spec).
- Skill-rank class assignment UI (future spec) — this change only removes self-serve date/slot picking.
- `plan.md` / `tasks.md`.

---

## Known gaps

- 48 h cancellation copy is not enforced (no cancel UI).
- `?product=` unused after login.
- Two-step insert + invoice (orphan `receipt_url`).
- `price` stored as text (`constitution.md` V).
- Overlapping `status` / `payment_status` / `verification_status` (`domain-model.md`).
- No page-level tests (`implementation-inventory.md`); unit tests cover `bookings.js` only.

---

## Open questions

- Should `?product=` open that lesson’s confirm flow after login?
- Should unpaid holds expire, or only explicit cancel (cleanup function must not be scheduled — `api-contracts.md` §1.2)?

---

## Assumptions

- Bank details live on the invoice PDF/QR, not on `/lessons`.
- **Intended (future, not this spec):** memberships grant tokens from weeks-in-month and academy-open days; the academy redeems tokens into classes. Students are placed into existing groups (stable people / hours / days) by skill rank.

---

## Baseline coverage

| ID | Covered? |
|---|---|
| FEAT-LES-001 … FEAT-LES-003 | Yes (LES-003 copy only for 48 h) |
| FEAT-LES-004 … FEAT-LES-008 | Retired 2026-09-02 (calendar/grid removed) |
| FEAT-BKG-001 … FEAT-BKG-009 | Yes (BKG-007/008/009 via 002 UI handoff) |
| FEAT-BKG-010 | Retired 2026-09-02 (no public grid to occupy) |
| FEAT-PRF-003, FEAT-PRF-004 | Gate only; profile save is 005 |
| FEAT-LGL-002 | Booking terms checkbox |
| WF-002, WF-005, WF-006, WF-013 | Yes |
| WF-008 | Occupancy clause retired with the grid |
| XR-001, XR-004, XR-005, XR-006 | Yes (XR-006: EN only) |
| ACT-002 | Yes (`user_id`) |
| FEAT-TRP-001, FEAT-TRN-001 | Non-goals (out of capability) |
