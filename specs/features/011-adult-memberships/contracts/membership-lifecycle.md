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
| T3 | `pending_payment` → `cancelled` | Admin | `cancellation_effective_on` set (see below) |
| T4 | `pending_payment` → `expired` | Admin | Abandoned before activation |
| T5 | `active` → `paused` | Admin | Fixed place stops while Paused (FR-011) |
| T6 | `paused` → `active` | Admin | Fixed place restored (FR-011) |
| T7 | `active` → `cancelled` | Admin | `cancellation_effective_on` set (see below) |
| T8 | `paused` → `cancelled` | Admin | `cancellation_effective_on` set (see below) |
| T9 | `cancelled` → `expired` | Admin | Close-out after the effective date has passed |

Terminal for participation: `cancelled` (after its effective date) and `expired`.
No transition re-enters `pending_payment`; no transition leaves `expired`.

## Cancellation effective date (FR-012, Q2 Option B)

- On T3/T7/T8 the trigger sets
  `cancellation_effective_on = (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date`
  — the last day of the calendar month containing the cancellation.
- The Client keeps the fixed place **through** `cancellation_effective_on` (inclusive);
  participation stops for Sessions after that date.
- The live Terms notice rule (by the 1st of the previous month) is **not** enforced
  (spec Discrepancy #5).
- V1 has no Admin override of the effective date (research R-06 assumption).

## Audit contract (FR-005)

Every T1–T9 writes exactly one `membership_state_events` row:
`membership_id`, `from_status` (NULL on T1), `to_status`, `actor_id`
(`(SELECT auth.uid())`; NULL only for service-role maintenance), `created_at`.

- Rows are trigger-written only; no role can INSERT/UPDATE/DELETE them directly.
- Admin-readable; not client-visible (the Client reads current state on the Membership).
- A reviewer can reconstruct the full lifecycle of any Membership from these rows.

## Authorization contract (FR-003 / FR-014 / FR-015)

- All writes (create + T2–T9): Admin only, enforced by RLS (`is_admin()`) **and** the
  transition trigger. Direct PostgREST calls by students/coaches/anon fail.
- Reads: Admin all rows; Client own rows only.
- Deletes: none, for any role. History is never hard-deleted.

## F1.26 handover signal (future — not built here)

F1.26 (automatic collection) will drive T2 from a confirmed-payment signal. The contract
it consumes: **set `status = 'active'` on a `pending_payment` Membership** — the trigger
validates the transition and writes the audit row with the service actor. No other
automation hook exists or is needed.
