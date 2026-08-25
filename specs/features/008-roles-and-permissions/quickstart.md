# Quickstart: Validating Roles and Permissions (F1.02)

**Feature**: `specs/features/008-roles-and-permissions/spec.md` | **Date**: 2026-08-24  
**Artifacts**: [research.md](research.md) · [data-model.md](data-model.md) · [contracts/authorization.md](contracts/authorization.md)

This guide proves the F1.02 **delta** end-to-end. Student booking, admin payment verification, and anonymous occupancy (`006` / `001`–`005`) must still work; this file only adds the isolation and coach-assignment checks.

Use a **Supabase test branch or project** (constitution: no shared production DB). Do not run destructive checks against production.

---

## 0. Prerequisites

1. Migration `0008_f102_roles_and_permissions.sql` applied — see data-model.md §Migration plan (bump the number only if the test project already has `0008`).
2. App running (`npm run dev`) against that project (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
3. Auth users with profiles:
   - **Student A**, **Student B** (`role = student`)
   - **Coach C** (`role = coach` set **out-of-band** in SQL, same pattern as Admin today)
   - **Admin** (existing admin profile)
   - **Accounting D** (`role = accounting` set out-of-band; deny checks only — FR-002)
4. Two bookings: occurrence **A** owned by Student A, occurrence **B** owned by Student B. Admin assigns Coach C to **A** only.

---

## 1. Student isolation (US1, SC-001, SC-002)

| Step | Action | Expected |
|---|---|---|
| 1.1 | As A, open `/profile` and `/payments`, complete own flows | Same as today (`006`) |
| 1.2 | As A, PostgREST `GET profiles?id=eq.<B>` (REST client or SQL as A’s JWT) | No row |
| 1.3 | As anon, `GET profiles` | No PII rows |
| 1.4 | As A, `GET bookings?id=eq.<B>` | No row |
| 1.5 | As A, `storage.from('payment-proofs').createSignedUrl` for B’s object key | Fail |
| 1.6 | As A, `PATCH profiles` `{ "role": "admin" }` on self | Rejected; `role` still `student` |
| 1.7 | As anon, `/lessons` grid | Occupancy via `booking_slots` only; no names (SC-006) |
| 1.8 | As A, `PATCH`/`UPDATE` B’s `profiles`, `bookings`, or `payment_proofs` | Denied; B unchanged |
| 1.9 | As D (`accounting`), `GET session_roster`; open `/admin/payment-verification`; `PATCH` own `role` | Empty roster; redirect `/`; role unchanged |

---

## 2. Coach roster (US2, SC-003)

| Step | Action | Expected |
|---|---|---|
| 2.1 | As C, sign in with the normal login | Same Auth/profile as any user (FR-006) |
| 2.2 | Open `/coach/roster` | Lists Student A / lesson / date / time for occurrence A; **not** B |
| 2.3 | As C, `GET /rest/v1/session_roster` | Same set; no price/payment/email columns |
| 2.4 | As C, `GET bookings?id=eq.<B>` | No row |
| 2.5 | Admin sets `coach_id` NULL on A | C’s roster no longer includes A |
| 2.6 | Coach with zero assignments | Empty roster |

---

## 3. Coach cannot use admin/finance (SC-004)

| Step | Action | Expected |
|---|---|---|
| 3.1 | As C, open `/admin/payment-verification` | Redirect `/` |
| 3.2 | As C, invoke `notify-payment-verification` | 403 |
| 3.3 | As C, `generate-invoice-pdf` for B’s booking | 403 |
| 3.4 | As C, signed URL for A’s or B’s payment-proof file (unless C personally owns that booking) | Fail |

If `007` billing routes exist in the deployed app: C must not connect Bexio or read another student’s invoice PDF.

---

## 4. Admin still unrestricted operationally (SC-005)

| Step | Action | Expected |
|---|---|---|
| 4.1 | Admin payment verification on A or B | Approve/reject still works |
| 4.2 | Admin assignment tab: assign C to A, clear, assign again | Roster for C follows |
| 4.3 | Admin `GET session_roster` | Sees operational rows (not blocked by assignment) |
| 4.4 | Admin `GET profiles` for A and C | Succeeds |

---

## 5. Regression: existing journeys

| Step | Action | Expected |
|---|---|---|
| 5.1 | Student A books a lesson | `001` path unchanged |
| 5.2 | Student A uploads a proof to `{bookingId}/attempt-n.ext` | Upload + `payment_proofs` insert succeed |
| 5.3 | Admin verifies that proof | `004` path unchanged |

---

## 6. Automated checks (after implementation)

```bash
npm run lint
npm test
npm run build
```

Vitest covers new `src/lib/sessionRoster.js` / `src/lib/coachAssignments.js` with a mocked Supabase client. RLS/storage/trigger proofs are this checklist plus `tests/sql/0008_f102_roles_and_permissions.test.sql` (constitution), run with the JWTs above — not against production.
