# Implementation Plan: Adult Memberships (F1.09)

**Branch**: `sdd/f1-09-memberships-de-adultos` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/features/011-adult-memberships/spec.md`

## Summary

Add the adult Membership as an Admin-managed recurring fixed-place commitment linking
exactly one Client (F1.04 profile) to exactly one recurring Group, with a five-state
auditable lifecycle (Pending Payment, Active, Paused, Cancelled, Expired), manual
Admin-only activation, Pause/Resume operable in this slice (Q3-A), cancellation
effective at the end of the already-paid month (Q2-B), and the live `/lessons`
"Adult Memberships" catalogue kept as a separate product path (Q1-A). The design
evolves the existing unused `memberships` table additively, anchors the Group reference
in a new minimal `groups` table (owned long-term by F1.08, dashboard-managed until
then), enforces the state machine and audit in Postgres triggers behind
`is_admin()` RLS, and publishes the fixed-place participation rule as the
`membership_fixed_places` contract view for F1.08/F1.10/F1.11. No Edge Functions, no
emails, no payment coupling, no credit wallet.

## Technical Context

**Language/Version**: JavaScript/JSX on React 18 + Vite 7; SQL/PL/pgSQL for migrations.
Node `>=20.19`. No TypeScript migration; no Deno changes (zero new Edge Functions).

**Primary Dependencies**: Existing stack only — Supabase JS 2.30, Supabase
Auth/Postgres/RLS, React Router 6, existing Radix/shadcn-style components, existing
`is_admin()` / `guard_*` trigger pattern (migration `0011`), existing admin dashboard
tabs and `clientManagement.js` service conventions. Zero new npm packages.

**Storage**: Supabase PostgreSQL. Evolved `memberships` table (additive: `group_id`,
`status`, `cancellation_effective_on`, `updated_at`); new `groups` anchor table; new
`membership_state_events` audit table; new `membership_fixed_places` security-invoker
view; partial unique index for the one-live-place rule.

**Testing**: Vitest 4 for `src/lib/memberships.js` (mocked Supabase client); SQL/RLS
assertions in `tests/sql/0020_f109_adult_memberships.test.sql`; manual acceptance per
[quickstart.md](quickstart.md) by the user in the live app (repo rule: automated gate
only for the agent).

**Target Platform**: Vercel-hosted SPA and Supabase Cloud; modern browsers,
mobile-first.

**Project Type**: Existing web application (single SPA + managed Supabase backend).

**Performance Goals**: Academy scale — tens of adult members, a handful of Groups.
Admin creates/activates a Membership in under 2 minutes (SC-001); lifecycle writes are
single-row updates with trigger overhead in low milliseconds; owner reads are
index-backed (`user_id`).

**Constraints**: Least-privilege RLS (server-side authoritative, FR-015); no
Stripe/card path (FR-016); no generic credit balance (FR-002); brownfield
additive-only schema — legacy `memberships` columns retained (constitution III/V);
Swiss PII (Client↔Group assignment) visible only to owner Client and Admins; English UI.

**Scale/Scope**: One migration, one new frontend service module + tests, one new admin
panel + dashboard tab, one read-only client profile section, one contract view, two
contract documents. No Edge Functions, no Deno tests, no notifications.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle / constraint | Evaluation | Result |
|---|---|---|
| I. Understand before modifying | Read spec + issue #14 + clarifications, constitution, domain model §2.8–2.9, baseline backend (`memberships`/`credits` inventory, RLS list, advisor findings), F1.04 migration `0011` + `clientManagement.js`, F1.25 plan/contracts, admin dashboard structure, `tests/sql/` conventions | PASS |
| II. Spec-driven | Approved spec (all three clarifications resolved 2026-10-05) precedes this plan; tasks/implement remain later gates on the `sdd/f1-09-memberships-de-adultos` branch | PASS |
| III. Incremental/backward compatible | Additive-only schema evolution; legacy `memberships` columns kept; `/lessons` catalogue untouched (FR-017, Q1-A); no deletes for any role | PASS |
| IV. Security-first | RLS on all touched tables; `is_admin()` server-side checks + transition trigger defense in depth; owner-only client reads; no new secrets; no public PII projection | PASS |
| V. Migration discipline | One forward additive migration (`0020`, confirm remote head first); CHECK constraints for enum-style `status`; no unrelated schema-debt fixes (only the `memberships` policy/index we rewrite anyway) | PASS |
| VI. Documentation | research.md, data-model.md (Mermaid), contracts/, quickstart.md under the feature folder | PASS |
| VII. Simplicity/YAGNI | Reuses F1.04 direct-write admin pattern; no Edge Function/RPC where RLS+trigger suffices; no effective-date override, no notifications, no auto-transitions in V1 | PASS |
| Fixed stack | React/Supabase only; no custom API server; no new dependencies | PASS |
| RLS/EF written verification | RLS + trigger verification checklist below; no EF changes, so none needed | PASS |
| Secrets / Swiss PII | No secrets; Membership assignment PII limited to owner + Admin | PASS |

**Pre-design gate: PASS.** No unresolved clarifications (Q1-A, Q2-B, Q3-A answered on
issue #14 and encoded in spec §Clarifications).

### Post-design re-check

Research R-01–R-12 and the Phase 1 artifacts preserve every gate. The single judgment
call — creating the minimal `groups` anchor table instead of blocking on F1.08 — is
documented in research R-01 and Complexity Tracking with the rejected alternatives.
The transition triggers are `SECURITY INVOKER` (no privilege escalation); no waiver is
required.

## Project Structure

### Documentation (this feature)

```text
specs/features/011-adult-memberships/
├── spec.md                            # + Clarifications session 2026-10-05
├── plan.md                            # this file
├── research.md                        # Phase 0 output
├── data-model.md                      # Phase 1 output
├── quickstart.md                      # Phase 1 output
├── contracts/
│   ├── membership-lifecycle.md        # state machine + audit + F1.26 signal
│   └── fixed-place-participation.md   # F1.08/F1.10/F1.11/F1.12/F1.13 consumer contract
├── checklists/
│   └── requirements.md                # 16/16 passing
└── tasks.md                           # created later by /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── 0020_f109_adult_memberships.sql        # tentative next number; confirm remote head first

src/
├── lib/
│   ├── memberships.js                         # NEW: admin CRUD/lifecycle + owner read, error mapping
│   └── memberships.test.js                    # NEW: Vitest, mocked Supabase client
├── components/
│   └── admin/
│       └── MembershipManagementPanel.jsx      # NEW: list, create form, lifecycle actions
└── pages/
    ├── AdminDashboardPage.jsx                 # EXTENDED: Memberships tab
    └── ProfileManagementPage.jsx              # EXTENDED: read-only My Membership section

tests/
└── sql/
    └── 0020_f109_adult_memberships.test.sql   # RLS + transition trigger + audit + unique index
```

**Structure Decision**: Stay in the existing SPA + direct-Supabase layout. Admin
tooling is a tab in the existing protected dashboard (same as Clients/Camps); the
client view is a section of the F1.04 profile page; all authorization and lifecycle
rules live in Postgres (RLS + triggers), so no Edge Function is introduced.

## Phase 0: Research result

[research.md](research.md) resolves:

- Group reference without F1.08: minimal `groups` anchor table, dashboard-managed (R-01)
- Additive evolution of the existing `memberships` table; legacy columns retained (R-02)
- State machine via `BEFORE UPDATE` trigger + RLS — no Edge Function/RPC (R-03)
- Trigger-written append-only audit table (R-04)
- Race-safe duplicate prevention via partial unique index (R-05)
- Cancellation effective date = last day of the cancellation calendar month,
  trigger-computed, no V1 override (R-06)
- `expired` as Admin-only close-out from Pending Payment or post-effective Cancelled (R-07)
- `is_admin()` + owner-read RLS; no deletes (R-08)
- Admin dashboard tab + profile-page card placement (R-09)
- `membership_fixed_places` view as the single participation predicate (R-10)
- Vitest + `tests/sql/` split; no Deno tests (R-11)
- Zero Edge Functions / emails / billing coupling (R-12)

No `NEEDS CLARIFICATION` remains.

## Phase 1: Design result

- [data-model.md](data-model.md) defines the evolved `memberships`, new `groups` and
  `membership_state_events`, the `membership_fixed_places` view, RLS policies, the
  state machine (Mermaid + transition table), and the migration plan.
- [contracts/membership-lifecycle.md](contracts/membership-lifecycle.md) defines
  transitions T1–T9, the audit contract, the FR-012 effective-date rule, and the F1.26
  handover signal.
- [contracts/fixed-place-participation.md](contracts/fixed-place-participation.md)
  defines the participation predicate, no-duplicate-reservation rule, and cancellation
  preservation obligations for F1.08/F1.10/F1.11/F1.12/F1.13.
- [quickstart.md](quickstart.md) defines the automated gate and seven validation
  scenarios.

## Implementation design

### 1. Migration (`0020_f109_adult_memberships.sql`)

One migration only after confirming local/remote numbering (local head `0019`):

1. Create `groups` (constraints, `updated_at`, RLS `groups_admin_all` +
   `groups_member_read`, grants).
2. Alter `memberships`: add `group_id` NOT NULL FK → `groups.id` (ON DELETE RESTRICT),
   `status` NOT NULL default `pending_payment` with CHECK domain,
   `cancellation_effective_on` date, `updated_at`; add
   `memberships_one_live_per_client_group` partial unique index and FK indexes; comment
   legacy columns (`plan_id`, `active`, `next_charge_date`) as superseded.
3. Replace the legacy self-read policy with `memberships_owner_read`
   (`(SELECT auth.uid())` form) and add `memberships_admin_all`; no DELETE policy.
4. Create `membership_state_events` (FK ON DELETE RESTRICT, admin-read RLS, no write
   policies).
5. Create `guard_membership_status_transition()` (BEFORE UPDATE OF status: transition
   matrix T1–T9, admin check, sets `cancellation_effective_on`, maintains `updated_at`)
   and `record_membership_state_event()` (AFTER INSERT / AFTER UPDATE OF status) —
   both `SECURITY INVOKER`, `SET search_path = ''`, per migration `0011` style.
6. Create `membership_fixed_places` security-invoker view; grant SELECT to
   `authenticated`.

Do not modify `profiles`, `lessons`, `bookings`, `credits`, billing tables, or any
F1.25 Camp artifact.

### 2. Frontend service (`src/lib/memberships.js`)

- Admin: `listMemberships` (join Client name + Group name, status filter, bounded
  pagination), `createMembership({ clientId, groupId })`, and one function per
  transition (`activateMembership`, `pauseMembership`, `resumeMembership`,
  `cancelMembership`, `expireMembership`) — thin PostgREST writes; the database
  enforces validity.
- Client: `fetchMyMemberships()` (own rows + Group name/schedule).
- `mapMembershipError()` translating DB messages (duplicate live place, invalid
  transition, RLS denial, inactive Group/Client) into UI copy, following
  `clientManagement.js` conventions. Vitest coverage for payloads, guards, and error
  mapping.

### 3. Admin UI (Memberships tab)

- `MembershipManagementPanel.jsx` in `AdminDashboardPage.jsx`: filterable list
  (Client, Group, status, since, cancellation effective date), create form (Client
  selector reusing the client directory query, Group selector from `groups`), and
  per-row actions gated by current status (Activate, Pause, Resume, Cancel, Expire)
  with confirmation dialogs per existing admin conventions.
- Non-admins never reach the panel (existing protected route); direct backend calls by
  non-admins fail at RLS/trigger regardless (FR-015).

### 4. Client UI (My Membership)

- Read-only section on `ProfileManagementPage.jsx`: Group name, weekday/time, status
  label (Pending Payment / Active / Paused / Cancelled / Expired), and — when
  Cancelled — the effective end date. No client actions (FR-003/FR-014).

### 5. Contracts for neighboring features

- F1.10/F1.11 consume `membership_fixed_places`; F1.12 MUST NOT write Membership
  state; F1.13 owns Recovery; F1.26 consumes the T2 activation signal. Documented in
  `contracts/`; not implemented here.

## RLS / trigger verification checklist

Run per [quickstart.md](quickstart.md) with one admin, two clients, one anchor Group:

- [ ] Anon/coach/student cannot INSERT/UPDATE/DELETE `memberships` or
      `membership_state_events` (direct PostgREST denied)
- [ ] Client A reads only own Memberships and own Groups; Client B is denied A's rows
- [ ] Admin create without Client/Group, with inactive Group, or with deactivated
      Client is refused
- [ ] Second live Membership for same Client+Group violates the partial unique index;
      after Cancelled/Expired a new Membership is allowed
- [ ] Every T1–T9 transition succeeds and writes exactly one audit row with actor +
      from/to; every non-listed transition is refused with state unchanged
- [ ] Cancelling sets `cancellation_effective_on` to the last day of the current
      calendar month
- [ ] `membership_fixed_places` lists Active, lists Cancelled only until its effective
      date, and never lists Pending Payment/Paused/Expired
- [ ] No DELETE succeeds on `memberships` for any role
- [ ] `/lessons` catalogue booking + invoice flow still completes (FR-017/FR-020)

## Complexity Tracking

| Exception | Why needed | Simpler alternative rejected because |
|---|---|---|
| Minimal `groups` anchor table created by F1.09 (owned by F1.08) | Without it FR-004 can never pass and no Membership can exist; F1.08 is unbuilt with no ship date | Blocking all of F1.09 on F1.08 delivers zero P1 value; an FK-less `group_id` has no integrity; a Group UI here violates the F1.08 non-goal |
| Trigger-based state machine + audit (no Edge Function/RPC) | Single authoritative enforcement point; matches F1.04 `guard_profile_mutation` pattern; transition validity cannot be bypassed by any client | Edge Function adds a Deno surface with no orchestration to justify; RPC adds indirection without a privilege-escalation need |
| DB-computed `cancellation_effective_on` (end of cancellation month, no override) | "Already-paid month" (Q2-B) needs one deterministic rule; payment periods are not tracked in V1 | Admin-chosen dates add UI/validation for a case the Terms already cover; Terms-notice enforcement was rejected by Q2 |

## Spec synchronization note

Planning surfaced one inconsistency introduced by the Q2-B answer: US3 scenario 3, the
US5 independent test, and SC-006 treated "Cancelled" as immediately non-participating,
contradicting FR-012's paid-through window. The spec was harmonized on 2026-10-05
(Cancelled participates until `cancellation_effective_on`; new US3 scenario 4 covers
the window). No requirement was changed in meaning; the clarification answer was
applied consistently.
