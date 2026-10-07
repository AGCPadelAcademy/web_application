# Research: Coach Management (F1.06)

**Feature**: [spec.md](spec.md)
**Date**: 2026-10-07

Decisions below close the spec’s technical unknowns. Confirmed from `005`, `006`, `008`, `009`, migrations `0008` and `0011`–`0013`, and the current admin/coach screens.

## R-01 — A Coach is the existing profile

**Decision**: Do not add a Coach table, payroll row, or second login. A Coach is `profiles.role = 'coach'` on the profile that already shares its id with the login.

**Rationale**: F1.02 and F1.04 already use that row for roster access, assignment, and active/inactive status. Two Coach profiles already exist, so no backfill is required.

**Alternatives considered**:

- Separate `coaches` table — duplicates identity and splits assignment.
- Auth invite / admin-created password — rejected by the spec and by F1.04.

## R-02 — Creating a Coach is a role change

**Decision**: An admin creates a Coach by setting an existing person’s `role` to `coach` through the current client-management update. The profile mutation guard remains the authority (no self-change, no `accounting`, last active admin preserved).

**Rationale**: The guard and admin profile UPDATE policy already exist. A second write path would drift from them.

**Alternatives considered**:

- New Edge Function to promote Coaches — extra deploy surface for a single column update.
- Out-of-band SQL only — does not meet the admin Coach-directory acceptance scenario.

## R-03 — Coach directory reuses client listing

**Decision**: The Coaches tab calls `listClients({ role: 'coach' })`, `updateClientPersonalFields`, `updateClientStatus`, and `updateClientRole`. It does not query a new projection.

**Rationale**: Admins already may read and update those fields. The missing product is a Coach-scoped screen, not a new permission.

**Alternatives considered**:

- Filter-only inside the client tab — easy to miss, and promotion is mixed with every other role.
- Duplicate the panel with a copied query — two field lists to keep in sync.

## R-04 — New assignment requires an active Coach

**Decision**: Replace `prevent_non_admin_coach_assignment()` so a non-null `coach_id` that is inserted or changed must match `role = 'coach' AND is_active`. Keep the distinct non-coach error. Add `coach_id must reference an active coach` when the target is a Coach but inactive.

**Rationale**: Today the trigger checks role only. `listCoachProfiles` also lists inactive Coaches, so the admin UI can assign them. `is_coach()` already hides the roster from an inactive Coach, but the spec forbids the new assignment itself.

**Alternatives considered**:

- UI-only filter — a direct `bookings` update would still succeed.
- Check `is_active` inside `is_admin()` assignment — wrong function; assignment validity is about the target, not the caller.

## R-05 — Deactivation does not rewrite history

**Decision**: Do not clear `bookings.coach_id` when `profiles.is_active` becomes false. Do not add an assignment-history table. An update that leaves `coach_id` unchanged does not re-validate activity.

**Rationale**: The spec requires past sessions to stay associated with that Coach. Re-checking activity on every booking update would block unrelated edits and pressure admins to clear history.

**Alternatives considered**:

- Null `coach_id` on deactivate — deletes the historical association.
- Append-only assignment ledger — out of scope; the spec assumption says the current Coach on the occurrence is the record.

## R-06 — Show the current inactive Coach in the assignment control

**Decision**: Choice lists contain active Coaches only. If an occurrence already points at an inactive Coach, that one profile is included so the control still displays them. Selecting them on a different occurrence is not offered; the trigger refuses a direct attempt.

**Rationale**: A select whose value is missing from the options looks unassigned and invites an accidental clear.

**Alternatives considered**:

- Hide inactive assignees — contradicts “history remains associated” on the admin screen.
- Keep listing every inactive Coach — makes the forbidden assignment look valid until save.

## R-07 — Roster and own profile need no new rules

**Decision**: Do not change `is_coach()`, `session_roster`, profile RLS, or the profile page.

**Rationale**: `is_coach()` already requires `is_active`. The roster reader already limits Coaches to `coach_id = auth.uid()` and returns identity plus phone. Owner updates already allow only client-controlled fields and fail for an inactive owner. Admin routes stay admin-only.

**Alternatives considered**:

- A Coach-specific profile form — duplicates F1.04 without a new field.
- A new roster column — the spec does not widen participant data.

## R-08 — No Edge Function

**Decision**: Promotion, edits, status, and assignment stay on the Data API plus the existing triggers.

**Rationale**: None of these operations need the service role. Edge Functions would bypass the pattern F1.04 already proved for profile writes.

**Alternatives considered**:

- `promote-coach` function — unnecessary privilege and another deploy check.

## R-09 — Migration number

**Decision**: Local file `supabase/migrations/0024_f106_coach_management.sql`. Before apply, confirm `0024` is unused on the remote project. Do not edit `0008` or `0011`.

**Rationale**: The latest local migration is `0023_f125_junior_places_countdown.sql`. Constitution requires a new forward migration.

**Alternatives considered**:

- Patch `0008` — rewrites applied history.

## R-10 — Groups, attendance, payroll, availability

**Decision**: No schema for Groups, attendance, compensation, or `availability`. `availability.trainer_id` is not assignment.

**Rationale**: The live session is a booking. The spec records that discrepancy and defers those products.

**Alternatives considered**:

- Add an empty `groups` table “for later” — speculative and not required for the integration point (`bookings.coach_id` already is that point).

## R-11 — Verification shape

**Decision**: Vitest covers the active-coach query and error mapping. A read-only SQL file checks the function body and, with test JWTs, the reject/allow cases. `npm run lint`, `npm test`, and `npm run build` are the implementation gate. Browser acceptance stays with the user via [quickstart.md](quickstart.md).

**Rationale**: Matches F1.04 and the project verification rule. No Edge Function means no Deno suite.

**Alternatives considered**:

- Browser automation by the agent — excluded unless the user asks.
