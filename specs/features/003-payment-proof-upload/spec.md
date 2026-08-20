# Feature Specification: Payment Proof Upload

**Feature Branch**: `003-payment-proof-upload`  
**Created**: 2026-08-19  
**Status**: Draft (reverse-engineered, as-is)  
**Input**: Live capability on `/payments` (`PaymentProofUpload`, `PaymentProofPreview`)

> Reverse spec of **observed** behavior. **Intended** = documented or shown in copy but not implemented. Bugs are in Known gaps, not in FR-*.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student uploads a bank-transfer proof (Priority: P1)

A signed-in student with a pending booking uploads a PDF/JPG/PNG (≤ 5 MB). The file lands in private storage and a `payment_proofs` row is created as pending.

**Why this priority**: This is the only live payment method (`requirements.md` WF-007; XR-005).

**Independent Test**: On `/payments`, upload a valid file on a pending booking; a new proof row exists and the booking shows pending verification.

**Acceptance Scenarios**:

1. **Given** `payment_status = pending` and no proof or latest proof `rejected`, **When** `/payments` renders, **Then** `PaymentProofUpload` is shown (`src/pages/PaymentsPage.jsx`).
2. **Given** a file larger than 5 MB or a MIME type other than `application/pdf`, `image/jpeg`, `image/png`, **When** the student selects it, **Then** a toast blocks selection (`src/components/payments/PaymentProofUpload.jsx`).
3. **Given** a valid file, **When** Confirm Upload runs, **Then** the client counts existing `payment_proofs` for that booking, uploads to `payment-proofs` at `{bookingId}/attempt-{n}.{ext}` with `upsert: false`, INSERTs `payment_proofs` (`verification_status = pending`), and UPDATEs the booking `verification_status = pending`, `proof_uploaded_at` (`PaymentProofUpload.jsx`).
4. **Given** a successful upload, **When** the page refreshes data, **Then** the upload control is replaced by `PaymentProofPreview` for the latest non-rejected proof (`PaymentsPage.jsx`; FEAT-PAY-006).

---

### User Story 2 - Re-upload after rejection (Priority: P1)

After an admin rejects a proof, the student sees the notes (or a default message) and can upload again. Previous files stay in storage and in `payment_proofs`.

**Why this priority**: Rejection must not delete the booking or the rejected proof (WF-009).

**Independent Test**: Reject a proof as admin (004); as student, see notes and upload a second attempt.

**Acceptance Scenarios**:

1. **Given** latest proof `verification_status = rejected`, **When** `/payments` renders, **Then** “Previous Upload Rejected” shows `admin_notes` or “Please upload a valid payment proof.” (`PaymentsPage.jsx`).
2. **Given** a second upload, **When** the count of rows is `n`, **Then** the new path is `attempt-{n+1}` and a new row is inserted (append-only; FEAT-PAY-008).
3. **Given** multiple proofs, **When** the page maps proofs, **Then** only the latest by `upload_date` is shown (`PaymentsPage.jsx` reduce; FEAT-PAY-009).

---

### User Story 3 - View the current proof via signed URL (Priority: P2)

While a non-rejected proof exists, the student can open it through a 24-hour signed URL.

**Why this priority**: The `payment-proofs` bucket is private (`src/lib/storage.js`).

**Independent Test**: After upload, click View File; a signed URL opens.

**Acceptance Scenarios**:

1. **Given** `proof.file_url`, **When** `PaymentProofPreview` mounts, **Then** it calls `getSignedProofUrl` (`storage.js`, TTL 86400 seconds).
2. **Given** `verification_status` pending or approved, **When** preview renders, **Then** the badge is “Pending Verification” or “Approved” (`PaymentProofPreview.jsx`).

---

### Edge Cases

- **Observed:** MIME and size are **client-only**. The `payment-proofs` bucket has no documented MIME/size limits (`implementation-inventory.md` / Advisor notes in `supabase-backend.md`).
- **Observed:** Storage upload, DB insert, and booking update are sequential. A failed insert after a successful upload leaves an orphaned object. A failed booking update after insert leaves the proof row without a matching booking flag.
- **Observed:** `upsert: false` — colliding `attempt-n` names fail rather than overwrite.
- **Observed:** Students list proofs with `.in('booking_id', bookingsData.map(...))`. Empty bookings array still queried.
- **Observed:** Rejected proofs are not shown in `PaymentProofPreview` on `/payments` (upload UI is shown instead). The preview component still has a rejected branch that this page does not use.
- **Observed:** Legacy storage objects may still use `{bookingId}/{bookingId}_{timestamp}.{ext}`; new uploads use `{bookingId}/attempt-{n}.{ext}` (`FEAT-PAY-007`).

---

## Requirements *(mandatory)*

### Functional Requirements

Observed unless marked intended.

- **FR-001**: `/payments` MUST list only the signed-in user’s bookings, newest first, with lesson name, date, price, and payment badge (`pending` → “Pending”, `confirmed` → “Paid”) (`PaymentsPage.jsx`; FEAT-PAY-001).
- **FR-002**: Upload MUST be available only while `payment_status = pending` and the latest proof is missing or `rejected`.
- **FR-003**: After rejection, the student MUST see admin notes or the default message and MAY upload again.
- **FR-004**: While a non-rejected proof exists, the student MUST see a preview, not the upload control.
- **FR-005**: Client MUST accept only PDF/JPEG/PNG and files ≤ 5 MB.
- **FR-006**: Files MUST be stored in the private `payment-proofs` bucket at `{bookingId}/attempt-{n}.{ext}` (`PaymentProofUpload.jsx`; `FEAT-PAY-007`).
- **FR-007**: Each upload MUST INSERT a new `payment_proofs` row with `verification_status = pending` and set `bookings.proof_uploaded_at` and `bookings.verification_status = pending`. Previous rows MUST be retained.
- **FR-008**: The UI MAY show only the most recent proof per booking.
- **FR-009**: Viewing a proof MUST use a signed URL (`getSignedProofUrl`, 24 h).
- **FR-010**: The application MUST NOT charge a card (WF-007, XR-005).

### Key Entities

- **Payment proof** (`payment_proofs`): `booking_id`, `file_url` (storage path), `verification_status`, `admin_notes`, `upload_date`.
- **Booking**: `payment_status`, `verification_status`, `proof_uploaded_at`.
- **Storage object**: private `payment-proofs` bucket.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student can attach a valid proof to their own pending booking.
- **SC-002**: A rejected proof remains stored; a new attempt can be uploaded.
- **SC-003**: Proof files are not publicly listed; access is via signed URL.
- **SC-004**: My Payments never shows another student’s bookings (RLS owner SELECT; ACT-002).

---

## Data impact

- **Read:** `bookings` (owner); `payment_proofs` (owner via booking or admin).
- **Write:** storage upload; INSERT `payment_proofs`; UPDATE own `bookings` (`verification_status`, `proof_uploaded_at`).
- **Not written:** `invoices.status`, invoice storage folders (002 / 004).

---

## Auth / security impact

- Route `/payments` is `ProtectedRoute` (`src/App.jsx`; ACT-004).
- RLS: `payment_proofs` SELECT owner-via-booking or `is_admin()`; INSERT authenticated; UPDATE admin (`supabase-backend.md` §5).
- **Gap:** INSERT policy has no owner check (`WITH CHECK` empty / “—” in `supabase-backend.md`). An authenticated user could insert a row for another `booking_id` if they know the UUID.
- **Gap:** Advisor WARN — “Service Role Full Access Payment Proofs” targeting `public` is overly permissive (`supabase-backend.md`).
- Bucket is private; signed URLs are the read path.

---

## UI impact

- Route: `/payments` → `PaymentsPage.jsx`.
- Components: `PaymentProofUpload.jsx`, `PaymentProofPreview.jsx`.
- Header link “My Payments” (`src/components/layout/Header.jsx`).
- No page-level tests (`implementation-inventory.md`).

---

## Non-goals

- Admin approve/reject (004).
- Invoice PDF generation (002).
- Card / Stripe payment.
- Bucket-level MIME/size enforcement (not live).
- Showing full proof history in the UI.
- `plan.md` / `tasks.md` / production code changes.

---

## Known gaps

- MIME/size enforced only in the browser (bucket has no MIME/size limits).
- Upload + insert + booking update are not transactional.
- Permissive `payment_proofs` INSERT and service-role-on-public policies (`supabase-backend.md` Advisor).
- No UI tests for this page.

---

## Open questions

- Should INSERT RLS require `booking.user_id = auth.uid()`?
- Should Storage add MIME/size limits to match the client?
- Should a failed insert after upload roll back or delete the object?

---

## Assumptions

- Append-only proofs are intentional (audit trail for 004).
- Students do not need to see older attempts in the UI.

---

## Baseline coverage

| ID | Covered? |
|---|---|
| FEAT-PAY-001 | Yes (list + badges) |
| FEAT-PAY-004 … FEAT-PAY-006, FEAT-PAY-008, FEAT-PAY-009 | Yes |
| FEAT-PAY-007 | Yes — live path `{bookingId}/attempt-{n}.{ext}`; MIME/size client-only (bucket has no limits) |
| FEAT-PAY-002, FEAT-PAY-003 | Adjacent (002 UI on same page) |
| WF-007, WF-008, WF-009 | Yes |
| XR-005 | Yes |
| ACT-002, ACT-004 | Yes |
| FEAT-ADM-* | Out of this spec (004) |
