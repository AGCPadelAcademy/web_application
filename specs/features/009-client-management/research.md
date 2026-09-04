# Research: Client Management (F1.04)

**Feature**: [spec.md](spec.md)
**Date**: 2026-09-04
**Baseline**: `005` own-profile flow, `006`/`008` authorization and coach roster, migrations `0001`–`0010`

No `NEEDS CLARIFICATION` items remain. Decisions below resolve the implementation choices needed by the plan.

## R-01 — Reuse `profiles` as the client

**Decision**: Extend `public.profiles`; do not add a Client table or another identity.

**Rationale**: `profiles.id = auth.users.id` is already the canonical 1:1 client identity and is referenced by bookings, memberships, credits, availability, billing contacts, and coach assignments. A second client entity would duplicate identity and complicate ownership.

**Alternatives considered**:
- Dedicated `clients` table — rejected as duplicate identity with no independent lifecycle.
- Auth metadata — rejected because profile/domain data and authorization belong in application storage, not user-editable metadata.

## R-02 — Add only `date_of_birth` and `is_active`

**Decision**: Add nullable `date_of_birth date` and `is_active boolean NOT NULL DEFAULT true` to `profiles`.

**Rationale**: Date of birth is the only client field in F1.04 missing from the live profile and remains optional. Two-state lifecycle needs a boolean, not an extensible status catalog. Defaults preserve every existing profile as active.

**Validation**: Reject future dates. Do not add date of birth to profile-completeness rules.

**Alternatives considered**:
- Text date — rejected because it permits invalid/ambiguous values.
- Status enum — rejected because only active/inactive is required.
- Level fields — rejected because declared, Playtomic, and academy levels belong to F1.05.

## R-03 — Explicit field-difference guard

**Decision**: Replace the narrow role-only trigger with one profile-mutation guard that evaluates changed columns.

For an authenticated non-admin owner:
- Require the existing row to be active.
- Permit changes only to `first_name`, `last_name`, `full_name`, `phone`, `address`, `postal_code`, `city`, `country`, `country_code`, `date_of_birth`, and `updated_at`.
- Reject `email`, `role`, `is_active`, identifiers, and every future column by default.

For an active admin:
- Permit personal and academy-field changes on other profiles.
- Never permit profile-email changes (login email remains Auth-owned).
- Reject changing their own role.
- Apply last-active-admin protection to role/status changes.

**Rationale**: Comparing row differences to an explicit allow-list enforces field authorization even if a caller bypasses the form and automatically protects future academy-controlled columns until their owning feature intentionally allows them.

**Alternatives considered**:
- Frontend payload filtering only — rejected as non-authoritative.
- Column grants — rejected because students and admins share the Postgres `authenticated` role.
- Separate trigger per protected column — rejected because future fields could accidentally remain writable.

## R-04 — Direct PostgREST writes plus RLS, not a new API

**Decision**: Keep Supabase Data API access. Expand profile UPDATE RLS to `id = auth.uid() OR is_admin()`, with the mutation trigger enforcing field-level rules. Keep SELECT as owner-or-admin.

**Rationale**: The application already uses direct Supabase table operations. RLS determines rows; the trigger determines columns and invariants. No custom API or Edge Function is needed for profile management.

**Supabase guidance applied**:
- UPDATE also requires a matching SELECT policy.
- User-scoped tables remain RLS-enabled.
- Authorization continues to use `profiles.role`, never user metadata.

**Alternatives considered**:
- New admin Edge Function — rejected as unnecessary surface area.
- Privileged public function for all edits — rejected because ordinary owner/admin updates fit existing RLS patterns.

## R-05 — Active role helpers

**Decision**: `is_admin()` and `is_coach()` require both the matching role and `is_active = true`.

**Rationale**: Deactivation must remove operational privileges immediately on the next server access, including admin directory and assigned-participant PII. The database value is current and avoids stale JWT claims.

**Compatibility**: Inactive owners retain own-profile and own-history SELECT through ownership policies; they lose role-derived access.

**Alternatives considered**:
- Leave role helpers status-blind — rejected because an inactive admin/coach would retain privileged access.
- Put status in JWT claims — rejected because role/status changes would remain stale until token refresh.

## R-06 — Serialize last-admin changes

**Decision**: The profile-mutation trigger takes a transaction-scoped advisory lock before demoting or deactivating an active admin, then recounts active admins and refuses the change when only one remains.

**Rationale**: A simple count is race-prone: two concurrent transactions could both observe two admins and remove both. The shared transaction lock serializes all app-originated role/status removals.

**Scope**: The invariant applies to Data API changes. Trusted service/SQL operations remain an operational recovery path.

**Alternatives considered**:
- UI disable only — rejected as bypassable.
- Count without locking — rejected due to write skew.
- Permanent “owner admin” identity — rejected because no such domain concept exists.

## R-07 — Deactivation is read-only, not deletion

**Decision**: Keep the login identity, profile, and all foreign keys. Inactive owners can SELECT their profile, bookings, and invoice documents, but cannot update their profile, insert/update bookings, cancel bookings, or issue a missing invoice.

**Rationale**: This makes “normal student self-service mutations” read-only while preserving historical traceability. Reactivation restores existing policies without data recreation.

**Enforcement**:
- Profile trigger + UPDATE policy.
- Booking owner INSERT/UPDATE policies require an active profile.
- Existing active-admin policies remain.
- Owner-facing service-role Edge Functions that mutate data must check `is_active`; read-only invoice retrieval remains available.

**Alternatives considered**:
- Block sign-in — rejected by the approved assumption and would require Auth administration/session revocation.
- Delete profile/auth user — rejected because it can break history and contradicts retention.
- UI-only disable — rejected because direct requests would still mutate.

## R-08 — Make session bootstrap create-only

**Decision**: Refactor auth session profile bootstrap to create a missing profile but not overwrite an existing profile on every sign-in. Load `role` and `is_active` together into auth context.

**Rationale**: The current upsert rewrites name, phone, and `updated_at` from stale Auth metadata on every session restore. That would overwrite admin-managed client information and produce denied writes for inactive profiles. Once created, the application profile is authoritative.

**Compatibility**: Signup and legacy missing-profile recovery still create the required row. Existing users keep the same login/profile relationship.

**Alternatives considered**:
- Allow inactive auth-sync updates — rejected because it violates read-only deactivation.
- Keep logging a denied upsert on every inactive sign-in — rejected as noisy and avoidable.

## R-09 — Extend the fixed-output coach projection

**Decision**: Recreate `private.session_roster_rows()` and `public.session_roster` to add `participant_id` and `participant_phone`.

**Rationale**: Coaches cannot SELECT other profiles. The existing assignment-filtered projection is the least-privilege place to expose only identity + phone. `participant_id` gives a stable UI key/reference without opening a directory.

**Security shape**:
- Fixed-output privileged reader in unexposed `private`.
- Public `security_invoker` barrier view.
- Filter remains active coach + `coach_id = auth.uid()`, or active admin.
- Do not expose email, address, DOB, status, role, or financial fields.
- Do not hide inactive participants from historical/assigned roster records.

**Alternatives considered**:
- Coach SELECT policy on `profiles` — rejected as excessive PII.
- Phone from `bookings.client_phone` — rejected because it is a stale transaction snapshot; the profile is the client source of truth.
- New coach client endpoint — rejected because the roster projection already owns the assignment boundary.

## R-10 — Admin directory uses the existing dashboard

**Decision**: Add a Client management tab to `AdminDashboardPage`, backed by a focused `clientManagement` library and panel. Use paginated, server-filtered profile queries and an edit dialog/form.

**Rationale**: Bexio and coach assignment already share the protected admin dashboard. A tab is incremental and preserves existing routes. Service functions keep data logic testable without introducing component-test infrastructure.

**Alternatives considered**:
- Separate admin application — rejected as architectural expansion.
- Reuse coach-assignment service — rejected because client editing has a distinct contract.
- Fetch all profiles forever — rejected; small current scale does not justify omitting pagination.

## R-11 — Student profile and booking UX fail closed

**Decision**: Show role/status read-only and DOB editable on `/profile`; disable save for inactive profiles. On `/lessons`, check loaded profile status before opening completion/confirmation UI and show an inactive-account message.

**Rationale**: Server rules are authoritative, but explicit UI state avoids presenting actions guaranteed to fail. The final booking insert still enforces status server-side for stale tabs and direct calls.

**Alternatives considered**:
- Global redirect for inactive users — rejected because they must view profile/history.
- Add DOB to completion modal — rejected because it is optional.

## R-12 — Preserve email ownership

**Decision**: Neither student nor admin client-management writes `profiles.email`; it remains a displayed copy of the Auth identity.

**Rationale**: Editing only the profile copy would create a mismatch with login identity and Bexio/contact behavior. Auth-email change is explicitly out of scope.

**Alternatives considered**:
- Admin edits profile email only — rejected as inconsistent.
- Full Auth email-change workflow — rejected as a separate security-sensitive feature.

## R-13 — Migration and indexing

**Decision**: Plan one forward migration after the repository’s `0010`; confirm remote migration history before naming/applying it. Add no DOB/status index initially. Recreate changed functions/views transactionally and preserve grants.

**Rationale**: Current academy scale is tens of profiles. Directory pagination/order does not justify another index yet; existing role index remains useful. Migration numbering is known to have historical tracking gaps and must be verified before apply.

**Alternatives considered**:
- Rewrite `0008`/`0010` — rejected because applied migrations are immutable.
- Index every new field — rejected as unnecessary write overhead.

## R-14 — Verification strategy

**Decision**: Use three layers:
1. Vitest unit/contract tests for profile payload allow-lists, admin queries, roster columns, and inactive UI helpers.
2. Executable/commented SQL role scenarios on a separate test project for RLS, trigger, concurrency invariant, and projection grants.
3. Manual browser checks for student, admin, coach, and inactive-client journeys, followed by lint, full tests, and production build.

**Rationale**: UI tests alone cannot prove direct-request authorization. SQL checks alone cannot prove user journeys. Existing repository conventions use Vitest plus SQL authorization checklists.

**Alternatives considered**:
- Production database testing — rejected.
- Frontend-only checks — rejected by FR-011.

## Observations / implementation risks

- The deployed legacy `generate-invoice-pdf` function is documented but its source is not currently versioned under `supabase/functions/`. Before implementation closes FR-009, retrieve/inspect the deployed source or otherwise prove inactive owners cannot use it to create a missing invoice.
- Existing billing functions perform direct `role === 'admin'` checks. Mutating/admin functions must also require `is_active`; invoice-document retrieval should continue to allow inactive owners.
- PostgreSQL cannot change a table-returning function’s output shape with a simple `CREATE OR REPLACE`; drop/recreate the dependent roster view/function in one migration and restore exact grants.
- `ensureProfile` currently overwrites application fields during session restoration. R-08 is required to prevent admin edits being reverted.
- DOB is sensitive PII: never include it in coach projections, booking snapshots, logs, or analytics.
