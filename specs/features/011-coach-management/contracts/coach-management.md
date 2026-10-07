# Contract: Coach Management (F1.06)

**Feature**: [spec.md](../spec.md)
**Data model**: [data-model.md](../data-model.md)
**Date**: 2026-10-07

Delta on the F1.04 profile contract ([009 authorization](../../009-client-management/contracts/authorization.md)) and the F1.02 assignment/roster behavior. No new HTTP API and no Edge Function. Callers use the Supabase Data API. Triggers and existing RLS decide the outcome.

## 1. Actors

| Actor | Identity |
|---|---|
| Active admin | `profiles.role = admin` and `is_active = true` |
| Active Coach | `profiles.role = coach` and `is_active = true` |
| Inactive Coach | `profiles.role = coach` and `is_active = false` |
| Student / other | any non-admin profile |
| Anonymous | no user |

Role and status come from `profiles`, not from Auth metadata.

## 2. List Coaches

```text
GET /rest/v1/profiles
  ?role=eq.coach
  &select=id,first_name,last_name,full_name,email,phone,date_of_birth,address,postal_code,city,country,country_code,role,is_active,updated_at
  &order=full_name.asc,id.asc
```

Optional `is_active` and name/email filters narrow the same rows.

| Caller | Result |
|---|---|
| Active admin | Coach profiles, including inactive Coaches |
| Coach, student, accounting, inactive admin | At most their own row, and only if that row is a Coach |
| Anonymous | No rows |

## 3. Promote an existing person

```text
PATCH /rest/v1/profiles?id=eq.{target_id}
{ "role": "coach" }
```

| Condition | Outcome |
|---|---|
| Active admin, target is another existing profile, last-admin rule holds | `role` becomes `coach`. Same profile id |
| Active admin targets self | Denied; role unchanged |
| Change would leave zero active admins | Denied; role unchanged |
| Target role `accounting`, or any non-admin caller | Denied; role unchanged |
| No profile for `target_id` | No row updated |

This does not create a login.

## 4. Update a Coach profile and status

Personal-field and `is_active` updates use the F1.04 admin and owner contracts unchanged.

| Condition | Outcome |
|---|---|
| Active admin updates another Coach’s permitted personal fields or `is_active` | Saved. Bookings are not modified |
| Active Coach updates own client-controlled fields | Saved |
| Active Coach sets own `role` or `is_active` | Denied |
| Inactive Coach updates own profile | Denied. Own row remains readable |
| Coach updates another profile | Denied |

## 5. Assign a Coach to a session occurrence

```text
PATCH /rest/v1/bookings?id=eq.{booking_id}
{ "coach_id": "{coach_id}" | null }
```

| Condition | Outcome |
|---|---|
| Active admin, new id is an active Coach | `coach_id` updated |
| Active admin, new id is an inactive Coach | Denied. Error contains `coach_id must reference an active coach`. Previous `coach_id` kept |
| Active admin, new id is not a Coach | Denied. Existing non-coach error. Previous `coach_id` kept |
| Active admin sets null | Assignment cleared. Booking remains |
| Active admin updates other booking columns and sends the same `coach_id`, including an inactive Coach | Allowed. `coach_id` unchanged |
| Non-admin changes `coach_id` | Denied. Existing admin-only error |
| Deactivate the Coach via section 4 | `bookings.coach_id` values that already point at them stay |

## 6. Coach session and participant read

```text
GET /rest/v1/session_roster?coach_id=eq.{auth.uid}
```

| Caller | Result |
|---|---|
| Active Coach | Occurrences assigned to them, with participant identity and phone only |
| Inactive Coach | No rows |
| Active Coach requests an occurrence not assigned to them | No row |
| Active admin | Operational roster rows they are already allowed to read |

No price, payment, email, address, role, or status columns.

## 7. Screens

| Screen | Who | Behavior |
|---|---|---|
| Admin dashboard, Coaches tab | Active admin | List, edit, activate/deactivate, promote existing person |
| Admin dashboard, Coach assignment | Active admin | Choose an active Coach; current inactive assignee stays visible |
| Own profile | Active or inactive Coach | F1.04 own-profile rules |
| Coach roster | Active Coach | Assigned occurrences only |
| Admin dashboard | Non-admin | Denied by the existing admin route guard |
