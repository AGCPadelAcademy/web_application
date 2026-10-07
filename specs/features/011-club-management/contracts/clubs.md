# Contract: Club Catalogue (F1.07)

**Feature**: [spec.md](../spec.md)
**Data model**: [data-model.md](../data-model.md)
**Date**: 2026-10-07

The admin screen uses the existing Supabase Data API. RLS and triggers decide the outcome. No new Edge Function or custom HTTP API is added. Paths below are the PostgREST shape the client already uses.

## 1. Actors

| Actor | Server identity |
|---|---|
| Anonymous | no authenticated user |
| Active student | own profile `role=student`, `is_active=true` |
| Active coach | own profile `role=coach`, `is_active=true` |
| Accounting | stored `role=accounting`; no club privileges |
| Inactive admin | own profile `role=admin`, `is_active=false` |
| Active admin | own profile `role=admin`, `is_active=true` (`public.is_admin()`) |

Role and status come from `profiles`. Auth user metadata is never authorization input.

## 2. List the catalogue

```text
GET /rest/v1/clubs
  ?select=id,name,location,phone,email,is_active,updated_at
  &order=name.asc,id.asc
```

| Caller | Result |
|---|---|
| Active admin | Every club, active and inactive |
| Student, coach, accounting, inactive admin | No rows |
| Anonymous | No rows; request is not authorized |

The response includes inactive clubs so an admin can correct them and see status. There is no delete operation in the client.

## 3. List clubs offered for new use

```text
GET /rest/v1/clubs_for_new_use
  ?select=id,name,location
  &order=name.asc,id.asc
```

| Caller | Result |
|---|---|
| Active admin | Active clubs only |
| Any other caller | No rows |

This is the only set a later screen may offer when choosing a club for a new group, session, or booking. Inactive clubs are absent. The view does not grant access beyond RLS on `clubs`.

## 4. Create

```text
POST /rest/v1/clubs
```

Allowed body fields: `name`, `location`, `phone`, `email`. The client must not send `id`, `is_active`, `created_at`, or `updated_at`. A new row is active.

| Caller | Result |
|---|---|
| Active admin, valid unique name | `201` with the stored row. Optional fields may be omitted or blank; blanks are stored as null. |
| Active admin, blank name | Rejected. Operator message: name is required. Row is not created. |
| Active admin, name matching an existing club except for case or surrounding spaces | Rejected. Operator message: a club with this name already exists. Both rows stay unchanged. |
| Any non-admin, including a direct request | Rejected. No row is created. |

## 5. Update details

```text
PATCH /rest/v1/clubs?id=eq.{club_id}
```

Allowed body fields: `name`, `location`, `phone`, `email`.

| Caller | Result |
|---|---|
| Active admin, same club id, valid name | Stored on that id. `updated_at` changes. `id` and `created_at` stay the same. Status stays as it was, including when the club is inactive. |
| Active admin, blank name | Rejected. Previous name remains. |
| Active admin, duplicate name | Rejected. Neither club changes. |
| Active admin, attempt to change `id` | Rejected. |
| Any non-admin | Rejected. Row unchanged. |

## 6. Activate or deactivate

```text
PATCH /rest/v1/clubs?id=eq.{club_id}
```

Body: `{ "is_active": false }` or `{ "is_active": true }`.

| Caller | Result |
|---|---|
| Active admin deactivates an active club | Same id, `is_active=false`. The row remains. It disappears from `clubs_for_new_use`. |
| Active admin reactivates an inactive club | Same id, `is_active=true`. It appears again in `clubs_for_new_use`. |
| Active admin sets the status the club already has | Same row, success. |
| Any non-admin | Rejected. Status unchanged. |

Deactivation does not delete or rewrite any other table. No other table references `clubs` yet.

## 7. Delete

```text
DELETE /rest/v1/clubs?id=eq.{club_id}
```

| Caller | Result |
|---|---|
| Every role, including the service role | Rejected by the delete trigger. The row remains. |

The admin screen has no delete control. `src/lib/clubs.js` does not expose a delete function.

## 8. Active-club predicate

```text
POST /rest/v1/rpc/club_is_selectable_for_new_use
```

This RPC is not created in `public`. The function is `private.club_is_selectable_for_new_use(uuid)`. Future SQL writers call it. It is not a catalogue. It returns true only for an existing active club id, and false otherwise.

Browser code for this feature uses section 3, not this function, to show the choice list.

## 9. Unchanged surfaces

- `GET/PATCH /rest/v1/profiles` gains no club field.
- `GET/POST /rest/v1/bookings` gains no club field.
- Camp admin and public camp reads are unchanged.
- The public contact address is not read from `clubs`.
