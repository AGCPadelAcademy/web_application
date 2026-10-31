# Contract: Membership Lifecycle (F1.09)

**Consumers**: F1.26 (automatic collection, future), Admin dashboard (this feature),
Client self-view (this feature). **Producer**: the `memberships` table + transition
triggers defined in [../data-model.md](../data-model.md).

## States

`pending_payment` · `active` · `paused` · `cancelled` · `expired`

Stored in `memberships.status` (text + CHECK constraint). The legacy `active` boolean
column is superseded and MUST NOT be read as lifecycle state.

## Transitions

Only these transitions exist. Anything else is rejected by
`guard_membership_status_transition()` with a `raise_exception` (SQLSTATE `42501`-class
error) and leaves the stored state unchanged.

| # | From → To | Actor | Side effects |
|---|---|---|---|
| T1 | (none) → `pending_payment` | Admin | Creation event audited (`from_status` NULL). Requires active Client + active Group + no live duplicate (FR-004) |
| T2 | `pending_payment` → `active` | Admin | Manual activation (FR-006). Payment confirmation MUST NOT trigger this in V1 |
| T3 | `pending_payment` → `cancelled` | Owning client or Admin | `cancellation_effective_on` set (see below) |
| T4 | `pending_payment` → `expired` | Admin | Abandoned before activation |
| T5 | `active` → `paused` | Admin | Fixed place stops while Paused (FR-011) |
| T6 | `paused` → `active` | Admin | Fixed place restored (FR-011) |
| T7 | `active` → `cancelled` | Owning client or Admin | `cancellation_effective_on` set (see below) |
| T8 | `paused` → `cancelled` | Owning client or Admin | `cancellation_effective_on` set (see below) |
| T9 | `cancelled` → `expired` | Admin | Close-out after the effective date has passed |

Terminal for participation: `cancelled` (after its effective date) and `expired`.
No transition re-enters `pending_payment`; no transition leaves `expired`.

## Cancellation effective date (FR-012)

Academy dates use `(now() AT TIME ZONE 'Europe/Zurich')::date`.

- On T3/T7/T8, day 1–20 inclusive sets `cancellation_effective_on` to the last day of
  the current Zurich month. Day 21 onward sets it to the last day of the next Zurich
  month.
- The client keeps the fixed place **through** `cancellation_effective_on` (inclusive).
- A cancellation after the 20th still produces one next-month charge on the following
  1st. A cancellation on or before the 20th does not. Pending Payment never starts a
  month (FR-021).
- The published Terms notice (by the 1st of the previous month) is replaced
  (spec Discrepancy #5).
- V1 has no override of the effective date (research R-06).

## Audit contract (FR-005)

Every T1–T9 writes exactly one `membership_state_events` row:
`membership_id`, `from_status` (NULL on T1), `to_status`, `actor_id`
(`(SELECT auth.uid())`; NULL only for service-role maintenance), `created_at`.

- Rows are trigger-written only; no role can INSERT/UPDATE/DELETE them directly.
- Admin-readable; not client-visible (the Client reads current state on the Membership).
- A reviewer can reconstruct the full lifecycle of any Membership from these rows.

## Authorization contract (FR-003 / FR-014 / FR-015)

- Create, T2, T4, T5, T6, and T9: Admin only, enforced by RLS (`is_admin()`) and the
  transition trigger.
- T3, T7, and T8: owning client (`memberships_owner_cancel`) or Admin. The client
  cannot change `user_id`, `group_id`, or `monthly_price_amount`.
- Reads: Admin all rows; Client own rows only.
- Deletes: none, for any role. History is never hard-deleted.
- Direct PostgREST calls by other students, coaches, and anon fail.

## Charge intents (FR-021 / FR-022)

`create_membership_charges(p_on date)` runs at 00:05 `Europe/Zurich` on day 1. It
inserts `membership_charge_intents` and does not call Bexio. See research R-14.

When an Active Membership’s previous month is still unpaid, the same function moves
that Membership to `cancelled` with `cancellation_effective_on` on the last day of the
unpaid month. The audit actor is NULL. This path is allowed only while
`agc.membership_charge_job` is `on`. A Paused Membership is not moved; it still gets
the fee and no new month.

## F1.26 handover

F1.26 copies each uninvoiced charge intent into its own period inbox and issues one
invoice per intent. It writes `membership_charge_intents.paid_at` when that claim is
paid. It does not run T2. Invoice issue does not activate the Membership. Paying the
month after the fee exists does not delete the fee intent.
