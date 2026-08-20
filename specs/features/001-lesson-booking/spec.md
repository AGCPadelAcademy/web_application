# Feature Specification: Lesson Booking

**Feature Branch**: `001-lesson-booking`  
**Created**: 2026-08-19  
**Status**: Draft (reverse-engineered, as-is)  
**Input**: Live capability on `/lessons`

> Reverse spec of **observed** behavior. **Intended** = documented or shown in copy but not implemented. Bugs are in Known gaps, not in FR-*.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse catalogue and availability (Priority: P1)

A visitor opens `/lessons`, sees active lessons grouped into Adult Memberships and Individual Sessions, picks a future date, and sees which 30-minute slots are free.

**Why this priority**: Discovery is public and required before any booking.

**Independent Test**: Open `/lessons` signed out; catalogue and grid load; occupied slots are disabled with no owner identity.

**Acceptance Scenarios**:

1. **Given** the `lessons` table has active rows, **When** `/lessons` loads, **Then** cards show `name`, `price_amount` CHF, `description`, and “Cancellation: 48 h” (`src/pages/LessonsPage.jsx` LessonCard; `supabase.from('lessons').select('*').eq('is_active', true).order('price_amount')`).
2. **Given** `is_subscription` true/false, **When** the page renders, **Then** cards are split into those two sections (`LessonsPage.jsx` `subscriptionLessons` / `singleSessions`).
3. **Given** a date today or later, **When** the visitor selects it, **Then** slots 08:00–20:30 in 30-minute steps appear; 14:00 is disabled (`timeSlots` `isBlocked` when `hour === 14`).
4. **Given** `booking_slots` rows with `payment_status` in `pending`/`confirmed` for that date, **When** the grid is built, **Then** overlapping 30-minute slots are `booked` (`src/lib/bookings.js` `fetchDayBookings`, `ACTIVE_BOOKING_STATUSES`; `isSlotBooked`).

---

### User Story 2 - Authenticated student books a lesson (Priority: P1)

A signed-in student with a complete profile accepts terms, creates a pending booking, and is taken into invoice generation.

**Why this priority**: This is the live revenue path (`docs/sdd-brownfield/project-context.md`).

**Independent Test**: Sign in, complete profile, Book Now, accept terms, confirm; a `bookings` row exists with `status=pending_payment`, `payment_status=pending`.

**Acceptance Scenarios**:

1. **Given** no session, **When** Book Now is clicked, **Then** navigate to `/login?return_to=/lessons?product=<lesson_code>` (`LessonsPage.jsx` `handleBookNow`).
2. **Given** a session and incomplete profile (`src/lib/profileValidation.js` `isProfileComplete`), **When** Book Now is clicked, **Then** `ProfileCompletionModal` opens and no booking is inserted (`handleBookNow`).
3. **Given** a complete profile, **When** Book Now is clicked, **Then** the confirm dialog shows billing snapshot, comments, terms checkbox, and total (`LessonsPage.jsx` Dialog).
4. **Given** terms unchecked, **When** Generate Invoice is clicked, **Then** a toast blocks the action (`handleConfirmAndPay` / `t.termsError`).
5. **Given** terms accepted, **When** Generate Invoice is clicked, **Then** `createBooking(buildBookingPayload(...))` inserts the row then `requestInvoice` is called (`executeBookingAndInvoice`).

---

### User Story 3 - Occupied slots stay reserved while pending (Priority: P2)

After insert, the chosen range stays blocked on the public grid until payment is no longer `pending` or `confirmed`.

**Why this priority**: Holds the court for unpaid bookings (`specs/baseline-system/requirements.md` WF-008 assumption).

**Independent Test**: Book a slot; reload `/lessons` as anonymous; that slot is disabled.

**Acceptance Scenarios**:

1. **Given** a booking with `start_time`/`end_time` and `payment_status` pending or confirmed, **When** `fetchDayBookings` runs, **Then** overlapping slots are booked (`booking_slots` view; migration `0006`).

---

### Edge Cases

- **Observed:** Book Now does **not** require `selectedTime`. `buildBookingPayload` sets `start_time`/`end_time` to `null` if no slot (`src/lib/bookings.js`). Availability occupancy then cannot match that booking.
- **Observed:** Past dates are disabled (`Calendar` `disabled={(date) => date < startOfDay(new Date())}`).
- **Observed:** Spanish copy exists in `translations.ES` but `lang` is hardcoded `"EN"` (`LessonsPage.jsx`).
- **Observed:** `?product=<lesson_code>` is written into `return_to` but **never read** on `/lessons` — no auto-select of the lesson.
- **Observed:** Booking insert and invoice invoke are sequential; invoice failure leaves the booking (`executeBookingAndInvoice` try/catch after insert). Recovery is 002 / FEAT-PAY-003.
- **Observed:** `isSlotBooked` uses a 30-minute probe, not `lesson.duration_minutes`, when building the grid (`timeSlots` calls `isSlotBooked(cursor, 30)`). A longer lesson can still be booked into a window that only looks free in 30-minute chunks.
- There is **no** cancel action on this page (copy “48 h” is not enforced).

---

## Requirements *(mandatory)*

### Functional Requirements

Observed unless marked intended.

- **FR-001**: `/lessons` MUST list active `lessons` ordered by `price_amount` (`LessonsPage.jsx`; `api-contracts.md` §2.2; policy `lessons_public_read`).
- **FR-002**: Catalogue MUST split on `is_subscription`.
- **FR-003**: Cards MUST show name, CHF amount, description, 48 h cancellation copy.
- **FR-004**: Calendar MUST allow today or future dates only.
- **FR-005**: Grid MUST be 08:00–20:30, 30-minute steps; 14:00 MUST be unbookable.
- **FR-006**: Occupancy MUST come from `booking_slots` (`booking_date`, `start_time`, `end_time`, `payment_status` in `pending`/`confirmed`) — no PII (`bookings.js`; `supabase-backend.md` view `booking_slots`).
- **FR-007**: Unauthenticated Book Now MUST redirect to login with `return_to`.
- **FR-008**: Incomplete profile MUST open `ProfileCompletionModal` and MUST NOT insert a booking.
- **FR-009**: Booking MUST require terms acceptance in the confirm dialog.
- **FR-010**: Insert payload MUST match `buildBookingPayload`: `user_id`, `lesson_code`, `lesson_name`, `price` as `"<amount> CHF"`, `booking_date`, optional times, `duration_minutes`, `status=pending_payment`, `payment_status=pending`, `client_email`, `client_phone`, `notes` (`bookings.js`; FK `bookings.lesson_code` → `lessons.lesson_code`, migration `0003`).
- **FR-011**: After insert the page MUST call `requestInvoice` (invoice behavior owned by 002).
- **FR-012**: On invoice success the page MUST open `InvoicePreviewModal` then navigate to `/payments` on close (`InvoicePreviewModal.jsx` `onClose`).

### Key Entities

- **Lesson** (`lessons`): public catalogue; `lesson_code`, `name`, `price_amount`, `duration_minutes`, `is_subscription`, `is_active` (`domain-model.md`, `supabase-backend.md`).
- **Booking** (`bookings`): lesson↔client reservation; owner `user_id`.
- **booking_slots**: non-PII projection for the grid (migration `0006`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Anonymous visitors can load catalogue + grid without auth.
- **SC-002**: A signed-in student with a complete profile can create a pending booking from `/lessons`.
- **SC-003**: Occupied pending/confirmed ranges do not expose who booked them.
- **SC-004**: Unauthenticated Book Now never inserts a row (RLS insert `auth.uid() = user_id`; `supabase-backend.md` §5).

---

## Data impact

- **Read:** `lessons` (anon/authenticated); `booking_slots` (anon/authenticated).
- **Write:** `bookings` INSERT (authenticated owner). Invoice writes are 002 (service role inside `generate-invoice-pdf`).
- **Not written here:** `memberships`, `credits`, `availability` (empty / unused).

---

## Auth / security impact

- Route `/lessons` is public (`src/App.jsx`).
- Insert RLS: `auth.uid() = user_id` (`supabase-backend.md` §5).
- Grid MUST NOT use `bookings` SELECT (public-read dropped, migration `0006`).
- Invoice invoke requires session JWT (`bookings.js` `requestInvoice`) — see 002.
- `ProtectedRoute` is not used on this page.

---

## UI impact

- Route: `/lessons` → `LessonsPage.jsx`.
- Modals: confirm `Dialog`, `ProfileCompletionModal`, `InvoicePreviewModal`.
- Header “Book Now” lands here (`FEAT-PUB-001` / WF-002).
- Language switcher is not implemented (`lang` fixed EN).

---

## Non-goals

- Trip or tournament booking (`TripsPage` / `TournamentsPage` marketing only).
- Customer cancel / refund (copy only).
- Memberships drawing credits (future spec).
- Skill-rank class assignment / deleting the calendar (future spec).
- Making a time slot mandatory (decided against 2026-08-19).
- `plan.md` / `tasks.md` / production code changes.

---

## Known gaps

- 48 h cancellation copy is not enforced (no cancel UI).
- `?product=` unused after login.
- Two-step insert + invoice (orphan `receipt_url`).
- Grid overlap uses 30 minutes, not lesson duration — **do not harden**; calendar is scheduled for removal.
- `price` stored as text (`constitution.md` V).
- Overlapping `status` / `payment_status` / `verification_status` (`domain-model.md`).
- No page-level tests (`implementation-inventory.md`); unit tests cover `bookings.js` only.

---

## Open questions

- ~~Should a time slot be mandatory for `with_time` lessons?~~ **No (2026-08-19).** Slot optional is accepted. Calendar / self-serve slots will be replaced by academy-assigned classes (skill rank) and membership tokens. Do not add a mandatory-slot requirement.
- ~~Should occupancy use `lesson.duration_minutes`?~~ **No further investment (2026-08-19).** Same reason: calendar is retiring.
- Should `?product=` open that lesson’s confirm flow after login?
- Should unpaid holds expire, or only explicit cancel (cleanup function must not be scheduled — `api-contracts.md` §1.2)?

---

## Assumptions

- Occupying a slot while `payment_status=pending` is intentional **while the calendar exists** (`requirements.md` §8).
- Bank details live on the invoice PDF/QR, not on `/lessons`.
- **Intended (future, not this spec):** memberships grant tokens from weeks-in-month and academy-open days; the academy redeems tokens into classes. Students are placed into existing groups (stable people / hours / days) by skill rank. Self-serve date/slot picking goes away.

---

## Baseline coverage

| ID | Covered? |
|---|---|
| FEAT-LES-001 … FEAT-LES-008 | Yes (LES-003 copy only for 48 h) |
| FEAT-BKG-001 … FEAT-BKG-010 | Yes (BKG-007/008/009 via 002 UI handoff) |
| FEAT-PRF-003, FEAT-PRF-004 | Gate only; profile save is 005 |
| FEAT-LGL-002 | Booking terms checkbox |
| WF-002, WF-005, WF-006, WF-008, WF-013 | Yes |
| XR-001, XR-004, XR-005, XR-006 | Yes (XR-006: EN only) |
| ACT-002 | Yes (`user_id`) |
| FEAT-TRP-001, FEAT-TRN-001 | Non-goals (out of capability) |
