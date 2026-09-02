# Contracts: Authorization (F1.02)

**Feature**: `specs/features/008-roles-and-permissions/spec.md`  
**Date**: 2026-08-24  
**Related**: [data-model.md](../data-model.md) · reverse spec `006` · `specs/project-context/api-contracts.md`

No new Edge Functions. Authorization is PostgREST + RLS + Storage policies + existing EF role checks.

---

## 1. Live product roles

| Role | Source | Live after F1.02 |
|---|---|---|
| `student` | `profiles.role` default | Own resources only (leaks closed) |
| `admin` | `profiles.role` | Unrestricted operational academy data; existing admin-only EFs stay admin-only |
| `coach` | `profiles.role` | Assigned-occurrence roster only |
| `accounting` | CHECK value | Unused; same as non-admin authenticated (no roster, no admin tools) |

Canonical store: `profiles.role`. Not JWT claims. Not a roles table.

---

## 2. Postgres / PostgREST

Schema `public`. Client: `supabase.from(<table|view>)`.

### 2.1 `profiles`

| Policy / object | Command | Role | Expression / rule |
|---|---|---|---|
| ~~Public profiles are viewable by everyone~~ | SELECT | public | **DROP** |
| Users can read own profile role | SELECT | authenticated | `id = (SELECT auth.uid()) OR is_admin()` — **keep** |
| Users can insert their own profile | INSERT | public | **unchanged** |
| Users can update own profile | UPDATE | public | `auth.uid() = id` — **keep** (SPA does not send `role`) |
| `prevent_role_self_service` | BEFORE UPDATE | — | If `NEW.role IS DISTINCT FROM OLD.role` and `auth.role()` ∈ (`authenticated`, `anon`) → raise. Service role / SQL without JWT still allowed. |

Expected client outcomes:

| Caller | `GET /rest/v1/profiles?id=eq.<other>` | Result |
|---|---|---|
| Anon | any row | empty / RLS deny |
| Student A | student B | empty |
| Student A | self | 200 |
| Admin | any | 200 |
| Coach | other profiles | empty (names only via `session_roster`) |

| Caller | `PATCH /rest/v1/profiles { "role": "admin" }` on self | Result |
|---|---|---|
| Student / Coach | — | error (trigger); row unchanged |
| Admin | own row | same trigger — **self-service role change refused for everyone via PostgREST**, including admin UI. Out-of-band SQL only (FR-003). |

### 2.2 `bookings`

Existing owner/admin SELECT/INSERT/UPDATE **keep**. No coach SELECT on this table.

| Addition | Rule |
|---|---|
| Column `coach_id` | nullable FK → `profiles.id` ON DELETE SET NULL |
| `prevent_non_admin_coach_assignment` | BEFORE UPDATE: `coach_id` change requires `is_admin()`; non-null target must have `role = 'coach'` |
| Admin UPDATE | Existing `Admins can update any booking` is how assignment is written |

| Caller | Change `coach_id` | Result |
|---|---|---|
| Student (own row) | any | trigger reject |
| Coach | any | trigger reject (not admin) |
| Admin | set/clear valid coach | 200 |
| Admin | set a student id | trigger reject |

Owner UPDATE of `verification_status` / `proof_uploaded_at` (proof upload) still succeeds when `coach_id` is unchanged.

### 2.3 `session_roster` (view)

`GET /rest/v1/session_roster`

```json
{
  "booking_id": "uuid",
  "booking_date": "YYYY-MM-DD | null",
  "start_time": "HH:MM:SS | null",
  "end_time": "HH:MM:SS | null",
  "lesson_name": "string",
  "participant_full_name": "string",
  "coach_id": "uuid | null"
}
```

| Caller | Rows returned |
|---|---|
| Anon | none (no GRANT) |
| Student | none |
| Coach | assigned occurrences only |
| Admin | all occurrences (operational projection) |
| `accounting` | none |

Must **not** include price, payment, email, phone, proof, invoice, or verification fields.

### 2.4 `payment_proofs` (table)

**Unchanged.** Owner INSERT WITH CHECK (live); owner-or-admin SELECT; admin UPDATE.

Coaches get no extra policy. A coach who also owns a booking still sees **their** proofs via existing owner SELECT.

### 2.5 `booking_slots` / `lessons`

**Unchanged.** Anonymous occupancy remains non-identifying (SC-006).

### 2.6 Helpers

PostgREST may expose `is_admin` / `is_coach` as RPCs if GRANT EXECUTE is to `authenticated`. That is acceptable: they return a boolean about the caller only. Do not GRANT to `anon`.

---

## 3. Storage — bucket `payment-proofs`

Object key contract (existing): `{booking_id}/attempt-{n}.{ext}` and legacy `{booking_id}/{booking_id}_{unix_ms}.{ext}`. Ownership is the **first path segment** equal to `bookings.id`. Compare with a consistent cast, e.g. `(storage.foldername(name))[1]::uuid = bookings.id` (or `::text` on both sides). **Both** live key shapes MUST satisfy WITH CHECK.

At apply time, list `storage.objects` policies for this bucket and **drop** overly broad ones (observed live shape: authenticated SELECT on the whole bucket; INSERT without path check; ALL on `public`). Replace with:

| Command | TO | USING / WITH CHECK |
|---|---|---|
| SELECT | authenticated | `bucket_id = 'payment-proofs'` AND (object’s booking is owned by `auth.uid()` OR `is_admin()`) — first path segment = `bookings.id` as above |
| INSERT | authenticated | same ownership check on the destination key (admin may insert; not required for v1) |
| UPDATE / DELETE | authenticated | admin only **or** omit (students do not replace files; `upsert: false`) |

`service_role` bypasses RLS; do **not** add ALL policies on the `public` role.

Signed URL (`createSignedUrl`) succeeds only if SELECT is allowed — student A cannot mint a URL for B’s object (SC-001).

`invoices` / `qr-codes` buckets are out of scope.

---

## 4. Edge Functions (existing — no new slugs)

Do **not** add coach as an admin equivalent.

| Function | After F1.02 |
|---|---|
| `generate-invoice-pdf` | Owner or `profiles.role = 'admin'` — **unchanged**. Coach who does not own the booking → 403. |
| `notify-payment-verification` | Admin only — **unchanged**. Coach → 403 (SC-004). |
| `007` billing functions | Stay admin-only / owner-or-admin as specified there. This feature does not grant coaches billing access. |

Dashboard-only functions not in this repo stay untouched.

---

## 5. SPA routes (UX only — not a security boundary)

`ProtectedRoute` remains documented as non-authoritative.

| Path | Guard | Who renders |
|---|---|---|
| `/profile`, `/payments` | authenticated | unchanged |
| `/admin` | redirect | `/admin/integrations` (007) |
| `/admin/payment-verification` | legacy redirect | `/admin/integrations`; its guard then redirects Coach to `/` |
| `/admin/integrations` | `requireAdmin` | Admin only (coach → `/`) |
| `/coach/roster` | `allowedRoles={['coach']}` | Coach; Admin also passes (existing bypass) |

Header: add a roster entry when `role === 'coach'` (Admin may use the admin assignment tab; optional extra roster link is fine because of the admin bypass).

Admin Dashboard: new tab **Coach assignment** beside 007's **Bexio integration** UI (list bookings, set/clear `coach_id` from `profiles` where `role = 'coach'`). Payment-proof UI remains discarded. This is not a scheduler.

---

## 6. Client libraries (new)

| Module | PostgREST |
|---|---|
| `src/lib/sessionRoster.js` | `from('session_roster').select(...)` |
| `src/lib/coachAssignments.js` | Admin: `from('bookings').update({ coach_id })`; list coaches `from('profiles').select('id, full_name').eq('role', 'coach')` |

No new HTTP API, no new npm packages.

---

## 7. Error shapes

| Failure | Expected |
|---|---|
| RLS deny (SELECT) | empty array / `PGRST116` on `.single()`, not a row |
| Trigger reject (role / `coach_id`) | PostgREST 4xx with a stable SQLERRM the UI can toast |
| Storage INSERT/SELECT deny | Storage API error; upload/preview fails |
| EF forbidden | existing 403 JSON |

Do not return other students’ identifiers in error messages.
