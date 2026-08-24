# Feature Specification: Admin Payment Verification

> **Retired 2026-08-24** by `007-bexio-integration`. Admin proof approve/reject is no longer a product capability. This document is a historical as-is reverse spec of the former admin panel. Do not implement from it.

**Feature Branch**: `004-admin-payment-verification`

**Feature Branch**: `004-admin-payment-verification`  
**Created**: 2026-08-19  
**Status**: Draft (reverse-engineered, as-is)  
**Input**: Live capability at `/admin/payment-verification`

> Reverse spec of **observed** behavior. **Intended** = documented or shown in copy but not implemented. Bugs are in Known gaps, not in FR-*.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin reviews payment proofs (Priority: P1)

An admin opens `/admin/payment-verification` and sees proofs in Pending / Approved / Rejected tabs, with student identity, booking info, upload time, and a View action.

**Why this priority**: Manual verification is how bank-transfer bookings become paid (`requirements.md` WF-011).

**Independent Test**: Sign in as `profiles.role = admin`; open the route; pending proofs list with name/email/lesson/price/date.

**Acceptance Scenarios**:

1. **Given** `/admin`, **When** the route loads, **Then** it redirects to `/admin/payment-verification` (`src/App.jsx`; FEAT-PUB-005).
2. **Given** a non-admin session, **When** that route is requested, **Then** `ProtectedRoute requireAdmin` navigates to `/` (`src/components/auth/ProtectedRoute.jsx`; ACT-005).
3. **Given** no session, **When** that route is requested, **Then** navigate to `/login` (ACT-004).
4. **Given** admin RLS, **When** `PaymentVerificationPanel` fetches, **Then** it SELECTs `payment_proofs` joined `bookings(..., profiles(full_name, email))` ordered by `upload_date` desc (`src/components/admin/PaymentVerificationPanel.jsx`).
5. **Given** a proof `file_url`, **When** View is clicked, **Then** `getSignedProofUrl` opens the file (`lib/storage.js`).

---

### User Story 2 - Approve a pending proof (Priority: P1)

The admin approves a pending proof. The booking becomes confirmed/paid from the student’s point of view, and an email is attempted.

**Why this priority**: This is the live “mark paid” action (FEAT-ADM-004, WF-010, WF-013).

**Independent Test**: Approve a pending proof; booking `payment_status` and `status` are `confirmed`; student sees “Paid” on `/payments`.

**Acceptance Scenarios**:

1. **Given** a pending proof, **When** Approve is clicked, **Then** `payment_proofs.verification_status = approved` (optional `admin_notes`) and the booking is updated `verification_status = approved`, `payment_status = confirmed`, `status = confirmed` (`PaymentVerificationPanel.jsx` `handleVerification`).
2. **Given** a student email on the joined profile, **When** the updates succeed, **Then** the panel fire-and-forgets `notify-payment-verification` with the session JWT (`PaymentVerificationPanel.jsx`; `api-contracts.md` §1.1 v6).
3. **Given** no email provider API key, **When** notify runs, **Then** verification MUST still have succeeded; the function logs the notification as failed (`api-contracts.md`; FEAT-ADM-007, WF-012).

---

### User Story 3 - Reject a pending proof (Priority: P1)

The admin rejects with optional notes. The booking stays payable; the student can upload again (003).

**Why this priority**: Bad proofs must not confirm the booking (FEAT-ADM-005, WF-009).

**Independent Test**: Reject with a note; proof is `rejected`; `bookings.payment_status` remains `pending`; student sees the note on `/payments`.

**Acceptance Scenarios**:

1. **Given** a pending proof, **When** Reject is clicked, **Then** proof `verification_status = rejected`, booking `verification_status = rejected`, `payment_status` stays `pending` (`handleVerification` else-if rejected).
2. **Given** notes in the input, **When** reject runs, **Then** they are stored on `payment_proofs.admin_notes` and sent in the notify body.
3. **Given** approved or rejected tabs, **When** rendered, **Then** notes are read-only; Approve/Reject buttons are not shown (`renderTable`).

---

### Edge Cases

- **Observed:** Notify is not awaited. A notify failure does not roll back the DB updates (WF-012). Errors are `console.warn`.
- **Observed:** If `proof.bookings?.profiles?.email` is missing, notify is skipped entirely (no `notifications_log` from this client path).
- **Observed:** Proof UPDATE and booking UPDATE are sequential. If booking UPDATE fails after proof UPDATE, statuses diverge.
- **Observed:** Approval does **not** set `invoices.status = paid` and does **not** move `invoices/Pending/` objects (`implementation-inventory.md`; `requirements.md` TODO).
- **Observed:** Combined invoice + proof admin view is not implemented (`AdminDashboardPage.jsx` single tab; comment “Future admin tabs”).
- **Observed:** Header has **no** admin navigation link (`src/components/layout/Header.jsx`) — admin must know the URL.
- **Intended in domain-model, not live:** invoice becomes `paid` on proof approval (`domain-model.md` invariant 2).

---

## Requirements *(mandatory)*

### Functional Requirements

Observed unless marked intended.

- **FR-001**: `/admin` MUST redirect to `/admin/payment-verification` (`App.jsx`).
- **FR-002**: The verification page MUST be wrapped in `ProtectedRoute requireAdmin` (UX only; real writes are RLS + EF — XR-003).
- **FR-003**: The panel MUST list proofs in three tabs: pending, approved, rejected, showing student name/email, lesson, price, date, upload time, and View (`PaymentVerificationPanel.jsx`; FEAT-ADM-002).
- **FR-004**: For a pending proof, the admin MUST be able to approve or reject, with optional notes (FEAT-ADM-003).
- **FR-005**: On approve, the system MUST set proof `approved` and booking `verification_status = approved`, `payment_status = confirmed`, `status = confirmed` (FEAT-ADM-004).
- **FR-006**: On reject, the system MUST set proof `rejected` and booking `verification_status = rejected`, and keep `payment_status = pending` (FEAT-ADM-005).
- **FR-007**: After a successful decision, the system MUST attempt `notify-payment-verification` (admin-only EF v6; 401/403 otherwise) and the function MUST write `notifications_log` (FEAT-ADM-006).
- **FR-008**: Missing email provider key MUST NOT undo the verification decision (FEAT-ADM-007).
- **FR-009**: Viewing a proof MUST use a signed URL from the private bucket.

### Key Entities

- **Payment proof** — decision target.
- **Booking** — status fields updated on decision.
- **Notification** (`notifications_log`) — written by the Edge Function, not the SPA.
- **Admin** — `profiles.role = 'admin'` (ACT-001, ACT-003).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can approve a pending proof and the student then sees “Paid”.
- **SC-002**: An admin can reject a proof and the student can upload again (003).
- **SC-003**: A student cannot load the admin panel (client redirect) and cannot UPDATE `payment_proofs` (RLS `is_admin()`).
- **SC-004**: A non-admin invoke of `notify-payment-verification` is 403 (`api-contracts.md`).

---

## Data impact

- **Write (client as admin, via RLS):** UPDATE `payment_proofs` (`verification_status`, `admin_notes`); UPDATE `bookings` (`verification_status`, and on approve `payment_status`/`status`).
- **Write (EF service role):** INSERT `notifications_log`.
- **Not written:** `invoices` rows or storage folder moves.

---

## Auth / security impact

- Client: `useAuth().role === 'admin'` (`ProtectedRoute.jsx`; `SupabaseAuthContext.jsx` `fetchRole`).
- Server: `payment_proofs` UPDATE `is_admin()`; `bookings` UPDATE all rows `is_admin()` (`supabase-backend.md` §5; migration `0001` / `0007` EXECUTE on `is_admin()`).
- EF v6: `verify_jwt: true` + `auth.getUser(token)` + `profiles.role = 'admin'` (`api-contracts.md`).
- Admin email identity is stored in `profiles`, not a hardcoded `admin@…` (`supabase-backend.md` role-system note).

---

## UI impact

- Routes: `/admin` → `/admin/payment-verification` → `AdminDashboardPage.jsx` + `PaymentVerificationPanel.jsx`.
- No Header admin link (gap).
- Dashboard copy mentions “bookings, payments, and system configurations” but only the payments tab exists (`AdminDashboardPage.jsx`).

---

## Non-goals

- Coach or accounting workflows (006 gaps; not live).
- Invoice folder moves or `invoices.status = paid`.
- Combined invoice + proof review UI.
- Customer-facing cancel (WF-014).
- Scheduling `cleanup-pending-bookings` (`api-contracts.md` §1.2 — must not be scheduled).
- `plan.md` / `tasks.md` / production code changes.

---

## Known gaps

- Approval does not update `invoices.status` or move PDFs (`implementation-inventory.md`).
- No Header entry to `/admin`.
- Proof vs booking updates are not transactional.
- Notify skipped when profile email is null.
- No tests for `PaymentVerificationPanel` (`implementation-inventory.md`).
- Dashboard subtitle overstates available admin tools.

---

## Open questions

- ~~Should approve also mark the invoice paid and move storage in one admin action?~~ **Yes, in `invoice-lifecycle` only (2026-08-19).** Approve → `invoices.status = paid`, `paid_at`, move `Pending/` → `Paid/`. Reject proof → invoice stays `pending`. Current 004 FRs stay bookings/proofs only.
- Should Header show Admin for `role === 'admin'`?
- Should notes be required on reject?

---

## Assumptions

- Single admin role is sufficient for this panel (no accounting split).
- Fire-and-forget email is acceptable as long as the decision persists.

---

## Baseline coverage

| ID | Covered? |
|---|---|
| FEAT-ADM-001 … FEAT-ADM-007 | Yes |
| FEAT-PAY-001 | Student-visible “Paid” after approve (badge on 003 page) |
| WF-010, WF-011, WF-012, WF-013 | Yes |
| ACT-003, ACT-005 | Yes |
| XR-003 | Yes (RLS + EF; ProtectedRoute is UX) |
| FEAT-PUB-005 | Yes |
| FEAT-INV-* Paid/move | **Not covered** (known gap, not an FR) |
