# Feature Specification: Auth and Profile Completion

**Feature Branch**: `005-auth-and-profile-completion`  
**Created**: 2026-08-19  
**Status**: Draft (reverse-engineered, as-is)  
**Input**: Live capability — signup/signin, email confirmation, password recovery, `/profile`, booking profile gate

> Reverse spec of **observed** behavior. **Intended** = documented or shown in copy but not implemented. Bugs are in Known gaps, not in FR-*.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register and confirm email (Priority: P1)

A visitor creates an account with name, phone, email, password, and terms, then confirms email before signing in.

**Why this priority**: Every student workflow starts here (WF-003).

**Independent Test**: Sign up with a new email; confirmation mail is sent; sign-in before confirm is refused.

**Acceptance Scenarios**:

1. **Given** the register tab, **When** terms are unchecked, **Then** signup is blocked (`src/pages/LoginPage.jsx`; FEAT-LGL-002).
2. **Given** phone digit count under 9, **When** register is submitted, **Then** a toast blocks signup (`phoneDigitCount`; FEAT-AUTH-001).
3. **Given** valid fields, **When** `signUp` runs, **Then** `supabase.auth.signUp` is called with `emailRedirectTo` `/auth/callback` and metadata `full_name`/`phone` (`src/contexts/SupabaseAuthContext.jsx`).
4. **Given** an already-registered email, **When** Supabase returns a user with empty `identities`, **Then** the UI switches to the login tab with “Account already exists” (`signUp` `duplicateAccount`; `LoginPage.jsx`; FEAT-AUTH-002).
5. **Given** email confirmation required, **When** signup succeeds without a session, **Then** the user is told to open the confirmation link and is not signed in (FEAT-AUTH-003).
6. **Given** a valid confirmation code, **When** `/auth/callback` sees a session, **Then** after a short delay it navigates to `/` (`src/pages/AuthCallbackPage.jsx`; FEAT-AUTH-004).
7. **Given** a new auth user, **When** `ensureProfile` runs, **Then** `profiles` is upserted with `id`, `email`, `full_name` (metadata or email), `phone` (`SupabaseAuthContext.jsx`; FEAT-AUTH-010, WF-003).

---

### User Story 2 - Sign in, sign out, and honor return_to (Priority: P1)

A confirmed user signs in with email/password, optionally returns to a booking URL, and can sign out from the header.

**Why this priority**: Booking requires a session (001).

**Independent Test**: Open `/login?return_to=/lessons?product=…`; sign in; land on that path (product query is unused by `/lessons` — see 001).

**Acceptance Scenarios**:

1. **Given** valid credentials, **When** `signIn` succeeds, **Then** navigate to `return_to` or `/` (`LoginPage.jsx` `handleLogin`; FEAT-AUTH-005, FEAT-AUTH-011).
2. **Given** an unconfirmed account, **When** sign-in fails with `email_not_confirmed`, **Then** the toast points to “Resend sign-up confirmation” (`signIn`; FEAT-AUTH-006).
3. **Given** bad credentials, **When** sign-in fails, **Then** a wrong-email-or-password toast is shown.
4. **Given** a session, **When** Header Sign out is clicked, **Then** `signOut` runs (`Header.jsx`; FEAT-AUTH-009).
5. **Given** `/profile` or `/payments` without a session, **When** the route loads, **Then** `ProtectedRoute` navigates to `/login` (`App.jsx`; ACT-004).

---

### User Story 3 - Reset password (Priority: P1)

A visitor requests a reset email, opens the link, sets a new password (≥ 6 characters, confirmed twice), and is sent to login.

**Why this priority**: Recovery must not leave the user logged in on a random page (WF-004).

**Independent Test**: Request reset; open link; `PASSWORD_RECOVERY` lands on `/reset-password`; submit matching passwords; go to `/login`.

**Acceptance Scenarios**:

1. **Given** a reset request, **When** `resetPasswordForEmail` runs, **Then** `redirectTo` is `{origin}/reset-password` (`SupabaseAuthContext.jsx`; FEAT-AUTH-007).
2. **Given** event `PASSWORD_RECOVERY` and path not `/reset-password`, **When** `onAuthStateChange` fires, **Then** `window.location.replace('/reset-password')` (`SupabaseAuthContext.jsx`).
3. **Given** `/reset-password`, **When** password length is under 6 or the fields mismatch, **Then** submit is blocked (`ResetPasswordPage.jsx`; FEAT-AUTH-008).
4. **Given** a successful `updatePassword`, **When** the form finishes, **Then** the user is sent to `/login` (`ResetPasswordPage.jsx`).

---

### User Story 4 - Complete profile before booking (Priority: P1)

A student fills billing fields so invoices can be generated. Completeness is UI-only.

**Why this priority**: Booking gate (001 FR-008) and invoice customer block (002).

**Independent Test**: Incomplete profile → Book Now opens `ProfileCompletionModal`; `/profile` can edit the same fields; email is read-only.

**Acceptance Scenarios**:

1. **Given** a profile, **When** `isProfileComplete` runs, **Then** `full_name`, `phone`, `address`, `postal_code`, `city`, `country` must all be non-empty strings (`src/lib/profileValidation.js`; FEAT-PRF-003). Tests: `src/lib/profileValidation.test.js`.
2. **Given** `/profile`, **When** the student saves, **Then** only `EDITABLE_PROFILE_FIELDS` are written; email is not in that list (`src/lib/profileService.js`; `ProfileManagementPage.jsx`; FEAT-PRF-001, FEAT-PRF-002).
3. **Given** incomplete profile on Book Now, **When** the modal saves, **Then** `updateProfile` runs and booking can proceed (001; FEAT-PRF-004).
4. **Observed:** ProfileCompletionModal extra checks: phone `length < 10` (string length, not digit count) and postal_code `length < 3` (`ProfileCompletionModal.jsx`).

---

### Edge Cases

- **Observed:** OAuth UI is wired (`signInWithOAuth`, `OAuthButtons`) but `OAUTH_PROVIDERS = []` on `LoginPage.jsx` — **OAuth is not live**.
- **Observed:** Phone rules differ: signup ≥ 9 digits; modal requires `phone.length < 10` (raw string, so `+41…` can pass with fewer digits).
- **Observed:** Completeness is not a DB constraint (`supabase-backend.md` profiles nullable; FEAT-PRF-003).
- **Observed:** `ensureProfile` sets `full_name` from email when metadata is empty — profile can still be incomplete for booking.
- **Observed:** `fetchRole` failure defaults role to `student` (`SupabaseAuthContext.jsx`).
- **Observed:** `AuthCallbackPage` always redirects confirmed users to `/`, not to a stored `return_to`.
- **Observed:** Modal `handleSave` does not re-run `isProfileComplete`; HTML `required` is the other fields’ check.
- **Intended (Decision 2026-08-19), not live:** country calling-code selector (default +41) + digits-only national number on signup, `ProfileCompletionModal`, and `/profile`; persist E.164 in `profiles.phone`.

---

## Requirements *(mandatory)*

### Functional Requirements

Observed unless marked intended.

- **FR-001**: Visitors MUST be able to register with full name, phone (≥ 9 digits), email, password, and terms (FEAT-AUTH-001, FEAT-LGL-002).
- **FR-002**: Duplicate signup MUST NOT create a second account; UI MUST switch to login with an explanation (FEAT-AUTH-002).
- **FR-003**: When confirmation is required, the user MUST NOT be signed in until the link is used (FEAT-AUTH-003).
- **FR-004**: `/auth/callback` MUST establish the session (client `detectSessionInUrl`) and redirect to `/` (FEAT-AUTH-004).
- **FR-005**: Confirmed users MUST sign in with email/password (FEAT-AUTH-005).
- **FR-006**: Unconfirmed sign-in MUST show a resend-oriented message (FEAT-AUTH-006). `resend` type `signup` is available on LoginPage.
- **FR-007**: Password reset MUST email a link to `/reset-password`; `PASSWORD_RECOVERY` MUST force that route (FEAT-AUTH-007, WF-004).
- **FR-008**: New password MUST be ≥ 6 characters, entered twice, then the user MUST go to `/login` (FEAT-AUTH-008).
- **FR-009**: Authenticated users MUST be able to sign out from the header (FEAT-AUTH-009).
- **FR-010**: First session MUST upsert `profiles` (`id`, `email`, `full_name`, `phone`) (FEAT-AUTH-010).
- **FR-011**: Login from a booking attempt MUST honor `?return_to=` (FEAT-AUTH-011). Auto-selecting `product=` is **not** this feature (001 gap).
- **FR-012**: `/profile` MUST view/update billing fields and MUST NOT write email (FEAT-PRF-001, FEAT-PRF-002).
- **FR-013**: Completeness is the six non-empty string fields, enforced in UI before booking, not in the database (FEAT-PRF-003, FEAT-PRF-004).

### Key Entities

- **Auth user** (`auth.users`) — owned by Supabase Auth.
- **Profile** (`profiles`) — 1:1 with auth user; billing + `role` (role usage is 006).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor can register, confirm, and obtain a `profiles` row.
- **SC-002**: Duplicate email does not produce a second usable account.
- **SC-003**: Recovery always presents `/reset-password` rather than a logged-in home page.
- **SC-004**: Incomplete profiles cannot insert a booking from `/lessons` (001 gate).
- **SC-005**: Profile form cannot change account email.

---

## Data impact

- **Write:** `auth.users` (Supabase Auth APIs); upsert/update `profiles` (own row RLS).
- **Not written here:** bookings, invoices, proofs.

---

## Auth / security impact

- Session via `@supabase/supabase-js`; client `src/lib/customSupabaseClient.js`.
- Protected routes: `/profile`, `/payments`, `/admin/*` (`App.jsx`).
- Profile UPDATE: `auth.uid() = id` (`supabase-backend.md`).
- **Gap:** `profiles` public SELECT `true` remains (`supabase-backend.md` §5; remaining hardening).
- OAuth providers disabled in UI.

---

## UI impact

- `/login` — tabs login/register; forgot password; resend confirmation; no OAuth buttons (`OAUTH_PROVIDERS` empty).
- `/auth/callback`, `/reset-password`.
- `/profile` — `ProfileManagementPage.jsx`.
- `ProfileCompletionModal` on `/lessons`.
- Header: profile, payments, sign out.

---

## Non-goals

- Live Google (or other) OAuth.
- Server-side profile-completeness constraint.
- Changing email from the app.
- Role assignment UI (006).
- `plan.md` / `tasks.md` / production code changes.

---

## Known gaps

- Phone validation inconsistent (9 digits vs modal string length 10) until the prefix+digits rule is implemented.
- OAuth code exists but is not enabled.
- `profiles` public SELECT.
- Confirmation callback drops `return_to`.
- Completeness not re-checked in modal `handleSave` beyond phone/postal.
- Only `profileValidation.test.js` covers this area (no LoginPage tests).

---

## Open questions

- ~~Unify phone rules (E.164 vs digit count vs raw length)?~~ **Yes (2026-08-19):** country calling-code picker (default **+41**) + national number **digits only**; same control on signup, `ProfileCompletionModal`, and `/profile`; store one E.164 string in `profiles.phone`. Completeness requires prefix + non-empty national digits. Not live yet.
- Should `/auth/callback` restore `return_to`?
- When should Google OAuth be enabled?

---

## Assumptions

- Email confirmation is on in the live Supabase project (code handles both confirmed-immediately and needs-confirmation).
- Default role `student` on new profiles is owned by 006 / DB default.

---

## Baseline coverage

| ID | Covered? |
|---|---|
| FEAT-AUTH-001 … FEAT-AUTH-011 | Yes (OAuth explicitly **not** in AUTH-* and not live) |
| FEAT-PRF-001 … FEAT-PRF-004 | Yes |
| FEAT-LGL-002 | Signup checkbox (booking checkbox is 001) |
| WF-003, WF-004 | Yes |
| ACT-004 | Yes |
| XR-003 | Partial (route guards UX-only; profile RLS exists) |
