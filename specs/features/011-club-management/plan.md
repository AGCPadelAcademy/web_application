# Implementation Plan: Club Management (F1.07)

**Branch**: `cursor/club-management-9ec6` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/features/011-club-management/spec.md`

## Summary

Introduce one `public.clubs` catalogue. Active admins create, view, update, deactivate, and reactivate clubs through the existing admin dashboard and the Supabase Data API. Row Level Security, a write trigger, a case-insensitive unique name, and a delete-blocking trigger enforce the rules when a caller bypasses the screen. Deactivation only flips `is_active`. No club is deleted, and no existing booking, profile, camp, or lesson row is altered. Groups and sessions are not built. Later features must reference this club and call one shared active-club check instead of inventing another location list.

## Technical Context

**Language/Version**: JavaScript/JSX on React 18 + Vite 7; SQL/PL/pgSQL for one migration. Node `>=20.19`. No TypeScript migration. No new Edge Function.

**Primary Dependencies**: Existing dependencies only — Supabase JS 2.30, Supabase Auth/Data API, PostgreSQL RLS/triggers/views, React Router 6, existing Radix/shadcn-style dashboard tabs. Zero new packages.

**Storage**: Supabase PostgreSQL. New `public.clubs`, admin-only RLS, `public.clubs_for_new_use` (security invoker), and `private.club_is_selectable_for_new_use(uuid)`. No columns added to `profiles`, `bookings`, `lessons`, or `camps`.

**Testing**: Vitest 4 for `src/lib/clubs.js`; SQL assertions in `tests/sql/0024_f107_club_management.test.sql`; `npm run lint`, `npm test`, and production build. Direct-request and dashboard checks are listed in [quickstart.md](quickstart.md) for the user. No Edge Function tests.

**Target Platform**: Vercel-hosted SPA and the existing Supabase Cloud project; modern browsers.

**Project Type**: Existing web application (single SPA + managed Supabase backend).

**Performance Goals**: An admin creates a club and sees it in the catalogue in under 2 minutes. With at least 20 clubs, finding a named club and its status takes under 30 seconds. The catalogue loads in one bounded query ordered by name.

**Constraints**: Admin-only management and catalogue reads; screen hiding is not the security boundary; no hard delete; stable `id` across rename and deactivation; unique name ignoring case and surrounding spaces; public footer/contact/terms address stays hardcoded marketing copy; no group, session, pricing, or billing behavior; migration is forward-only; confirm remote migration history immediately before applying.

**Scale/Scope**: A handful of venues, well under the 20-club acceptance check. One migration, one dashboard tab, one service module, one panel. No second location model.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle / constraint | Evaluation | Result |
|---|---|---|
| I. Understand before modifying | Spec gap analysis plus dashboard, `clientManagement` Data API pattern, camp admin (not reused — it is an Edge Function product), migrations through remote `0023`, and `private` schema rules | PASS |
| II. Spec-driven | Approved-for-planning `spec.md` and checklist precede this plan. Tasks and implementation stay later gates. Work stays on `cursor/club-management-9ec6` | PASS |
| III. Incremental / backward compatible | Additive table only. Bookings, profiles, camps, lessons, and the public address copy are untouched | PASS |
| IV. Security-first | RLS uses `is_admin()` (active admin). No user-metadata checks. No public club read. DELETE blocked even for the service role by a trigger. `private` holds the boolean check | PASS |
| V. Migration discipline | Next file is `0024` only because remote history ends at `0023` (listed 2026-10-07). Reconfirm at implementation. `numeric` money does not apply. Status is boolean, not free text | PASS |
| VI. Documentation | Research, model, contract, quickstart, and Mermaid live under this feature folder. Baseline sync waits until the feature ships | PASS |
| VII. Simplicity / YAGNI | No Edge Function, no group/session tables, no coach-club roster, no client home club, no price or hours columns | PASS |
| Fixed stack | Existing React/Supabase stack only | PASS |
| RLS written verification | Checklist in this plan and [quickstart.md](quickstart.md) | PASS |
| Secrets / Swiss PII | Club contact details are academy operational data, visible only to active admins. No secrets | PASS |

**Pre-design gate: PASS.** No unresolved clarifications.

### Post-design re-check

Research R-01–R-10 and the Phase 1 artifacts keep every gate. The only privileged object is a boolean in unexposed `private`, matching migration `0010`: future writers can ask “may this id be chosen?” without granting catalogue reads. No constitution waiver is required.

## Project Structure

### Documentation (this feature)

```text
specs/features/011-club-management/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── clubs.md
├── checklists/
│   └── requirements.md
└── tasks.md                         # created later by /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── 0024_f107_club_management.sql            # next number if remote tip is still 0023

src/
├── lib/
│   ├── clubs.js                                 # NEW: list/create/update/status
│   └── clubs.test.js                            # NEW
├── components/
│   └── admin/
│       └── ClubManagementPanel.jsx              # NEW: catalogue, form, activate/deactivate
└── pages/
    └── AdminDashboardPage.jsx                   # Clubs tab on the existing dashboard

tests/sql/
└── 0024_f107_club_management.test.sql           # static assertions; fixture FK only inside the test script
```

**Structure Decision**: Stay in the SPA and Data API layout used by client management. The screen is a new tab on `/admin/integrations` (`ProtectedRoute requireAdmin`), which is already the admin dashboard. Do not add a route, an Edge Function, or a second admin page. Do not change `Footer.jsx`, `ContactPage.jsx`, or `TermsPage.jsx`.

## Phase 0: Research result

[research.md](research.md) resolves:

- a new `clubs` table, because no location entity exists
- admin-only Data API plus RLS, not an Edge Function
- name, optional place and contact, and `is_active`
- case-insensitive uniqueness and no delete
- the active-club rule as a view plus a `private` boolean, with no group or session tables yet
- dashboard placement and the public address left untouched

No `NEEDS CLARIFICATION` remains.

## Phase 1: Design result

- [data-model.md](data-model.md) defines columns, validation, lifecycle, and the future group/session relationship that this migration does not create.
- [contracts/clubs.md](contracts/clubs.md) defines Data API outcomes for each actor.
- [quickstart.md](quickstart.md) defines the automated gate, SQL assertions, and the user journeys still to check by hand.

## Implementation design

### 1. Migration `0024_f107_club_management.sql`

Reconfirm `supabase_migrations.schema_migrations` (or the Supabase migration list) still ends at `0023_f125_junior_places_countdown` before creating the file. If a higher version exists, use the next free number and keep the `f107_club_management` suffix.

1. Create `public.clubs` with RLS enabled in the same migration:
   - `id uuid` primary key, default `gen_random_uuid()`
   - `name text` required, stored trimmed, 1–120 characters
   - `location text` null, trimmed, max 500
   - `phone text` null, trimmed, max 40
   - `email text` null, trimmed, max 254
   - `is_active boolean` not null, default `true`
   - `created_at` and `updated_at timestamptz` not null, default `now()`
2. Unique index on `lower(name)`.
3. `BEFORE INSERT OR UPDATE` trigger trims fields, turns blank optional fields into null, rejects a blank name and an `id` change, and sets `updated_at` on update.
4. `BEFORE DELETE` trigger always raises. No `DELETE` grant and no `DELETE` policy.
5. Policies: `SELECT`, `INSERT`, and `UPDATE` for `authenticated` only when `is_admin()` is true. `UPDATE` includes both `USING` and `WITH CHECK`.
6. Grants: `SELECT`, `INSERT`, `UPDATE` on `public.clubs` to `authenticated`. Revoke those privileges from `anon` and `PUBLIC`.
7. `public.clubs_for_new_use` with `security_invoker = true`, selecting `id, name, location` where `is_active`. `SELECT` granted to `authenticated` only. Callers still only see rows RLS allows, so non-admins get nothing.
8. `private.club_is_selectable_for_new_use(uuid)` returns boolean, `SECURITY DEFINER`, empty `search_path`, true only when that id exists and `is_active` is true. `EXECUTE` granted to `authenticated` only. No row data leaves the function.

Do not add foreign keys to other tables. Do not seed the footer address as a club. Do not enable Realtime.

### 2. Client service

`src/lib/clubs.js` uses the existing Supabase client:

- list every club for the admin catalogue (`id, name, location, phone, email, is_active, updated_at`), ordered by name
- list selectable clubs from `clubs_for_new_use` for the “new use” set
- insert and update an explicit column allow-list (`name`, `location`, `phone`, `email`, and `is_active` only on status changes)
- no delete function

Map database failures to short operator messages: name required, duplicate name, not allowed. Do not surface raw database text.

### 3. Admin screen

Add a **Clubs** tab beside the existing dashboard tabs. The panel lists name, place, and status, and edits the same club in place. Actions are save and activate/deactivate. There is no delete control. Inactive clubs stay in the list and can be corrected without reactivation. Show an empty state when the catalogue is empty.

`ProtectedRoute requireAdmin` stays the page guard. The database remains the authority for direct requests.

### 4. What this feature does not change

- `profiles` has no home club. Coach assignment stays on bookings.
- `bookings`, `lessons`, and `camps` gain no `club_id`.
- Group and session tables are not created. Their future shape is specified in [data-model.md](data-model.md) so the next feature does not invent a venue table.
- Footer, contact, and terms keep the hardcoded Villmergen address.

## RLS / trigger verification checklist

Author every assertion below in `tests/sql/0024_f107_club_management.test.sql` during implementation. Do not apply `supabase/migrations/0024_f107_club_management.sql` or execute that SQL file against the live project unless the user explicitly asks. The implementation gate remains `npm run lint`, `npm test`, and `npm run build`. When the user does ask, apply the migration, run the SQL file, then deactivate or clearly name any test clubs. The single live project is production.

- [ ] `public.clubs` exists, RLS enabled, `is_active` defaults to true, name is required
- [ ] Unique index is on `lower(name)`
- [ ] `anon` has no table, view, or function privileges
- [ ] `authenticated` has `SELECT`/`INSERT`/`UPDATE` and not `DELETE`
- [ ] No `DELETE` policy exists; `BEFORE DELETE` raises
- [ ] Active admin can insert, update, deactivate, and reactivate
- [ ] Student, coach, accounting, inactive admin, and anonymous insert/update/select return no change and no catalogue rows
- [ ] Blank and whitespace-only names are rejected
- [ ] `Club Norte` and `club norte` cannot both exist
- [ ] Optional location, phone, and email may be null
- [ ] Changing `id` is rejected
- [ ] Deactivate then reactivate keeps the same `id`
- [ ] `clubs_for_new_use` is security invoker, returns only active clubs, and is empty for a non-admin
- [ ] `private.club_is_selectable_for_new_use` is false for inactive and unknown ids, true for an active id, and is not executable by `anon`
- [ ] A test-only child row referencing `clubs(id) ON DELETE RESTRICT` still points at the club after deactivation, and deleting the club fails
- [ ] `profiles`, `bookings`, `lessons`, and `camps` have no new club column
- [ ] Public footer, contact, and terms text are unchanged

## Complexity Tracking

No constitution violations. Complexity tracking is empty.
