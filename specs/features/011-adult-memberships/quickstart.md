# Quickstart: Adult Memberships (F1.09)

**Feature**: `011-adult-memberships` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Runnable validation for the F1.09 slice: Membership lifecycle (create, activate, pause,
resume, cancel, expire), authorization, audit, and the fixed-place contract view. Group
CRUD UI, Session generation, Booking integration, Session cancellation, and Recovery are
owned by F1.08/F1.10/F1.11/F1.12/F1.13 and are **not** validated here.

## Prerequisites

- Repo checked out on the F1.09 implementation branch; `npm install` done.
- Supabase project (per constitution: the single project, used on explicit user request)
  with migration `0024_f109_adult_memberships.sql` applied.
- Two test auth users: one **Admin** (`profiles.role = 'admin'`), one **Client A**
  (active student) — plus Client B for cross-tenant denial checks.
- At least one anchor row in `groups` (inserted via Supabase dashboard until F1.08
  ships Group management), e.g. name "Tuesday Adults", weekday 2, 18:30–20:00.

## Automated quality gate (agent-run)

```bash
npm run lint
npm test                 # includes src/lib/memberships.test.js
npm run build
# SQL assertions (requires the test project connection used by tests/sql/):
#   run tests/sql/0024_f109_adult_memberships.test.sql
```

Expected: lint clean, all Vitest suites pass, production build succeeds, all SQL
assertions pass.

## Scenario 1 — Admin creates and activates a Membership (US1, US2)

1. Sign in as Admin → Admin Dashboard → **Memberships** tab.
2. Create a Membership: select Client A and the anchor Group → saved in
   **Pending Payment**; a creation audit row exists (`membership_state_events`,
   `from_status` NULL).
3. Activate it → status **Active**; second audit row records actor + from/to.
4. Expected: Membership visible in the admin list with Group name and status;
   `membership_fixed_places` now contains `(membership_id, A, group)`.

## Scenario 2 — Duplicate and invalid creates are refused (US1, FR-004)

1. Repeat Scenario 1 step 2 for the same Client A + same Group → refused (unique live
   place), no second row.
2. Create without a Client or without a Group → refused.
3. Create for a deactivated Client → refused.
4. Create referencing an inactive/missing Group → refused.

## Scenario 3 — Authorization (US1, US2, US7; FR-003/014/015)

1. As Client A (not admin): the Memberships admin tab is unreachable. Direct PostgREST
   `insert` fails. An update that is not a cancel fails (RLS).
2. As Client A: Profile page → **My Membership** shows Group, schedule, monthly price,
   and current status.
3. As Client B: reading A's Membership by id (direct query) returns nothing/denied.
4. As a coach: create/activate/cancel attempts fail server-side.

## Scenario 4 — Pause and resume (US6, FR-011)

1. As Admin: pause A's Active Membership → status **Paused**; `membership_fixed_places`
   no longer lists A.
2. Resume → status **Active**; A reappears in `membership_fixed_places`.
3. Both changes appear in `membership_state_events` with actor and timestamps.

## Scenario 5 — Cancellation on the 20th and after it (US5, FR-012)

Dates are `Europe/Zurich`.

1. As Client A, cancel an Active Membership on the 20th → **Cancelled**,
   `cancellation_effective_on` = last day of that month. The next 1st does not insert
   a month intent for the following month.
2. As Admin, cancel another Active Membership on the 21st → **Cancelled**,
   `cancellation_effective_on` = last day of the next month. The next 1st inserts that
   next month once.
3. Client B cannot cancel A's Membership.
4. `membership_fixed_places` lists the Membership through the effective date inclusive.
5. Historical rows remain. No delete occurred.

## Scenario 6 — Lifecycle enforcement (US6, FR-005)

1. Attempt invalid transitions via direct SQL/PostgREST as Admin: `expired → active`,
   `cancelled → active`, `active → pending_payment`, same→same → all refused, stored
   state unchanged, no audit row written.
2. Expire an abandoned `pending_payment` Membership (T4) → allowed and audited.
3. Close out a `cancelled` Membership after its effective date (T9) → allowed and
   audited.

## Scenario 7 — The 1st charge and the 10% fee (US8, FR-021, FR-022)

Use `create_membership_charges` with an explicit date. Price CHF 200.00.

1. Active Membership, call for 1 August → one `month` intent `2026-08` for 200.00.
   A second call the same day does not add a row.
2. Leave `paid_at` null. Call for 1 September → one `cancel_fee` intent `2026-08:fee`
   for 20.00, no `2026-09` month intent, status **Cancelled**, effective date 31 August.
3. Set August `paid_at` on a different Active Membership before 1 September → one
   `2026-09` month intent and no fee.
4. A Membership cancelled on 25 August still receives the September month once.
5. A Paused Membership receives no new month. If its previous month is unpaid, it
   receives the fee and stays Paused.
6. Setting `paid_at` after the fee exists does not delete the fee.

## Scenario 8 — Regression: existing flows untouched (FR-016/017/020, SC-010)

1. `/lessons` catalogue still lists "Adult Memberships" products and completes a
   booking + invoice for a returning student (separate path, FR-017).
2. My Payments and Camp registration (F1.25 self-declaration) behave as before.
3. No card-payment UI appears anywhere in the Membership flow (SC-009).

## Remaining manual acceptance (user, live environment)

Per repo rules the agent stops at the automated gate. The user verifies in the live app:
Scenarios 1–8 above, plus readability/mobile layout of the Memberships tab and the My
Membership card.
