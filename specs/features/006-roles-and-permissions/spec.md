# Feature Specification: Roles and Permissions

**Feature Branch**: `006-roles-and-permissions`  
**Created**: 2026-08-19  
**Status**: Draft (reverse-engineered, as-is)  
**Input**: Live authorization — `profiles.role`, RLS (`is_admin()`), Edge Function checks, `ProtectedRoute`

> Reverse spec of **observed** behavior. **Intended** = documented or shown in copy but not implemented. Bugs are in Known gaps, not in FR-*.  
> `coach` and `accounting` exist on the CHECK constraint only. They are **not** live actors. Do not write FRs that treat those roles as working products.
>
> **As-is only.** Target changes (F1.02 — live Coach, isolation tightenings) are [`specs/features/008-roles-and-permissions/spec.md`](../008-roles-and-permissions/spec.md). Do not merge that target into this file until 008 ships.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student owns their data (Priority: P1)

A signed-in user with `profiles.role = student` (the default) can create and see their own bookings and proofs, and cannot use admin APIs.

**Why this priority**: Almost all live users are students (`supabase-backend.md`: 43 student / 1 admin at snapshot).

**Independent Test**: As a student, SELECT own bookings; INSERT own booking; `/admin/payment-verification` redirects home; `generate-invoice-pdf` for another user’s booking returns 403.

**Acceptance Scenarios**:

1. **Given** a new profile, **When** the row is created, **Then** `role` defaults to `student` and CHECK allows `student|coach|accounting|admin` (`supabase-backend.md` `profiles.role`; ACT-001).
2. **Given** `bookings.user_id = auth.uid()`, **When** the student SELECTs/INSERTs/UPDATEs bookings, **Then** RLS allows those owner operations (ACT-002; `supabase-backend.md` §5).
3. **Given** a student session, **When** `/admin/payment-verification` is requested, **Then** client navigates to `/` (`ProtectedRoute.jsx`; ACT-005).
4. **Given** a student JWT, **When** `notify-payment-verification` is invoked, **Then** the function returns 403 (`api-contracts.md` v6).

---

### User Story 2 - Admin is the only extra live actor (Priority: P1)

A user with `profiles.role = admin` can read all bookings/proofs, update any proof/booking for verification, and call admin Edge Functions.

**Why this priority**: Payment verification (004) is the only extra live workflow (ACT-003, FEAT-ADM-001).

**Independent Test**: Set role to admin; open `/admin/payment-verification`; approve a proof; RLS UPDATE succeeds.

**Acceptance Scenarios**:

1. **Given** `profiles.role = admin`, **When** `fetchRole` runs, **Then** `useAuth().role` is `admin` (`SupabaseAuthContext.jsx`).
2. **Given** admin, **When** `is_admin()` is evaluated in RLS, **Then** SELECT all bookings, SELECT all payment_proofs, UPDATE any booking, UPDATE any payment_proof (`supabase-backend.md`; migration `0007` GRANT EXECUTE on `is_admin()`).
3. **Given** admin JWT, **When** `generate-invoice-pdf` is called for any booking, **Then** ownership-or-admin check passes (`api-contracts.md` §1.1).
4. **Given** `ProtectedRoute requireAdmin`, **When** role is admin, **Then** `AdminDashboardPage` renders (`App.jsx`).

---

### User Story 3 - Anonymous visitors see only non-PII availability (Priority: P2)

Unsigned visitors can read the lesson catalogue and `booking_slots`, not booking PII.

**Why this priority**: Public grid (001) after migration `0006` (XR-004).

**Independent Test**: Signed out, `/lessons` grid loads; direct `bookings` SELECT as anon fails.

**Acceptance Scenarios**:

1. **Given** anon, **When** `lessons` and `booking_slots` are selected, **Then** public policies allow it (`supabase-backend.md`; `bookings.js` `fetchDayBookings`).
2. **Given** anon, **When** `bookings` SELECT is attempted, **Then** owner/admin policies deny it (migration `0006`).

---

### Edge Cases

- **Observed:** `ProtectedRoute` documents that it is **not** a security boundary (`ProtectedRoute.jsx` comment). `allowedRoles` is implemented but **unused** by `App.jsx`.
- **Observed:** `fetchRole` errors default to `student`, so a transient profile read failure hides admin UI even for an admin (fail-closed on the client).
- **Observed:** `coach` and `accounting` pass the CHECK and would fail `requireAdmin`; no pages, RLS branches, or EFs treat them as privileged.
- **Observed:** `profiles` still has public SELECT `true` (`supabase-backend.md` ⚠️) — any visitor can read profile rows including email/role.
- **Observed:** `payment_proofs` INSERT policy has no owner WITH CHECK; UPDATE is admin-only.
- **Observed:** `invoices` / `invoice_counters` have RLS enabled and zero client policies (service-role only — intended for 002).
- **Intended, not live:** permission matrix for coach/accounting (`requirements.md` TODO).

---

## Requirements *(mandatory)*

### Functional Requirements

Observed unless marked intended.

- **FR-001**: Canonical authorization attribute MUST be `profiles.role` with CHECK `student | coach | accounting | admin` and default `student` (ACT-001).
- **FR-002**: Student ownership of a booking MUST be `bookings.user_id = auth.uid()` (ACT-002).
- **FR-003**: Admin MUST be `profiles.role = admin`. Client `/admin/payment-verification` uses `ProtectedRoute requireAdmin`. Server uses `is_admin()` and EF role checks (ACT-003, XR-003).
- **FR-004**: Unauthenticated access to `/profile`, `/payments`, `/admin/*` MUST redirect to `/login` (ACT-004).
- **FR-005**: Non-admin authenticated users MUST be redirected to `/` from `/admin/payment-verification` (ACT-005).
- **FR-006**: `/admin` MUST redirect to `/admin/payment-verification` (FEAT-PUB-005).
- **FR-007**: Anonymous PII MUST NOT be readable from `bookings`; public occupancy is `booking_slots` only (XR-004).
- **FR-008**: `is_admin()` MUST be executable by the roles that evaluate RLS (migration `0007`).
- **FR-009**: The SPA MUST read role via `useAuth().role` (`fetchRole` on session).
- **FR-010**: Coach and accounting MUST remain **schema-only** in this reverse spec — no live UI or workflow FRs.

### Key Entities

- **Profile.role** — single role per user (join table and JWT claims rejected — `supabase-backend.md`).
- **is_admin()** — SQL helper used by bookings and payment_proofs policies.
- **ProtectedRoute** — client UX guard.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Students cannot mutate another user’s bookings or approve proofs.
- **SC-002**: Admins can complete 004 without using the student’s account.
- **SC-003**: Anonymous visitors can use `/lessons` without seeing who booked a slot.
- **SC-004**: Removing `ProtectedRoute` would still leave RLS/EF blocking student writes to admin tables (XR-003).

---

## Data impact

- **Read:** `profiles.role` (own row + currently also public SELECT).
- **Write:** role is not changed by any live SPA form. Admin assignment is out-of-band (dashboard / SQL).
- **Policies:** listed in `specs/baseline-system/supabase-backend.md` §5.

---

## Auth / security impact

Live matrix (observed):

| Action | student | admin | anon | coach / accounting |
|---|---|---|---|---|
| Book lesson / own bookings | yes | yes (as user) | no | same as student in UI |
| `/payments` proofs | own | via RLS all | no | same as student in UI |
| `/admin/payment-verification` | redirect `/` | yes | `/login` | redirect `/` |
| `generate-invoice-pdf` | own booking | any | 401 | 403 unless they own |
| `notify-payment-verification` | 403 | yes | 401 | 403 |
| `booking_slots` | yes | yes | yes | yes |

`ProtectedRoute` is UX. Authorization for writes is RLS + EF (XR-003).

---

## UI impact

- `ProtectedRoute` on `/profile`, `/payments`, `/admin/payment-verification`.
- Header has profile, payments, sign out — **no admin link** (004 gap).
- `allowedRoles` unused.

---

## Non-goals

- Implementing coach calendars, accounting dashboards, or a permission matrix product.
- JWT custom claims.
- Multi-tenant academies (XR-002).
- Hardening work (public profiles SELECT, payment_proofs INSERT) as if it were already done.
- `plan.md` / `tasks.md` / production code changes.

---

## Known gaps

- Coach / accounting: CHECK values only; no workflows. **Decision 2026-08-19:** stay schema-only; no admin-equivalent access until `coach-accounting-matrix` after class-assignment / memberships-credits.
- `profiles` public SELECT `true`.
- Permissive `payment_proofs` INSERT and service-role-on-public policy (`supabase-backend.md` Advisor).
- No admin nav in Header.
- Client role fetch failure defaults to student (admin UI hidden until reload).
- `allowedRoles` dead API.

---

## Open questions

- ~~What may coach vs accounting do once specified?~~ **Deferred (2026-08-19).** Do not invent a matrix now. Specify after class-assignment / memberships-credits in `coach-accounting-matrix`. Until then only `student` and `admin` are live actors; accounting does not share admin access.
- Should public `profiles` SELECT be replaced with own-or-admin?
- Should INSERT on `payment_proofs` require booking ownership?

---

## Assumptions

- One role per user is enough (`supabase-backend.md` decision).
- Role changes happen outside the SPA and take effect on next `fetchRole` (no JWT claim refresh required).

---

## Baseline coverage

| ID | Covered? |
|---|---|
| ACT-001 … ACT-005 | Yes |
| XR-003, XR-004 | Yes (profiles public SELECT remains a gap under XR-003/PII) |
| FEAT-ADM-001 | Route + admin actor (panel behavior is 004) |
| FEAT-PUB-005 | Yes |
| Coach / accounting TODOs | **Gaps**, not FRs |
