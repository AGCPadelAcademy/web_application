# Phase 0 Research: Adult Memberships (F1.09)

**Feature**: `011-adult-memberships` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

All findings verified against the current implementation (`src/`, `supabase/`) and the
brownfield baseline (`specs/baseline-system/`, `specs/project-context/`). No
`NEEDS CLARIFICATION` remains.

---

## R-01 — Group anchor: how Membership references a Group while F1.08 is unbuilt

**Decision**: Create a **minimal `groups` anchor table** in this feature's migration —
`id`, `name`, `weekday`, `start_time`, `end_time`, `capacity` (nullable), `is_active`,
timestamps — with RLS but **no application Group-management surface**. Group rows are
maintained by an Admin directly in the Supabase dashboard/SQL until F1.08 ships the real
Group product, which will evolve this table additively (Club, Coach, level, category,
roster operations). Membership creation validates that the referenced Group row exists
and `is_active` (FR-004). US3's generated-Session recognition stays a documented
contract for F1.08/F1.10/F1.11 (see R-10); nothing else in F1.09 waits on them.

**Rationale**: Without any `groups` table, FR-004 ("refuse a missing/invalid Group") can
never pass and no Membership could ever be created — the whole feature would be dead
code until F1.08. The spec non-goal is "implementing Group CRUD" (an application
product); a storage anchor with no UI/API surface does not implement Group CRUD and does
not "invent a Group" — Admins must point Memberships at pre-existing rows. The academy
has a handful of weekly recurring Groups, so dashboard-managed anchor rows are an
acceptable stopgap.

**Alternatives considered**:
- **Block all F1.09 implementation until F1.08 ships** — spec-faithful but delivers zero
  value from the P1 stories; the spec only marks US3 as blocked ("blocked on an
  identifiable Group and Session generation"), implying the rest should proceed.
- **`group_id` uuid without FK, wired later** — leaves a referential-integrity gap and
  still provides no way to satisfy "valid Group"; rejected.
- **Minimal admin Group create/list UI inside F1.09** — overlaps the F1.08 non-goal
  ("Group CRUD") and risks two competing Group surfaces; rejected. F1.08 owns all
  Group UI.

> **Assumption (flagged for plan review):** F1.08 will adopt and extend this table rather
> than create a parallel one. Columns are deliberately minimal so F1.08 can add Club,
> Coach, level, and category without migration conflicts.

## R-02 — Evolution of the existing unused `memberships` table

**Decision**: Evolve the live `memberships` table (0 rows; columns `id`, `user_id`,
`plan_id`, `start_date`, `next_charge_date`, `active`) additively: add `group_id`,
`status`, `cancellation_effective_on`, `updated_at`, constraints, and indexes. Keep all
legacy columns (`plan_id`, `start_date`, `next_charge_date`, `active`) untouched and
comment them as superseded by the F1.09 lifecycle.

**Rationale**: Constitution III/V — never delete columns, forward-only migrations,
additive changes. The table has 0 rows and no code references it (verified in `src/`
and `supabase/functions/`), so adding a NOT NULL `status` with default and a FK column
is safe. The legacy `active` boolean stays defaulting `true`; nothing reads it, and
coupling it to `status` via trigger would add complexity for a dead column (YAGNI).

**Alternatives considered**:
- **New `adult_memberships` table, legacy table untouched** — two membership tables
  contradicts "exactly one Membership" semantics and invites the credit-wallet confusion
  the spec supersedes; rejected.
- **Drop/repurpose legacy columns** — violates the constitution; rejected.

## R-03 — State-machine enforcement pattern

**Decision**: Enforce transitions in Postgres with a `BEFORE UPDATE OF status` trigger
(`guard_membership_status_transition`) plus admin-only RLS write policies. No Edge
Function, no SECURITY DEFINER RPC for transitions.

**Rationale**: Follows the proven F1.04 pattern (`guard_profile_mutation` trigger +
`is_admin()` + RLS, migration `0011`). Membership writes have no payment orchestration
or cross-system call (unlike F1.25's `register_camp_child`, which needed atomic
capacity + invoice issuance). The one atomicity risk — duplicate live Memberships — is
closed by a partial unique index (R-05), not by code. Server-side enforcement satisfies
FR-015 (hidden buttons are not enough) because RLS + trigger run in the database
regardless of the client.

**Alternatives considered**:
- **Edge Function per transition** — adds a Deno deploy surface with no orchestration to
  justify it; inconsistent with F1.04's direct-write admin pattern; rejected.
- **SECURITY DEFINER RPC** — appropriate for privilege-escalating transactions (F1.25
  capacity); here the caller is already an authorized Admin, so it adds indirection
  without a security benefit; rejected.

## R-04 — Audit history

**Decision**: New `membership_state_events` table (`membership_id`, `from_status`,
`to_status`, `actor_id`, `created_at`), written by an `AFTER INSERT OR UPDATE OF status`
trigger with `actor_id = (SELECT auth.uid())`. `from_status` is NULL on the creation
event. RLS: Admin SELECT only; no direct INSERT/UPDATE/DELETE for any role — rows are
trigger-written only.

**Rationale**: FR-005 requires actor/time/from-to auditability for every valid change,
including creation. Trigger-written audit cannot be bypassed or forged via the Data API
(FR-015). Admin-only read keeps the operational log least-privilege; the Client already
sees current state on the Membership row (US7) and history visibility for Clients is
not required by the spec.

**Alternatives considered**: reuse of `notifications_log` (wrong domain — outbound
mail), generic event log (no such infrastructure exists; YAGNI).

## R-05 — Duplicate live-Membership prevention

**Decision**: Partial unique index
`memberships_one_live_per_client_group ON memberships(user_id, group_id)
WHERE status IN ('pending_payment','active','paused')`.

**Rationale**: FR-004's "no second live Membership for the same Client+Group" must hold
under concurrent Admin actions; only a database constraint is race-safe. "Live" =
Pending Payment / Active / Paused per the spec Assumptions; Cancelled and Expired rows
do not block a later new Membership.

**Alternatives considered**: application-level check (race-prone, bypassable), full
unique index (would forbid legitimate re-membership after Cancelled/Expired).

## R-06 — Cancellation effective date (FR-012, 20th cutoff)

**Decision**: On the transition to `cancelled` by the owning client or an Admin, the
database sets `cancellation_effective_on` from the academy date
`(now() AT TIME ZONE 'Europe/Zurich')::date`. Day 1–20 inclusive: last day of that
month. Day 21 onward: last day of the next month. No override in V1. The same trigger
does not itself insert the next month’s charge; `create_membership_charges` does that
on the following 1st only when the effective date still covers that next month.

**Rationale**: The 2026-10-31 session replaced both the live Terms notice and the
2026-10-05 “end of the cancellation month” reading. One stored date lets
`membership_fixed_places` and the charge job share the rule. The 20th stays on the
on-time side.

**Alternatives considered**: Admin-chosen effective date (a second policy), keeping the
Terms 1st-of-previous-month notice (explicitly replaced; Discrepancy #5), using
`CURRENT_DATE` in UTC (moves the cutoff for evening users in Switzerland).

## R-07 — `expired` semantics (undefined in spec/issue)

**Decision**: `expired` is a terminal close-out state entered only by explicit Admin
action: `pending_payment → expired` (abandoned before activation — payment never
arrived) and `cancelled → expired` (bookkeeping close-out once the effective date has
passed). No exits from `expired`; no automatic transitions in V1.

**Rationale**: FR-003 lists "expire" as an Admin operation and US6.4 requires Expired to
refuse activation/pause, but neither the issue nor the spec defines when Expired happens.
The two entries above are the only ones consistent with every stated rule: Cancelled and
Expired never return to live participation (spec Edge Cases), and Expired does not block
re-membership (spec Assumptions). Keeping transitions manual matches the issue's
"activation is currently manual" posture; F1.26 may automate later.

**Alternatives considered**: automatic Cancelled→Expired job (adds scheduling
infrastructure for bookkeeping; YAGNI), dropping Expired from V1 (contradicts FR-003/US6).

## R-08 — Authorization model

**Decision**: RLS on `memberships`: Admin full access via existing `is_admin()`
(migration `0011`); Client `SELECT` own rows only (`(SELECT auth.uid()) = user_id`);
no DELETE policy for any role (history is never hard-deleted — spec Non-goals); the
legacy public self-read policy is rewritten to the `(SELECT auth.uid())` form while we
touch the table (advisor finding, in-scope). `groups`: Admin ALL; Client SELECT only
Groups they hold a Membership in (EXISTS subquery) — schedule rows carry no PII but
least-privilege is cheap here. `membership_state_events`: Admin SELECT only. The transition trigger allows an Admin
for every listed transition, the owning client only for cancel (T3, T7, T8), and
`create_membership_charges` only while `agc.membership_charge_job` is `on`. Every
other status change is rejected.

**Rationale**: FR-003/FR-014/FR-015. Reuses the F1.02/F1.04 `is_admin()` SECURITY
INVOKER function and the `(SELECT auth.uid())` advisor-compliant form. Coaches receive
no Membership policies (spec: no coach admin surface).

## R-09 — Frontend placement

**Decision**: Admin surface = new **Memberships tab** in `AdminDashboardPage.jsx` with a
`src/components/admin/MembershipManagementPanel.jsx` (list, create form selecting Client
from the existing client directory + Group from `groups`, per-row lifecycle actions with
confirmation dialogs). Client surface = **My Membership** section on `ProfileManagementPage.jsx`, including
cancel for the owning client. Create, activate, pause, resume, and expire stay on the
admin panel. New service module `src/lib/memberships.js` with Vitest
coverage, following `clientManagement.js` conventions (bounded selects, error mapping).

**Rationale**: Both placements reuse existing protected-route + role infrastructure
(F1.02/F1.04) and the established panel-per-tab admin pattern (Clients, Camps,
Integrations, Coach assignment). No new route guards or navigation concepts.

**Alternatives considered**: dedicated `/admin/memberships` route (the dashboard already
aggregates admin panels; a new route adds navigation for one panel), a `/membership`
client route (a single read-only card does not justify a route; profile page is the
F1.04 home for client self-view).

## R-10 — Fixed-place participation contract (for F1.08 / F1.10 / F1.11)

**Decision**: Publish the participation predicate as a security-invoker view
`membership_fixed_places(membership_id, user_id, group_id)` over `memberships` where
`status = 'active'` OR (`status = 'cancelled'` AND `cancellation_effective_on >= (now() AT TIME ZONE 'Europe/Zurich')::date`).
The view inherits `memberships` RLS (Clients see only their own rows; Admins see all).
The full consumer contract — recognition on generated Sessions, no duplicate Booking,
cancellation preservation — is documented in
[contracts/fixed-place-participation.md](contracts/fixed-place-participation.md) and
**not implemented here** (F1.08/F1.10/F1.11 are unbuilt).

**Rationale**: FR-007/FR-008 make the Membership the commercial source of the adult
fixed place; a single documented predicate prevents each consumer feature from
re-deriving (and diverging on) the rule, including the FR-012 notice-window nuance. A
view is the smallest artifact that encodes the rule in the database without building
Session generation.

**Alternatives considered**: documentation-only contract (drift risk once F1.10 lands),
duplicating the predicate into each future consumer (divergence risk).

## R-11 — Testing strategy

**Decision**: Three layers, matching repo conventions:
1. **Vitest 4** unit tests for `src/lib/memberships.js` with a mocked Supabase client
   (payload shape, error mapping, client-side guards) — `environment: 'node'`.
2. **SQL assertions** in `tests/sql/0024_f109_adult_memberships.test.sql` covering RLS
   policies, transition-trigger acceptance/refusal, audit-row writes, the partial unique
   index, and the effective-date computation — same style as `0011`/`0014` test files.
3. **Manual acceptance** by the user per [quickstart.md](quickstart.md) (repo rule:
   agent verification = automated gate only).

**Rationale**: Constitution testing section; no Edge Functions are added, so no Deno
tests are required for this feature.

## R-12 — No invoice Edge Functions and no emails

**Decision**: F1.09 adds **zero** Edge Functions and sends **zero** emails. It does
write `membership_charge_intents` and runs `create_membership_charges` from `pg_cron`.
It does not call Bexio. Manual activation stays an Admin write. Invoice issue does not
activate the Membership.

**Rationale**: FR-016 and FR-021. The charge row is the calendar. Sending the invoice
is F1.26.

## R-13 — Monthly price is set at create

**Decision**: `memberships.monthly_price_amount numeric(10,2)` is required and greater
than zero. The Admin sets it in the create form. The month intent copies that amount.
The fee is 10% of the unpaid month intent’s `amount`, rounded with
`round(amount * 0.10, 2)`. A later price edit does not rewrite an existing intent.

**Rationale**: The confirmed example is 10% of that month’s charge (CHF 200 → CHF 20),
not a separate price list.

**Alternatives considered**: a shared price catalogue (not in the spec), recomputing
the fee from the current column (would change a fee after a price edit).

## R-14 — Charge intents and the 1st job

**Decision**: Table `membership_charge_intents` with `kind` `month` or `cancel_fee`,
`period_key` `YYYY-MM` or `YYYY-MM:fee`, `amount`, `currency` `CHF`,
`source_period_key` for the fee, and nullable `paid_at`. Unique
`(membership_id, period_key)`. Only the service role sets `paid_at`, and only F1.26
does so when that claim is paid. F1.09 never sets it.

`create_membership_charges(p_on date)` is `SECURITY DEFINER`, executable by the
service role, and does nothing unless `p_on` is day 1. It is idempotent. For each
Membership, using the previous calendar month:

- An unpaid `month` intent produces exactly one `cancel_fee` intent. It does not
  produce a new `month` intent.
- If that Membership is still `active`, the function sets `agc.membership_charge_job`
  and moves it to `cancelled` with `cancellation_effective_on` equal to the last day
  of the unpaid month. A `paused` Membership stays paused and still gets the fee and
  no new month.
- An `active` Membership with no unpaid previous month gets one `month` intent for
  `p_on`’s month, at `monthly_price_amount`.
- A Membership cancelled after the 20th still gets that next `month` intent once,
  because its effective date covers that month. An on-time cancellation does not.
- `pending_payment` never gets a month intent.

If F1.26 is not deployed, `paid_at` stays null, so the next 1st creates the fee and
stops further months. That is the specified non-payment outcome, not a second policy.

**Rationale**: FR-021 and FR-022. Keeping the rows here stops F1.26 from inventing the
calendar. Ending an Active unpaid Membership on the fee day is what makes
`membership_fixed_places` stop after the unpaid month; leaving it Active would keep
the place.

**Alternatives considered**: storing the rows only in F1.26 (that feature must not
choose the 1st or the 10%), leaving status Active after the fee (the place would
continue).

## R-15 — Owner cancel is one column

**Decision**: RLS policy `memberships_owner_cancel` allows the owning client to UPDATE
their row only when the new `status` is `cancelled` and `user_id`, `group_id`, and
`monthly_price_amount` are unchanged. The trigger computes the effective date. The
client cannot create, activate, pause, resume, or expire.

**Rationale**: FR-003, FR-010, and FR-014.

## R-16 — Academy timezone

**Decision**: The 1st, the 20th, and `membership_fixed_places` use
`Europe/Zurich`. The cron job is `5 0 1 * *` in that zone when the host accepts a
cron timezone; the function still checks that the passed date is day 1.

**Rationale**: No timezone constant exists in `src/`. The academy bills in
Switzerland. This is an assumption for plan review.

---

## Resolved Technical Context summary

| Topic | Resolution |
|---|---|
| Group reference | Minimal `groups` anchor table, dashboard-managed until F1.08 (R-01) |
| Membership storage | Additive evolution of existing `memberships` table (R-02) |
| State machine | DB trigger + RLS, no Edge Function (R-03) |
| Audit | Trigger-written `membership_state_events` (R-04) |
| Duplicate live place | Partial unique index (R-05) |
| Cancellation effective date | 20th cutoff in `Europe/Zurich`, trigger-computed (R-06) |
| Expired | Admin-only close-out from Pending Payment or Cancelled (R-07) |
| Authorization | `is_admin()` plus owner cancel; no DELETE (R-08, R-15) |
| UI | Admin dashboard tab + profile card with cancel (R-09) |
| Fixed-place contract | `membership_fixed_places` view + contract doc (R-10) |
| Tests | Vitest + `tests/sql/0024`; manual acceptance by user (R-11) |
| Invoices and email | None; charge intents are written here (R-12, R-13, R-14) |
| Calendar zone | `Europe/Zurich` (R-16) |
