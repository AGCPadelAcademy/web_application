# Feature Specification: Invoice Generation

**Feature Branch**: `002-invoice-generation`  
**Created**: 2026-08-19  
**Status**: Draft (reverse-engineered, as-is)  
**Input**: Live capability via `generate-invoice-pdf` (v22) and `requestInvoice`

> Reverse spec of **observed** behavior. **Intended** = documented or shown in copy but not implemented. Bugs are in Known gaps, not in FR-*.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate invoice after booking (Priority: P1)

After a pending booking is inserted, the student receives a branded CHF invoice PDF (Swiss QR when the matching QR file exists) and can preview/download it.

**Why this priority**: Bank-transfer payment depends on the invoice (`docs/sdd-brownfield/project-context.md`; `specs/baseline-system/requirements.md` WF-005).

**Independent Test**: Sign in, create a booking, observe `requestInvoice` succeed; `bookings.receipt_url` is set and a PDF opens.

**Acceptance Scenarios**:

1. **Given** a session JWT, **When** `requestInvoice` runs, **Then** it calls `supabase.functions.invoke('generate-invoice-pdf', { headers: { Authorization: Bearer }, body: booking_id, amount, invoice_date, customer_*, lesson_name, qty: 1, user_id })` (`src/lib/bookings.js`).
2. **Given** no session token, **When** `requestInvoice` runs, **Then** it throws “You must be signed in to generate an invoice.” (`bookings.js`).
3. **Given** a non-2xx or `{ success: false }` response, **When** `requestInvoice` handles it, **Then** it surfaces the Edge Function JSON `error`/`message` (`bookings.js`; tests in `src/lib/bookings.test.js`).
4. **Given** a successful generate after Book Now, **When** the PDF URL returns, **Then** `InvoicePreviewModal` opens and closing it navigates to `/payments` (`src/pages/LessonsPage.jsx`).

---

### User Story 2 - Recover a missing invoice from My Payments (Priority: P1)

A student whose booking exists without `receipt_url` can generate the invoice later.

**Why this priority**: Insert and invoice are not transactional (`requirements.md` FEAT-PAY-003 / WF-006).

**Independent Test**: Open `/payments` with a pending booking and empty `receipt_url`; click “Get invoice”; a PDF URL is stored and opened.

**Acceptance Scenarios**:

1. **Given** `receipt_url` is set, **When** the student clicks “Invoice (PDF)”, **Then** that URL opens in a new tab (`src/pages/PaymentsPage.jsx` `handleGetInvoice`).
2. **Given** `payment_status = pending` and no `receipt_url`, **When** the student clicks “Get invoice”, **Then** `requestInvoice` is called with `price_amount` parsed from `bookings.price` text (`PaymentsPage.jsx`).
3. **Given** the booking owner’s JWT, **When** the Edge Function runs, **Then** generation is allowed; another student’s JWT MUST be 403 (`api-contracts.md` §1.1; `requirements.md` FEAT-INV-005).

---

### User Story 3 - Unique daily invoice numbers (Priority: P2)

Each generated invoice gets a unique `INV-YYYY/MM/DD-XX` number allocated atomically.

**Why this priority**: Concurrent bookings must not collide (`api-contracts.md`; migration `0005`).

**Independent Test**: `src/lib/invoiceNumber.integration.test.js` (skips without test-project secrets).

**Acceptance Scenarios**:

1. **Given** a UTC date key, **When** `next_invoice_number(p_date_key)` is called, **Then** the next sequence for that day is returned (`invoice_counters`; `specs/baseline-system/supabase-backend.md`).

---

### Edge Cases

- **Observed:** Missing `qr-codes/QR_<amount>.pdf` is a warning; the PDF still succeeds without a QR page (`api-contracts.md` §1.1).
- **Observed:** Missing `invoices/assets/logo.png` is skipped; generation still succeeds.
- **Observed:** Caller may pass `invoice_id` to UPDATE an existing row; the SPA `requestInvoice` does **not** send `invoice_id` (`bookings.js`).
- **Observed:** `invoices` has RLS enabled and **no client policies** — the SPA never SELECTs `invoices`; it uses `bookings.receipt_url` (`supabase-backend.md` §5; `design.md`).
- **Observed:** Re-invoking generate without `invoice_id` can INSERT another `invoices` row for the same booking (`UNIQUE(booking_id)` not applied — `requirements.md`, `domain-model.md` R5).
- **Observed:** Amount on `/payments` recovery is parsed from `"<n> CHF"` text (`parseFloat(String(booking.price).replace(/[^\d.]/g, ''))`).
- **Intended, not live:** Move PDF from `Pending/` to `Paid/`/`Refused/` after finance verification (`api-contracts.md` §1.1 quirk; `implementation-inventory.md`).

---

## Requirements *(mandatory)*

### Functional Requirements

Observed unless marked intended.

- **FR-001**: Invoice generation MUST run only in Edge Function `generate-invoice-pdf` v22, not in the SPA (`overview.md`; `bookings.js`).
- **FR-002**: The caller MUST attach the session JWT in `Authorization` (`bookings.js`; `api-contracts.md` §1.1).
- **FR-003**: The function MUST reject missing/invalid JWT with 401 and non-owner non-admin with 403; missing booking 404 (`api-contracts.md` §1.1).
- **FR-004**: Authorization MUST be booking owner (`bookings.user_id`) or `profiles.role = admin` (`api-contracts.md`; `auth.getUser(token)` explicit).
- **FR-005**: The PDF MUST be branded A4 (CAG Padel Academy GmbH), customer block, one line item, total in CHF (`requirements.md` FEAT-INV-001; `api-contracts.md`).
- **FR-006**: When `QR_<numeric amount>.pdf` exists in `qr-codes`, it MUST be appended; absence MUST NOT fail generation.
- **FR-007**: The PDF MUST be stored at `invoices/Pending/YYYY/MM/DD/` in the public `invoices` bucket; public URL written to `invoices.pdf_url` and `bookings.receipt_url` (`api-contracts.md`; FEAT-INV-003).
- **FR-008**: A new or updated `invoices` row MUST have `status = pending`, `currency = CHF`, `amount` equal to the lesson price (FEAT-INV-004).
- **FR-009**: Invoice numbers MUST be `INV-YYYY/MM/DD-XX` via `next_invoice_number` (migration `0005`; FEAT-INV-002).
- **FR-010**: `LessonsPage` MUST invoke generation after booking insert; `PaymentsPage` MUST allow “Get invoice” when `receipt_url` is empty on a pending booking.
- **FR-011**: Stripe MUST NOT be used (`requirements.md` XR-005).

### Key Entities

- **Invoice** (`invoices`): financial document; `booking_id`, `invoice_number`, `pdf_url`, `status`, `amount`, `currency`.
- **invoice_counters**: per-day sequence; service-role / RPC only.
- **Booking**: `receipt_url` is the student-facing PDF pointer.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A signed-in owner can obtain a PDF URL after a successful invoke.
- **SC-002**: A non-owner non-admin cannot generate another student’s invoice (403).
- **SC-003**: Concurrent allocations for the same UTC day do not share an invoice number.
- **SC-004**: Students can recover a missing PDF from `/payments` without creating a second booking.

---

## Data impact

- **Write (service role inside EF):** INSERT/UPDATE `invoices`; UPDATE `bookings.receipt_url`; increment `invoice_counters` via RPC.
- **Storage:** upload under `invoices/Pending/YYYY/MM/DD/`; read `invoices/assets/logo.png` and `qr-codes/QR_<amount>.pdf`.
- **SPA:** no direct `invoices` table access.

---

## Auth / security impact

- Gateway `verify_jwt: true` plus in-function `auth.getUser(token)` (`api-contracts.md` §1.1).
- Owner or admin only (FEAT-INV-005, XR-003).
- `invoices` / `invoice_counters` have no client RLS policies — intended for service role (`supabase-backend.md`).
- JWT must be passed explicitly; `functions.invoke` does not reliably refresh the captured header (`api-contracts.md`; `bookings.js` comment).

---

## UI impact

- `LessonsPage.jsx` + `InvoicePreviewModal` after Book Now.
- `PaymentsPage.jsx`: “Invoice (PDF)” vs “Get invoice”.
- No admin invoice list in this feature (admin UI is 004, proofs only).

---

## Non-goals

- `Pending/` → `Paid/`/`Refused/` storage move (documented future work).
- Setting `invoices.status = paid` on admin approval (004 gap; domain invariant vs live code).
- Client `UNIQUE(booking_id)` on `invoices`.
- Calling unused EFs (`upload-invoice-to-storage`, `merge-invoice-qr`, `verify-invoice-generation`).
- Stripe, card capture, or PDF libraries in the SPA.
- `plan.md` / `tasks.md` / production code changes.

---

## Known gaps

- Booking insert + invoice invoke are sequential, not transactional (orphan `receipt_url`).
- `UNIQUE(booking_id)` not applied — re-generate can create extra invoice rows.
- `Pending/` prefix is static; Paid/Refused move not implemented (`implementation-inventory.md`).
- `invoices.status` stays `pending` after payment is confirmed (004).
- SPA recovery parses amount from text `bookings.price`.
- No Edge Function tests; client contract covered by `bookings.test.js`; RPC covered by `invoiceNumber.integration.test.js` when secrets exist.

---

## Open questions

- ~~Should a second generate UPDATE the existing invoice instead of INSERT?~~ **Yes (`invoice-lifecycle`, 2026-08-19).** Add `UNIQUE (booking_id)`; regenerate UPDATEs (or passes `invoice_id`).
- ~~Should approval (004) flip `invoices.status` and move storage in the same transaction as proof approval?~~ **Yes, in `invoice-lifecycle` only (2026-08-19).** Approve → `paid` + move to `Paid/`. Reject proof → invoice stays `pending`. Do not implement inside 002/004 as they stand.
- Should missing QR for a known price fail generation instead of succeeding without a payment page?

---

## Assumptions

- Public `invoices` bucket URLs are acceptable for student download (current design).
- **Dual identity (Decision 2026-08-19):** invoice/legal branding is **CAG Padel Academy GmbH**; product UI is **AGC Padel Academy** (`XR-001`, `XR-002`).

---

## Baseline coverage

| ID | Covered? |
|---|---|
| FEAT-INV-001 … FEAT-INV-006 | Yes |
| FEAT-PAY-002, FEAT-PAY-003 | Yes (UI on `/payments`) |
| FEAT-BKG-007 … FEAT-BKG-009 | Yes (handoff from 001) |
| WF-005, WF-006 | Yes |
| XR-001, XR-005 | Yes |
| ACT-002 | Owner check on EF |
| FEAT-ADM-* / WF-010 | Out of this spec (004) |
