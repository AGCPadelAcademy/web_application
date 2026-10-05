# Contract: Fixed-Place Participation (F1.09 → F1.08 / F1.10 / F1.11 / F1.12 / F1.13)

**Producer**: F1.09 (this feature) — the `memberships` table and the
`membership_fixed_places` view. **Consumers**: F1.08 (Groups), F1.10 (Session
generation), F1.11 (Booking), F1.12 (adult Session cancellation), F1.13 (Recovery).

This contract is **documentation + one database view**. F1.09 does not implement Group
rosters, Session generation, Booking, cancellation, or Recovery (spec Non-goals).

## 1. Participation predicate (FR-007, FR-012)

A Membership confers a fixed place in its Group **iff**:

```text
status = 'active'
OR (status = 'cancelled' AND cancellation_effective_on >= CURRENT_DATE)
```

Published as the security-invoker view:

```sql
membership_fixed_places(membership_id, user_id, group_id)
```

- Inherits `memberships` RLS: Clients see only their own rows; Admins see all.
- Paused, Pending Payment, and Expired Memberships never appear.
- A Cancelled Membership appears until the end of its already-paid month
  (`cancellation_effective_on` inclusive), then disappears — no consumer should
  re-implement this window.

**Consumer obligation (F1.10)**: when generating Sessions for a Group, treat every
`membership_fixed_places.user_id` for that Group as a fixed participant. Consumers MUST
use this view (or this exact predicate) rather than re-deriving the rule.

## 2. No duplicate reservation (FR-008)

- The fixed place is expressed by the Membership row alone. Consumers MUST NOT create an
  ordinary Booking solely to keep an Active member assigned to a generated Session.
- F1.11 owns Booking capacity and MUST treat a Membership fixed participant and a
  one-off Booking for the same Client + Session as **one** occupant, not two.
- Duplicate live Memberships for the same Client + Group are impossible by constraint
  (`memberships_one_live_per_client_group` partial unique index); consumers may rely on
  at most one live Membership per Client per Group.

## 3. Cancellation preservation (FR-009, FR-010)

- F1.12 (adult Session cancellation) MUST NOT write `memberships.status`,
  `memberships.group_id`, or any Membership field. Cancelling one Session leaves the
  Membership and the fixed Group assignment untouched.
- F1.13 (Recovery) owns Recovery entitlements. They are domain records, not Membership
  credit; F1.09's unused legacy `credits` table MUST NOT be consulted or incremented.
- Membership cancellation (Admin, T7/T8) stops participation only after
  `cancellation_effective_on`; historical Sessions, Bookings, Attendance, and Recovery
  rows are never deleted or reassigned by any Membership transition.

## 4. Group anchor (F1.08 handover)

- F1.09 creates the minimal `groups` table (see
  [../data-model.md](../data-model.md#groups-new--minimal-anchor-owned-long-term-by-f108)).
  F1.08 evolves it additively (Club, Coach, level, category, roster) and owns all Group
  management UI.
- `memberships.group_id` has `ON DELETE RESTRICT`: a Group with Memberships cannot be
  hard-deleted; retiring a Group is `is_active = false` (blocks new Memberships, keeps
  history).
- F1.08 capacity semantics do not change this contract: the Membership is the
  commercial source of the adult fixed place; the Group roster is the operational list
  (spec Discrepancy #3 — one adult place, two layers).

## 5. What F1.09 guarantees to consumers

| Guarantee | Mechanism |
|---|---|
| At most one live Membership per Client + Group | Partial unique index |
| Participation window incl. paid-through cancellation | `membership_fixed_places` view |
| Every state change auditable (actor, time, from→to) | `membership_state_events` trigger writes |
| Membership state never mutated by Session cancellation | No F1.12 write path; RLS admin-only writes |
| History preserved | No DELETE policies; FK `ON DELETE RESTRICT` |
