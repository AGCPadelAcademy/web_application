# Quickstart: Validate Client Management (F1.04)

**Feature**: [spec.md](spec.md)
**Authorization contract**: [contracts/authorization.md](contracts/authorization.md)
**Data model**: [data-model.md](data-model.md)

Use a separate test Supabase project. Never run destructive setup or role/status mutation checks against production.

## 1. Prerequisites

- Node.js `>=20.19`
- Project dependencies installed with `npm ci`
- Test Supabase project with the feature migration applied
- Test identities:
  - active admin A
  - active admin B (needed for safe demotion/deactivation tests)
  - active student S1
  - active student S2
  - active coach C
  - accounting user X
- Two bookings:
  - booking B1 owned by S1 and assigned to C
  - booking B2 owned by S2 and not assigned to C
- At least one historical invoice/document for S1

Record identifiers and obtain user JWTs through the test project’s normal sign-in flow. Do not store JWTs in git.

## 2. Automated quality gate

```bash
npm run lint
npm test
VITE_SUPABASE_URL=https://placeholder.supabase.co \
VITE_SUPABASE_ANON_KEY=placeholder-anon-key \
npm run build
```

Expected:

- lint exits 0
- all Vitest suites pass; integration suites skip when test secrets are absent
- production build exits 0

## 3. Migration and static database checks

Run the feature SQL checklist against the test project:

```text
tests/sql/<migration>_f104_client_management.test.sql
```

Confirm:

- new columns have expected type/default/nullability
- RLS remains enabled on `profiles` and `bookings`
- `is_admin()` / `is_coach()` are active-aware
- public roster view is security-invoker and exposes only contracted columns
- private roster reader has fixed output and no PUBLIC execution
- no DELETE policy was introduced for client/history records
- migration advisors report no new security errors

## 4. Direct authorization matrix

Perform these requests with each actor’s test JWT (Data API client, SQL role harness, or integration test). UI behavior is not evidence for these checks.

### Student S1

- [ ] SELECT own profile succeeds.
- [ ] SELECT S2 profile returns no row.
- [ ] UPDATE own phone/DOB succeeds while active.
- [ ] UPDATE own email, role, or status fails; values remain unchanged.
- [ ] UPDATE S2 profile affects zero rows.
- [ ] DOB in the future fails.

### Admin A

- [ ] List profiles returns S1, S2, C, X, and admins.
- [ ] Update S1 personal fields succeeds.
- [ ] Change S1 role to coach and back to student succeeds.
- [ ] Change A’s own role fails.
- [ ] Change profile email fails.
- [ ] With A and B active, deactivating/reactivating B succeeds.
- [ ] With only A active as admin, demoting or deactivating A fails.

### Inactive S1

After A deactivates S1:

- [ ] Sign-in still succeeds.
- [ ] SELECT own profile/bookings/existing invoice document succeeds.
- [ ] UPDATE own profile fails.
- [ ] INSERT a new booking fails.
- [ ] UPDATE/cancel an existing booking fails.
- [ ] Issue a missing/replacement invoice fails.
- [ ] Existing booking/invoice rows still reference S1.

After A reactivates S1:

- [ ] Profile update succeeds again.
- [ ] New booking succeeds subject to existing profile-completeness rules.

### Coach C

- [ ] Roster includes B1 with S1 identity and current phone.
- [ ] Roster excludes B2.
- [ ] Full S1 profile SELECT returns no row.
- [ ] Updating S1 profile/role/status fails.
- [ ] After B1 assignment is removed, B1 disappears on the next request.
- [ ] After C is deactivated, roster returns no rows.

### Accounting X and anonymous

- [ ] Neither can list profiles.
- [ ] Neither can open admin client management.
- [ ] Neither receives coach roster rows.
- [ ] Anonymous availability (`booking_slots`) still works without PII.

## 5. Browser journeys

Start the app:

```bash
npm run dev
```

### Student

1. Sign in as active S1.
2. Open `/profile`.
3. Confirm email, role, and status are read-only.
4. Edit DOB and phone; save and refresh.
5. Confirm the existing completeness gate still ignores DOB.

Expected: permitted values persist; existing booking/profile flows remain usable.

### Admin

1. Sign in as A and open the protected admin dashboard.
2. Open Client management.
3. Find S1 through search/filter and edit personal fields.
4. Toggle S1 inactive.
5. Verify directory state updates and historical records remain visible.
6. Reactivate S1.
7. Change another test user’s role and verify authorization changes after that user refreshes their session.

Expected: all primary tasks complete without impersonation; own-role and last-admin controls are disabled/refused.

### Inactive client

1. Deactivate S1 while S1 has an existing session or sign in afterward.
2. Open `/profile` and `/payments`.
3. Attempt profile save, new booking, and cancellation.

Expected: profile/history remain readable; mutations show a clear inactive message and fail server-side.

### Coach

1. Sign in as C and open `/coach/roster`.
2. Confirm B1 shows participant name and phone, without email/address/DOB/status/financial data.
3. Remove C’s assignment as admin and refresh.

Expected: B1 disappears immediately on the next request.

## 6. Regression checklist

- [ ] Existing registration creates exactly one profile.
- [ ] Existing profile completion and booking work for active students.
- [ ] Admin Bexio integration and reconciliation still require an active admin.
- [ ] Coach assignment still validates target role.
- [ ] Payments/invoice document retrieval still works for owners.
- [ ] Public lesson/availability pages show no client PII.
- [ ] No profile field is overwritten merely by signing in.
- [ ] No DOB appears in logs, bookings, roster, Bexio payloads, or analytics.

## 7. Completion evidence

Capture:

- automated command output for lint/test/build
- direct authorization results for student/admin/inactive/coach cases
- one concise browser recording covering admin deactivate/reactivate plus inactive-client behavior
- one roster screenshot/recording proving assigned phone visibility and unrelated-client denial

Update baseline docs (`requirements`, domain model, API contracts, backend inventory) only after implementation and test-project verification match this guide.
