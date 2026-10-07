# Quickstart: Validate Coach Management (F1.06)

**Feature**: [spec.md](spec.md)
**Contract**: [contracts/coach-management.md](contracts/coach-management.md)
**Data model**: [data-model.md](data-model.md)

Use a test Supabase project for role changes, deactivation, and assignment writes. Do not run those mutations against production.

## 1. Prerequisites

- Node.js `>=20.19`
- Dependencies installed (`npm ci`)
- Feature migration applied on the test project
- Identities:
  - active admin A
  - second active admin, only if a test demotes an admin
  - active student S
  - active Coach C
  - inactive Coach D, already assigned to booking B1
  - booking B2 with no Coach
- No new Edge Function to deploy

Sign in through the test project to obtain sessions. Do not commit tokens.

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
- Vitest passes; integration suites skip without test-project secrets
- production build exits 0
- `coachAssignments` tests expect the Coach list query to require `role = coach` and `is_active = true`, and to map the inactive-coach error

## 3. Database checks

Run `tests/sql/0024_f106_coach_management.test.sql` on the test project.

Static expectations:

- `prevent_non_admin_coach_assignment()` still exists and its body contains `is_active`
- no new `public` table for Coaches, Groups, attendance, or payroll
- `bookings.coach_id` still references `profiles`
- `is_coach()` still requires `is_active`

With test JWTs:

- admin assigns C to B2 and the update succeeds
- admin assigns D to B2 and the update fails with `coach_id must reference an active coach`
- admin assigns S to B2 and the update fails with the existing non-coach error
- S cannot change `coach_id` or set their own role to `coach`
- setting D’s `is_active` to false leaves B1.`coach_id` equal to D
- an update of B1 that does not change `coach_id` succeeds
- admin sets B2.`coach_id` to null and B2 still exists
- D’s roster read is empty; after reactivation, B1 is visible to D again

## 4. Journeys for manual acceptance

These are for the user in the live app after the quality gate passes.

1. As admin A, open Coaches. C and D are listed. No account migration step appears.
2. Promote student S to Coach. S appears in the Coach list and still uses the same login. There is no invite or create-login action.
3. As S, before or after promotion, confirm S cannot open the admin dashboard and cannot change their own role.
4. As admin, change C’s phone from the Coaches tab. As C, the profile shows the new phone. C cannot change role or active status.
5. Deactivate C. C can open their profile read-only and cannot open assigned-session operations. A booking that named C still names C.
6. Reactivate C. Assigned-session operations work again for bookings that still name C.
7. On Coach assignment, new choices are active Coaches. A booking already assigned to D still shows D. Choosing C for another booking succeeds. A direct inactive assignment does not stick.
8. As C, assigned only to one booking, the roster shows that booking’s participant identity and phone, not another booking, and not admin or billing screens.
9. Student booking, client management, camps, and Bexio admin entry still open for their existing roles.

## 5. Automated gate (2026-10-07)

Passed in this workspace:

- `npm run lint`
- `npm test` (121 passed, 2 skipped)
- `npm run build` with placeholder Supabase env vars

Remote migration history ends at `0023_f125_junior_places_countdown`. `0024` is unused. No `SUPABASE_TEST_URL` is configured, so `supabase/migrations/0024_f106_coach_management.sql` was not applied to production. The commented JWT section in `tests/sql/0024_f106_coach_management.test.sql` is still waiting on a test project.

Own-profile and roster screens were checked against the contract and left unchanged: role and status stay read-only, and the roster select stays identity and phone.

## 6. Regression boundaries

- Existing Coach profiles remain Coaches.
- Deactivation deletes nothing.
- Payroll, availability, Groups, and attendance stay absent.
- Participant fields stay identity and phone.

Section 4 remains for the user in the live app. Apply the migration on a test project before those journeys. Do not treat this file as baseline-system refresh; that waits until the feature is accepted.
