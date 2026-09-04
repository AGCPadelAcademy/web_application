# Contract: Client Management Authorization (F1.04)

**Feature**: [spec.md](../spec.md)
**Data model**: [data-model.md](../data-model.md)
**Date**: 2026-09-04

This contract defines browser-visible data operations and their server-enforced outcomes. The application uses the existing Supabase Data API, RLS, triggers, and fixed-output projections. No new custom HTTP API is introduced.

## 1. Actors

| Actor | Server identity |
|---|---|
| Anonymous | no authenticated user |
| Active student | own `profiles` row has `role=student`, `is_active=true` |
| Inactive client | own `profiles.is_active=false`, any stored role |
| Active coach | own row has `role=coach`, `is_active=true` |
| Active admin | own row has `role=admin`, `is_active=true` |
| Accounting | stored `role=accounting`; no added privileges |

Role/status are read from `profiles`; Auth user metadata is never authorization input.

## 2. Profile read

### Own profile

```text
GET /rest/v1/profiles?id=eq.{auth.uid}
```

| Caller | Result |
|---|---|
| Active or inactive owner | One own row |
| Anonymous | No row |

### Admin directory/detail

```text
GET /rest/v1/profiles
  ?select=id,first_name,last_name,full_name,email,phone,date_of_birth,address,postal_code,city,country,country_code,role,is_active,updated_at
  &order=full_name.asc,id.asc
  &offset={n}
  &limit={page_size}
```

| Caller | Result |
|---|---|
| Active admin | Authorized profile page |
| Student, coach, accounting, inactive admin | Own row only if query includes own id; no directory |
| Anonymous | No rows |

Search/filter parameters may narrow authorized rows but never grant rows.

## 3. Profile update

### Owner update

```text
PATCH /rest/v1/profiles?id=eq.{auth.uid}
```

Allowed payload keys:

```text
first_name, last_name, full_name, phone, address,
postal_code, city, country, country_code, date_of_birth, updated_at
```

| Condition | Outcome |
|---|---|
| Active owner; only allowed keys; valid DOB | Updated row |
| Inactive owner | Denied; row unchanged |
| Any owner changes `email`, `role`, `is_active`, `id`, or unknown field | Denied; row unchanged |
| Owner targets another id | Zero rows / denied |
| DOB is in future | Validation error; row unchanged |

### Admin update

```text
PATCH /rest/v1/profiles?id=eq.{target_id}
```

| Change | Outcome |
|---|---|
| Active admin edits target personal fields | Success |
| Active admin changes another target’s role | Success if role is allowed and last-admin invariant holds |
| Active admin changes target status | Success if last-admin invariant holds |
| Active admin changes own role | Denied |
| Any app caller changes profile email | Denied |
| Change would leave zero active admins | Denied |
| Inactive/non-admin caller uses same request | Denied |

The UI SHOULD submit personal fields separately from role/status so errors identify the failed operation, but the database remains authoritative for every payload combination.

## 4. Booking mutation

### Create

```text
POST /rest/v1/bookings
```

| Caller | Outcome |
|---|---|
| Active owner with `user_id=auth.uid()` | Existing booking rules apply |
| Inactive owner | Denied |
| Caller uses another `user_id` | Denied |
| Active admin | Existing admin behavior; no new create-on-behalf requirement |

### Update/cancel

```text
PATCH /rest/v1/bookings?id=eq.{booking_id}
```

| Caller | Outcome |
|---|---|
| Active owner of booking | Existing allowed owner mutations |
| Inactive owner | Denied (history is read-only) |
| Active admin | Existing admin update permission |
| Coach/accounting/non-owner | Denied |

SELECT ownership remains independent of activity so inactive owners can read history.

## 5. Coach assigned-participant projection

```text
GET /rest/v1/session_roster
  ?select=booking_id,booking_date,start_time,end_time,lesson_name,participant_id,participant_full_name,participant_phone,coach_id
```

| Caller | Rows |
|---|---|
| Active coach | Only rows where `coach_id=auth.uid()` |
| Active admin | All roster rows |
| Student, accounting, inactive coach | Zero rows |
| Anonymous | Access denied |

Never returned:

```text
participant email, address, date_of_birth, role, status,
booking price/payment/proof data
```

Assignment removal or coach deactivation affects the next request.

## 6. Auth context contract

`useAuth()` continues to expose `user`, `session`, `profile`, `role`, and `loading`; F1.04 adds current activity state (for example `isActive`).

Rules:

- Missing-profile session bootstrap inserts one profile.
- Session restore does not overwrite an existing application profile from Auth metadata.
- Client routing remains role-based UX only; RLS/triggers remain the security boundary.
- Stale browser status may show an action briefly, but the server refuses it immediately.

## 7. Edge Function authorization

Service-role functions bypass RLS and must apply activity checks explicitly.

| Function category | Inactive owner | Inactive admin |
|---|---|---|
| Retrieve existing invoice document | Allowed for owner | No admin-wide access; own-owner rules only |
| Issue/re-issue invoice (mutation) | Denied | Denied |
| Cancel invoice/booking (mutation) | Denied | Denied |
| Reconcile / integration administration | Not applicable | Denied |

Existing active owners/admins retain current ownership/role checks.

The deployed legacy invoice generator must be inspected during implementation because its source is not currently versioned. It must not permit an inactive owner to create a missing financial document.

## 8. Error semantics

User-facing services map server failures to stable messages:

| Condition | User-facing meaning |
|---|---|
| inactive profile mutation | “This client profile is inactive. Contact the academy.” |
| protected field | “You are not allowed to change this field.” |
| admin self-role | “You cannot change your own role.” |
| last active admin | “At least one active administrator is required.” |
| future DOB | “Date of birth cannot be in the future.” |
| unauthorized row | Generic permission/not-found response; do not reveal another client exists |

Raw database details and PII are not logged or shown.

## 9. Security invariants

1. Direct identifier manipulation never expands row access.
2. Client-controlled column allow-list is enforced after RLS.
3. All privileged role checks require an active profile.
4. Coach phone is available only through the assignment projection.
5. At least one active admin remains under concurrent app requests.
6. No Data API role can delete client history through F1.04.
