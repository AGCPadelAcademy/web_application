# Research: Roles and Permissions (F1.02)

**Feature**: `specs/features/008-roles-and-permissions/spec.md`  
**Date**: 2026-08-24  
**Purpose**: Resolve design choices for the F1.02 delta so the plan and data model can reuse the live `006` authorization stack.

Sources: reverse spec `006`, live RLS/policies inspected 2026-08-24, `supabase/migrations/0001_add_roles_and_admin_rls.sql`, `ProtectedRoute.jsx`, constitution v1.1.2 (this branch).

---

## R-01. No roles table; keep `profiles.role`

- **Decision**: Canonical role remains `profiles.role` (`student | coach | accounting | admin`). Do not add `roles` / `user_roles`. Do not put the live role in JWT custom claims.
- **Rationale**: Already decided in baseline (`supabase-backend.md` §8) and required by FR-001. One role per user; claims would need session refresh on role change.
- **Alternatives considered**: Join table (overkill, one role per user); JWT claims (stale until refresh).

---

## R-02. Session occurrence = existing booking; assignment = `bookings.coach_id`

- **Decision**: Until `class-assignment`, a session occurrence is a `bookings` row. Persist assignment as nullable `bookings.coach_id` FK → `profiles.id`. Do **not** use `availability.trainer_id` (empty availability calendar; wrong meaning).
- **Rationale**: Smallest additive change. Migration `0001` already anticipated `bookings.trainer_id`; F1.02 uses `coach_id` to match the live role name. One coach per reservation is enough for v1; grouping several bookings into a class is out of scope.
- **Alternatives considered**:
  - *New `sessions` table* — rejected: that is `class-assignment`.
  - *Join table `booking_coaches`* — rejected until a second coach per occurrence is required (YAGNI).
  - *Reuse `availability.trainer_id`* — rejected by FR-007.

---

## R-03. Coach roster is a restricted view, not extra `bookings` SELECT

- **Decision**: Coaches do **not** get a general SELECT on other students’ `bookings` rows (those rows include price, payment status, emails). Expose a `session_roster` view with operational columns only: occurrence id, date/time, lesson name, participant display name, assigned coach. View is `SECURITY DEFINER` with `search_path = ''`, gated by `is_coach()` + `coach_id = auth.uid()`, or `is_admin()`.
- **Rationale**: FR-008 forbids financial/billing records. Postgres RLS is row-level; granting coach SELECT on `bookings` would leak price and payment fields. A column-restricted view is the existing-stack way to hide them.
- **Alternatives considered**:
  - *Column privileges on `bookings` for `authenticated`* — rejected: would also strip columns from students’ own SELECT.
  - *New roster table maintained by trigger* — extra write path; view is enough at academy scale.

---

## R-04. `is_coach()` mirrors `is_admin()`

- **Decision**: Add `public.is_coach()` (same shape as `is_admin()`: `SECURITY INVOKER`, `search_path = ''`, `(SELECT auth.uid())`). GRANT EXECUTE to the roles that evaluate RLS (same lesson as live migration `0007` for `is_admin()`).
- **Rationale**: Reuse the proven helper pattern; policies stay readable.
- **Alternatives considered**: Inline `EXISTS (SELECT 1 FROM profiles WHERE role = 'coach')` in every policy — rejected: duplicated, easy to miss `auth.uid()` wrapping.

---

## R-05. Role column is immutable via PostgREST

- **Decision**: BEFORE UPDATE trigger on `profiles` raises if `NEW.role IS DISTINCT FROM OLD.role` for `authenticated` / `anon`. Role changes stay out-of-band (SQL as a privileged operator / service role), matching how Admin is assigned today (FR-003).
- **Rationale**: Own-profile UPDATE currently has no column restriction; a student can PATCH `role` to `admin`. The SPA does not send `role`; XR-003 requires the server to refuse it.
- **Alternatives considered**:
  - *Column-level UPDATE grant excluding `role`* — viable; trigger is explicit and survives `SELECT *` upserts from `ensureProfile`.
  - *Allow admins to change role in the SPA* — out of scope (FR-003).

---

## R-06. Drop public profile SELECT; keep own / admin / roster

- **Decision**: DROP policy `Public profiles are viewable by everyone.` Keep `Users can read own profile role` (`id = auth.uid() OR is_admin()`). Coaches read participant **names** only through `session_roster`, not by listing `profiles`.
- **Rationale**: FR-004. Header, `profileService`, and `fetchRole` already filter `eq('id', user.id)`. Admin payment verification joins `bookings → profiles` and needs `is_admin()` SELECT (already present).
- **Alternatives considered**: Keep public SELECT — rejected: leaks email and role to anonymous callers.

---

## R-07. Tighten payment-proof **storage** policies; leave proof **table** INSERT as-is

- **Decision**: Replace overly broad `payment-proofs` storage policies (any authenticated SELECT on the bucket; INSERT without path check; service-role-on-`public` ALL) with owner-or-admin path rules using the existing `{booking_id}/…` object key. Do **not** rebuild the proof **table** INSERT/SELECT policies (live INSERT already has owner WITH CHECK).
- **Rationale**: FR-004 / SC-001. `006` was stale on table INSERT; storage remains the leak.
- **Alternatives considered**: Ignore storage because table RLS exists — rejected: signed URLs / object listing still bypass the table.

---

## R-08. No new Edge Functions

- **Decision**: Coach roster and admin assignment use PostgREST (view + `bookings.coach_id` UPDATE). Existing admin-only functions stay admin-only (`profiles.role = 'admin'`). Invoice/document functions stay owner-or-admin; a coach who does not own the booking gets 403.
- **Rationale**: YAGNI; constitution prefers existing PostgREST + RLS. No new Deno surface.
- **Alternatives considered**: Roster Edge Function — rejected: extra auth code duplicating RLS.

---

## R-09. Reuse `ProtectedRoute.allowedRoles` for the coach screen

- **Decision**: Add `/coach/roster` wrapped in `ProtectedRoute allowedRoles={['coach']}`. Admin still passes that guard (existing `isAdmin` bypass). Keep `/admin/*` as `requireAdmin`. Role fetch failure remains fail-closed to `student` (hides coach/admin UI; server still denies).
- **Rationale**: `allowedRoles` is implemented and unused (`006`). Do not invent a second guard.
- **Alternatives considered**: `requireCoach` boolean — rejected: dead API already covers it.

---

## R-10. Minimal admin assignment UI

- **Decision**: New admin tab on the existing Admin Dashboard: list upcoming/recent bookings and set/clear `coach_id` from profiles with `role = 'coach'`. After 007 landed, this tab is composed beside the Bexio integration panel. Not a class scheduler. Role promotion to coach stays SQL/out-of-band.
- **Rationale**: FR-007 requires an administrator to assign. A separate tab keeps assignment distinct from Bexio configuration while preserving 007's admin surface.
- **Alternatives considered**: SQL-only assignment — allowed by FR-003 for **roles**, but assignment must be exercisable for SC-003; a small tab is in spec Assumptions.

---

## R-11. `accounting` stays unused

- **Decision**: Leave CHECK value; no policies, screens, or `is_accounting()`. Treated as non-admin authenticated (same as today).
- **Rationale**: FR-002; deleting the value is a breaking schema change not requested.

---

## R-12. Migration numbering

- **Decision**: One additive SQL migration named for the **live** MCP sequence in constitution / `supabase-backend.md` (`0001`–`0007` already applied remotely). This feature’s file is `supabase/migrations/0008_f102_roles_and_permissions.sql`. Do **not** use `0003`: live already used `0003` for `lesson_code`, and `007` may add its own `0003_bexio` on another branch. Before apply, list applied migration names on the **test** project and only bump if `0008` is taken. GRANT EXECUTE on `is_admin()` / `is_coach()` stays in this file (live needed this as `0007`). Skipping `0003`–`0007` in this git tree is expected: those files were never committed here.
- **Rationale**: This checkout’s `supabase/migrations/` only contains `0001`–`0002`, which is **not** the live sequence. Numbering from the sparse git tree would collide with remote `0003`. MCP `apply_migration` identity is the name string.
- **Alternatives considered**: Name the file `0003_f102_…` to match this checkout — rejected: live `0003` already exists. Skip GRANT because 0001 REVOKE’d it — rejected: RLS helpers must be executable by the policy evaluator (documented live fix).

---

## R-13. Students must not write `coach_id`

- **Decision**: A BEFORE UPDATE trigger on `bookings` rejects `coach_id` changes unless `is_admin()`. Owner UPDATE (`auth.uid() = user_id`) otherwise stays as today (proof-upload bookkeeping).
- **Rationale**: Existing owner UPDATE has no column restriction. Without this, a student could assign any coach (or themselves) and grant roster access.
- **Alternatives considered**: Column-level `GRANT UPDATE` listing every non-assignment column — brittle as `bookings` gains columns (007 additive fields). Trigger is one rule.

---

## R-14. `session_roster` uses JWT `auth.uid()`, not the view owner

- **Decision**: `SECURITY DEFINER` view (bypass caller RLS on `bookings`/`profiles`) still filters with `auth.uid()` / `is_coach()` / `is_admin()`. Those helpers read the request JWT GUC, not the view-owner role, so a coach only sees their rows and a student sees none.
- **Rationale**: Needed to hide `price` / payment columns (R-03) without granting coaches SELECT on `bookings`.
- **Alternatives considered**: `security_invoker` view — caller would still need SELECT on underlying `bookings` rows, leaking financial columns.
