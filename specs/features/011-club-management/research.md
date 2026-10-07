# Research: Club Management (F1.07)

**Feature**: [spec.md](spec.md)
**Date**: 2026-10-07
**Baseline**: domain model (no Club entity), `006`/`008` admin role, `009` Data API admin pattern, migrations through remote `0023_f125_junior_places_countdown` (listed 2026-10-07)

No `NEEDS CLARIFICATION` items remain. Decisions below resolve the implementation choices the spec left open as assumptions.

## R-01 — Create `public.clubs`; do not reuse another table

**Decision**: Add `public.clubs` as the only location record.

**Rationale**: Issue #12 says to reuse a Club/Location/Venue model if one exists. The domain model, baseline schema, and `src/` have none. Lessons, bookings, camps, and profiles do not store a venue. The footer address in `Footer.jsx`, `ContactPage.jsx`, and `TermsPage.jsx` is fixed marketing copy (`FEAT-PUB-003`), not a row that can be activated or deactivated.

**Alternatives considered**:
- Store clubs in `lessons` or `camps` — rejected because those are products, not locations, and would create a second meaning for those tables.
- Import the Villmergen footer address as the first club — rejected by the spec. Admins create clubs explicitly.
- A `venues` table plus a `clubs` table — rejected as the parallel model the issue forbids.

## R-02 — Direct Data API and RLS, not an Edge Function

**Decision**: The browser uses the existing Supabase client against `public.clubs`. Active-admin RLS and triggers are the security boundary.

**Rationale**: Client management already updates `profiles` this way. Camp admin uses an Edge Function because registration, capacity, and billing must be transactional. A club row has none of those side effects. A new function would add a deploy surface the constitution does not require.

**Supabase guidance applied**:
- RLS enabled in the same migration as the table.
- `UPDATE` policies include a `SELECT`/`USING` path so updates are not silent no-ops.
- Authorization uses `public.is_admin()` (active profile role), never JWT user metadata.
- The boolean helper lives in unexposed `private` and is `SECURITY DEFINER` with an empty `search_path`.

**Alternatives considered**:
- `camp-admin`-style Edge Function — rejected as extra surface for a single-table catalogue.
- Frontend-only role checks — rejected. `ProtectedRoute requireAdmin` on `/admin/integrations` stays as the page guard only.

## R-03 — Columns

**Decision**:

| Column | Rule |
|---|---|
| `id` | UUID, generated, immutable |
| `name` | Required, trimmed, 1–120 characters, unique on `lower(name)` |
| `location` | Optional place/address text, trimmed, max 500, blank becomes null |
| `phone` | Optional, trimmed, max 40, blank becomes null |
| `email` | Optional, trimmed, max 254, blank becomes null |
| `is_active` | Boolean, not null, default true |
| `created_at`, `updated_at` | Timestamps, set by the database |

**Rationale**: The spec’s required identity is the unique name plus active/inactive. Place and contact are optional. One location string matches “address or place” without copying the profile’s postal structure. Limits are long enough for a venue name and a street address and short enough to reject accidental pastes. No format regex for phone or email: the spec does not require one, and international numbers vary.

**Alternatives considered**:
- Separate street, postal code, city, and country — rejected until a second feature needs structured address search.
- Opening hours, courts, or prices — rejected. Those belong to later scheduling and pricing features.
- Status text or enum with more than two states — rejected. The lifecycle is active or inactive.

## R-04 — Uniqueness and rename

**Decision**: Before insert or update, trim `name`. A unique index on `lower(name)` rejects `Club Norte` versus `club norte`. The displayed casing remains what the admin saved. The primary key never changes, so a rename does not detach future child rows.

**Rationale**: Operators must tell clubs apart in one list. Stable `id` is the historical identity; the name is a label.

**Alternatives considered**:
- Case-sensitive uniqueness — rejected because it allows duplicate labels that differ only by case.
- `citext` — rejected to avoid a new extension for one column.
- Slug as the identity — rejected. A slug would change or collide on rename and is not in the spec.

## R-05 — No delete

**Decision**: Do not grant `DELETE`. Do not add a `DELETE` policy. A `BEFORE DELETE` trigger raises for every role, including the service role (which bypasses RLS).

**Rationale**: The spec forbids delete, including for a club that has never been used, so an identity cannot be recycled. RLS alone does not stop the service role.

**Alternatives considered**:
- RLS-only denial — rejected because service-role maintenance could still delete the row.
- Soft-delete column separate from `is_active` — rejected as a second lifecycle flag.

## R-06 — Active-club rule without group or session tables

**Decision**: This migration does not create groups, sessions, or `club_id` on bookings. It exposes:

- `public.clubs_for_new_use` — security-invoker view of active clubs (`id`, `name`, `location`) for the admin choice list.
- `private.club_is_selectable_for_new_use(uuid)` — boolean, true only for an existing active club.

Future group, session, or booking-location work must store `club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT` and reject a new or changed `club_id` unless the function returns true. An update that does not change `club_id` must still succeed after deactivation. A session that belongs to a group must use that group’s club; a session without a group stores its own `club_id`. That work is not part of this feature.

**Rationale**: The spec requires the rule now and forbids building scheduling or group management here. A shared function stops the next feature from copying a private venue list or re-implementing the active check. `ON DELETE RESTRICT` matches the no-delete trigger.

**Alternatives considered**:
- Add nullable `bookings.club_id` now — rejected. Current bookings have no location, and the spec does not ask this feature to place them.
- Add empty `groups` and `sessions` tables — rejected as unused schema.
- Enforce the rule only in the React form — rejected. Direct requests must fail too, and future writers need a database check.

## R-07 — Who can read clubs

**Decision**: Only an active admin can read `public.clubs` or the view. Students, coaches, accounting, inactive admins, and anonymous callers get no rows. The boolean function may be executed by `authenticated` and returns no name, place, or contact.

**Rationale**: The spec says only admins open the catalogue. People who can already see a historical record may see that record’s club later; there is no such record today, so this feature does not add a public or owner read path.

**Alternatives considered**:
- Public read of active club names — rejected. It would publish the catalogue before any product needs it.
- Coach read of every club — rejected. Coaches are not given a club roster here.

## R-08 — People are not linked to clubs

**Decision**: Do not add `profiles.club_id` or a coach-club membership table.

**Rationale**: Clients are not owned by a club. Coach assignment already lives on `bookings.coach_id` (F1.02). A future group or session points at one club and keeps its own coach assignment.

**Alternatives considered**:
- Home club on the profile — rejected by the spec and the current domain.
- Many-to-many coach assignments to clubs — rejected as a second roster.

## R-09 — Admin UI

**Decision**: Add a Clubs tab to `AdminDashboardPage`, rendered at `/admin/integrations` behind `ProtectedRoute requireAdmin`. Follow the existing tab, card, input, and toast patterns. The service module is `src/lib/clubs.js`.

**Rationale**: Clients, camps, Bexio, and coach assignment already share that dashboard. A new route would split the same admin guard for one list. The page subtitle and tab list gain the clubs entry. The `/admin` redirect stays on `/admin/integrations`.

**Alternatives considered**:
- New `/admin/clubs` route — rejected as an extra entry the current dashboard does not use for the other catalogues.
- Edit camps to carry a location — rejected. Camps stay a separate product (spec assumption).

## R-10 — Verification

**Decision**: Vitest covers the service allow-list, blank-name handling, duplicate-name mapping, and the absence of a delete call, using a mocked Supabase client. `tests/sql/0024_f107_club_management.test.sql` holds static privilege and definition checks. A throwaway child table inside that script, not in the migration, proves deactivation keeps a foreign key and delete fails. `npm run lint`, `npm test`, and `npm run build` are the implementation gate. Browser checks stay in the quickstart for the user. Test clubs on the live project must be obviously named and deactivated after the check.

**Rationale**: Constitution 1.2.1 makes the automated gate the agent’s verification. There is one production Supabase project, so actor checks must not invent unmarked data.

**Alternatives considered**:
- Deno tests — rejected. No Edge Function changes.
- A permanent `club_history_samples` table — rejected. It would be production schema only for a test.
