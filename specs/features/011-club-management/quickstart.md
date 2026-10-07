# Quickstart: Validate Club Management (F1.07)

**Feature**: [spec.md](spec.md)
**Contract**: [contracts/clubs.md](contracts/clubs.md)
**Data model**: [data-model.md](data-model.md)

The automated gate is lint, unit tests, and the production build. Sections 4–7 below remain manual checks for a person in the live app. There is one Supabase project. `supabase/migrations/0024_f107_club_management.sql` and `tests/sql/0024_f107_club_management.test.sql` stay unapplied until you explicitly ask to apply them. Name any club created for a check so it is obviously test data, then deactivate it.

## 1. Prerequisites

- Node.js `>=20.19`
- Dependencies installed with `npm ci`
- Migration `0024_f107_club_management.sql` applied (or the renumbered file if remote history moved)
- An active admin, an active student, an active coach, and an accounting user who can sign in
- No Edge Function deploy for this feature

Do not store access tokens in git.

## 2. Automated quality gate

```bash
npm run lint
npm test
VITE_SUPABASE_URL=https://placeholder.supabase.co \
VITE_SUPABASE_ANON_KEY=placeholder-anon-key \
npm run build
```

Expected:

- lint exits 0
- Vitest passes, including `src/lib/clubs.test.js`
- production build exits 0

## 3. Database assertions

Run `tests/sql/0024_f107_club_management.test.sql` against the project after the migration.

Expected static checks:

- `public.clubs` exists, RLS is on, and `is_active` defaults to true
- unique index is on `lower(name)`
- `anon` cannot use the table, the view, or the private function
- `authenticated` can select, insert, and update `clubs`, and cannot delete
- a delete trigger is present and there is no delete policy
- `clubs_for_new_use` is security invoker and filters to active clubs
- `private.club_is_selectable_for_new_use(uuid)` exists and is not executable by `anon`
- `profiles`, `bookings`, `lessons`, and `camps` have no new club column

The same script may create a temporary child table with a foreign key to `clubs` `ON DELETE RESTRICT`, deactivate the club, confirm the child still points at that id, attempt a delete, confirm it fails, then drop the temporary table. That child table must not remain.

## 4. Admin creates and edits a club

| Step | Action | Expected |
|---|---|---|
| 4.1 | Admin opens `/admin/integrations` and the Clubs tab | Catalogue loads. Empty state if none exist. |
| 4.2 | Create a club with a name and no address or contact | Club appears as active. |
| 4.3 | Add a place, phone, and email on that same club | Same club shows the new details. |
| 4.4 | Save a blank name | Save is refused. Previous name remains. |
| 4.5 | Create another club whose name differs only by case or surrounding spaces | Save is refused. One club of that name exists. |
| 4.6 | With 20 or more clubs, find one by name | Name and active/inactive status are visible within 30 seconds. |

## 5. Non-admins cannot manage clubs

| Step | Action | Expected |
|---|---|---|
| 5.1 | Student or coach opens `/admin/integrations` | Admin screen is refused. |
| 5.2 | Student, coach, accounting user, or signed-out caller requests `clubs` or `clubs_for_new_use` directly | No rows, and create/update is refused. |
| 5.3 | Those callers send `is_active=false` for an existing club id | Status unchanged. |

## 6. Deactivate and reactivate

| Step | Action | Expected |
|---|---|---|
| 6.1 | Admin deactivates the test club | It stays in the catalogue as inactive and is absent from clubs offered for new use. |
| 6.2 | Admin corrects the inactive club’s place | Same club, still inactive, new place saved. |
| 6.3 | Admin deactivates it again | Still inactive. No second row. |
| 6.4 | Admin looks for delete | No delete control. A direct delete does not remove the row. |
| 6.5 | Admin reactivates it | Same club is active and offered for new use again. |

## 7. Surrounding behavior still works

| Step | Action | Expected |
|---|---|---|
| 7.1 | Open the public footer, contact page, and terms | The Villmergen address is unchanged. |
| 7.2 | Open client management and a client profile | No home-club field. |
| 7.3 | Open camps and the coach roster | Unchanged. No club picker was added. |
| 7.4 | Create a lesson booking as a student | Booking still succeeds with no club selected. |

## 8. Not in this check

Group management, session scheduling, prices, and billing are out of scope. There is no group or session screen to open. The contract those features must follow is [data-model.md](data-model.md) section 6.
