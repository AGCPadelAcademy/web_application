# Baseline System — Supabase Backend

> Snapshot captured: 2026-06-28 via Supabase MCP.
> Refreshed 2026-08-06: `profiles.role` column added (was missing from the original snapshot); `users` table deleted; NOT NULL constraints tightened (migration `0002`); `lessons.stripe_price_id` column dropped; `bookings.lesson_id` renamed to `lesson_code` with FK to `lessons.lesson_code` (migration `0003`); 135 old/null-dated bookings deleted (29 remain); `notifications_log` FK changed from ON DELETE SET NULL to ON DELETE CASCADE.
> Refreshed 2026-08-07: Stripe artifacts removed (migration `0004`: `bookings.stripe_session_id` column dropped, Stripe-named `profiles` policies dropped); atomic invoice numbering added (migration `0005`: `invoice_counters` table + `next_invoice_number()` RPC); `generate-invoice-pdf` v18 and `notify-payment-verification` v2 deployed; §3/§4/§5 reconciled with the live project (13 Edge Functions, 3 pending manual deletion; `receipts` bucket pending deletion; live RLS policies; `bookings_old` no longer present in the live schema). Live row counts updated.
> Refreshed 2026-08-10: five unused/legacy Edge Functions (`create-booking`, `handle-stripe-webhook`, `verify-booking-saved`, `generate-booking-receipt`, `assign-booking-time`) and the `receipts` bucket deleted by the owner. 8 functions remain.
> Refreshed 2026-08-10 (PM): RLS hardening (migration `0006`) — `booking_slots` non-PII view created; `bookings` public-read policy replaced by owner/admin SELECT policies. Edge Function auth hardened — `generate-invoice-pdf` v21 and `notify-payment-verification` v5 run with `verify_jwt: true` + in-function JWT/authorization checks.
> Refreshed 2026-08-19: live Edge Function versions are `generate-invoice-pdf` **v22** and `notify-payment-verification` **v6** (explicit JWT); payment-proof storage path is `{booking_id}/attempt-{n}.{ext}`.
> Refreshed 2026-08-25: F1.02 (`0008_f102_roles_and_permissions`) — `bookings.coach_id`, `is_coach()`, role/assignment triggers, `session_roster` view, dropped public `profiles` SELECT, owner-path `payment-proofs` storage policies. **Apply `0008` on the target project** for the remote schema to match this snapshot.
> Project ref: `jokjxpogvwxbwdaroqkc`
> Project URL: `https://jokjxpogvwxbwdaroqkc.supabase.co`
> Methodology: SDD brownfield baseline — document as-is, flag issues, do not modify.

---

## 1. Connection & Keys

| Key | Type | Status |
|---|---|---|
| `anon` (legacy JWT) | Legacy | Active |
| `sb_publishable_iXKO_...` | Publishable (recommended) | Active |

> The frontend currently uses the **legacy anon JWT** via `src/lib/customSupabaseClient.js`. Migrating to the publishable key is a low-priority hardening task — it provides independent rotation without re-rolling the entire JWT secret.

---

## 2. Database Schema

### Installed Extensions (active only)

| Extension | Schema | Version |
|---|---|---|
| `plpgsql` | `pg_catalog` | 1.0 |
| `pg_stat_statements` | `extensions` | 1.11 |
| `uuid-ossp` | `extensions` | 1.1 |
| `pgcrypto` | `extensions` | 1.3 |
| `supabase_vault` | `vault` | 0.3.1 |

All other extensions (PostGIS, vector, pg_cron, pg_net, etc.) are available but **not installed**.

---

### Tables — `public` schema

#### `profiles` (45 rows) — RLS enabled
Primary user profile. Linked 1:1 to `auth.users`. Holds the canonical `role` field.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | FK → `auth.users.id` |
| `full_name` | `text` NOT NULL | |
| `email` | `text` | nullable (27 incomplete profiles) |
| `phone` | `text` | nullable (20 incomplete profiles) |
| `address` | `text` | nullable (26 incomplete profiles) |
| `postal_code` | `text` | nullable (26 incomplete profiles) |
| `city` | `text` | nullable (26 incomplete profiles) |
| `country` | `text` | nullable (26 incomplete profiles) |
| `role` | `text` NOT NULL | default `'student'`, CHECK constraint: `student`, `coach`, `accounting`, `admin`. Current values: `student` (43), `admin` (1). |
| `updated_at` | `timestamptz` NOT NULL | default `now()` |

Referenced by: `bookings`, `availability`, `memberships`, `credits`.

> **Profile completion:** contact/address fields remain nullable because 20–27 existing profiles are incomplete (users who never finished profile completion). The "profile must be complete before booking" invariant is enforced only in the UI layer (`ProfileCompletionModal` + `src/lib/profileValidation.js`), not in the DB.

---

#### ~~`users`~~ — **DELETED 2026-08-06**
The legacy `public.users` table (pre-`profiles`, 1 mock row) has been dropped. `profiles.role` is the sole canonical role field. See `specs/project-context/domain-model.md` for the role-system decision.

---

#### `bookings` (31 rows) — RLS enabled — **Main transactional table**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL | FK → `profiles.id` |
| `lesson_code` | `text` | nullable — FK → `lessons.lesson_code` (enforced, migration `0003`). Application layer should always set it. |
| `lesson_name` | `text` NOT NULL | denormalized name |
| `price` | `text` NOT NULL | stored as text — no numeric validation |
| `amount_paid` | `numeric` | nullable — set when paid |
| `duration_minutes` | `integer` NOT NULL | |
| `group_size` | `integer` NOT NULL | default 1 |
| `status` | `text` NOT NULL CHECK | `pending`, `pending_payment`, `confirmed`, `cancelled` — default `pending_payment` |
| `payment_status` | `text` NOT NULL CHECK | `pending`, `confirmed`, `cancelled` — default `pending` |
| `verification_status` | `text` NOT NULL | no CHECK constraint — free text — default `pending` |
| `booking_type` | `booking_type_enum` NOT NULL | `with_time` or `without_time` — default `with_time` |
| `booking_date` | `date` | nullable (without_time bookings) |
| `start_time` / `end_time` | `time` | nullable (without_time bookings) |
| `time_slot` | `text` | nullable (redundant with start/end?) |
| `time_slot_id` | `uuid` | nullable — orphaned, to be dropped |
| `requires_scheduling` | `boolean` NOT NULL | default false |
| `client_email` | `text` | nullable (may differ from user's profile email) |
| `client_phone` | `text` | nullable |
| `email` | `text` | nullable (duplicate of `client_email`?) |
| `notes` | `text` | nullable |
| `receipt_url` | `text` | nullable — public URL of the invoice PDF in the `invoices` bucket |
| `product_name` | `text` | nullable |
| `ip_address` | `text` | nullable |
| `terms_version` | `text` | nullable |
| `proof_uploaded_at` | `timestamptz` | nullable |
| `payment_date` | `timestamptz` | nullable |
| `created_at` / `updated_at` | `timestamptz` NOT NULL | default `now()` |
| `coach_id` | `uuid` NULL | FK → `profiles.id` ON DELETE SET NULL — F1.02 coach assignment (migration `0008`). Not `availability.trainer_id`. |

Referenced by: `payment_proofs`, `invoices`, `notifications_log`.

> **Schema debt:**
> - `price` is `text` instead of `numeric` — inconsistent with `amount_paid` which is `numeric`.
> - `verification_status` has no CHECK constraint (unlike `status` and `payment_status`).
> - `email` column vs `client_email` — purpose is ambiguous; likely a migration artifact.
> - `time_slot` (text) vs `time_slot_id` (uuid) vs `start_time`/`end_time` — three overlapping representations of the same concept.
>
> ~~`stripe_session_id`~~ — column **dropped** 2026-08-07 (migration `0004`, Stripe decommission).

---

#### ~~`bookings_old`~~ — **DROPPED** (not present in the live schema as of 2026-08-07)
The archived pre-migration booking table no longer exists in `public` (dropped at some point after the 2026-06-28 snapshot).

---

#### `lessons` (14 rows) — RLS enabled
The lesson catalogue. Fetched by `LessonsPage.jsx` via `supabase.from('lessons').select('*').eq('is_active', true)`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `lesson_code` | `text` UNIQUE NOT NULL | business key |
| `name` | `text` NOT NULL | |
| `description` | `text` | nullable |
| `price_amount` | `numeric` NOT NULL | |
| `currency` | `text` NOT NULL | default `CHF` |
| `duration_minutes` | `integer` NOT NULL | |
| `sessions_per_week` | `integer` NOT NULL | default 1 |
| `is_group_lesson` | `boolean` NOT NULL | default false |
| `is_subscription` | `boolean` NOT NULL | default false |
| `is_active` | `boolean` NOT NULL | default true |
| `created_at` / `updated_at` | `timestamptz` NOT NULL | default `now()` |

> ~~`stripe_price_id`~~ — column **dropped** (Stripe deprecation).

> **Security (resolved 2026-08-07):** a live policy `lessons_public_read` (SELECT, `true`) exists — public catalogue read is intentional. The earlier "no policies" finding was stale.

---

#### `invoices` (31 rows) — RLS enabled — **NO RLS POLICIES** ⚠️
Invoice records, one per booking.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `booking_id` | `uuid` NOT NULL | FK → `bookings.id` |
| `invoice_number` | `text` UNIQUE NOT NULL | |
| `amount` | `numeric` NOT NULL | |
| `currency` | `text` NOT NULL | default `CHF` |
| `status` | `text` NOT NULL CHECK | `pending`, `paid`, `cancelled` — default `pending` |
| `pdf_url` | `text` | nullable — link to generated PDF in Storage |
| `paid_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` NOT NULL | default `now()` |

> **Security:** RLS enabled but **no policies**. Same concern as `lessons` — client-side access is currently blocked. The `pdf_url` references the `invoices` Storage bucket (see §4).

---

#### `payment_proofs` (2 rows) — RLS enabled

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `booking_id` | `uuid` NOT NULL | FK → `bookings.id` |
| `file_url` | `text` NOT NULL | URL to uploaded file in `payment-proofs` bucket |
| `verification_status` | `text` NOT NULL | default `pending` |
| `admin_notes` | `text` | nullable |
| `upload_date` / `created_at` | `timestamptz` NOT NULL | default `now()` |

---

#### `availability` (0 rows) — RLS enabled

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `trainer_id` | `uuid` NOT NULL | FK → `profiles.id` (where `role = 'coach'`) |
| `date` | `date` NOT NULL | |
| `start_time` / `end_time` | `time` NOT NULL | |
| `status` | `text` NOT NULL | default `open` |

> No rows currently. Trainer-availability scheduling is not yet in use.

---

#### `credits` (0 rows) — RLS enabled

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL | FK → `profiles.id` |
| `balance` | `integer` NOT NULL | default 0 — tokens, not currency |
| `expiry_date` | `timestamptz` | nullable |
| `source` | `text` | nullable |
| `created_at` | `timestamptz` NOT NULL | default `now()` |

> No rows currently. Credit system is not yet in use.

---

#### `memberships` (0 rows) — RLS enabled

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL | FK → `profiles.id` |
| `plan_id` | `text` | nullable — will reference a future `plans` table |
| `start_date` | `timestamptz` NOT NULL | |
| `next_charge_date` | `timestamptz` | nullable |
| `active` | `boolean` NOT NULL | default true |

> No rows currently. Membership / subscription system is not yet in use.

---

#### `notifications_log` (0 rows) — RLS enabled
Audit trail for outbound notifications. Populated by `notify-payment-verification` v2 (2026-08-07). Values constrained by CHECKs: `notification_type` (`email`, `sms`), `recipient_type` (`client`, `admin`), `status` (`sent`, `failed`, `pending`).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `booking_id` | `uuid` NOT NULL | FK → `bookings.id` |
| `notification_type` | `text` NOT NULL CHECK | `email`, `sms` |
| `recipient_type` | `text` NOT NULL CHECK | `client`, `admin` |
| `recipient_email` / `recipient_phone` | `text` | nullable |
| `message_subject` | `text` | nullable |
| `status` | `text` NOT NULL CHECK | `sent`, `failed`, `pending` |
| `error_message` | `text` | nullable |
| `sent_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` NOT NULL | default `now()` |

---

#### `contact_messages` (12 rows) — RLS enabled

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name`, `email` | `text` NOT NULL | |
| `phone` | `text` | nullable |
| `subject`, `message` | `text` NOT NULL | |
| `status` | `text` NOT NULL | default `new` |
| `created_at` | `timestamptz` NOT NULL | default `now()` |

---

#### `invoice_counters` (17 rows) — RLS enabled, no policies (service-role only)
Per-day invoice sequence allocation. **Added 2026-08-07 (migration `0005`)**; seeded from existing invoice numbers. Used exclusively by `generate-invoice-pdf` via the `next_invoice_number(p_date_key)` RPC (`SECURITY DEFINER`, EXECUTE granted to `service_role` only) — atomic under concurrent bookings.

| Column | Type | Notes |
|---|---|---|
| `date_key` | `text` PK | e.g. `'2026/08/07'` (matches the `INV-YYYY/MM/DD-XX` number format) |
| `next_seq` | `integer` NOT NULL | last allocated sequence for that day |

---

### Entity Relationship Diagram

```mermaid
erDiagram
    auth_users {
        uuid id PK
    }
    profiles {
        uuid id PK
        text full_name
        text email
        text phone
        text address
        text role "NOT NULL default student"
    }
    lessons {
        uuid id PK
        text lesson_code UK
        text name
        numeric price_amount
        text currency
        boolean is_active
    }
    bookings {
        uuid id PK
        uuid user_id FK
        text lesson_code "FK -> lessons.lesson_code"
        text status
        text payment_status
        text verification_status
        booking_type_enum booking_type
        numeric amount_paid
    }
    invoices {
        uuid id PK
        uuid booking_id FK
        text invoice_number UK
        numeric amount
        text status
        text pdf_url
    }
    payment_proofs {
        uuid id PK
        uuid booking_id FK
        text file_url
        text verification_status
    }
    notifications_log {
        uuid id PK
        uuid booking_id FK
        text notification_type
        text status
    }
    availability {
        uuid id PK
        uuid trainer_id FK
        date date
        time start_time
        time end_time
    }
    credits {
        uuid id PK
        uuid user_id FK
        integer balance
    }
    memberships {
        uuid id PK
        uuid user_id FK
        text plan_id
        boolean active
    }
    contact_messages {
        uuid id PK
        text name
        text email
        text status
    }

    auth_users ||--|| profiles : "id"
    profiles ||--o{ bookings : "user_id"
    profiles ||--o{ bookings : "coach_id"
    profiles ||--o{ availability : "trainer_id"
    profiles ||--o{ credits : "user_id"
    profiles ||--o{ memberships : "user_id"
    bookings ||--o{ payment_proofs : "booking_id"
    bookings ||--o{ invoices : "booking_id"
    bookings ||--o{ notifications_log : "booking_id"
```

---

### Views — `public` schema

#### `booking_slots` — **ADDED 2026-08-10 (migration `0006`)**
Non-PII availability projection over `bookings`: `booking_date`, `start_time`, `end_time`, `payment_status` only (no `client_email` / `client_phone` / `notes` / `user_id`). Granted SELECT to `anon` + `authenticated`; runs with view-owner rights so the public availability grid on `/lessons` keeps working after the `bookings` SELECT policy was tightened to owner/admin. Sole consumer: `src/lib/bookings.js` (`fetchDayBookings`).

#### `session_roster` — **ADDED (migration `0008`, F1.02)**
Operational roster projection over `bookings` ⨝ `profiles`: `booking_id`, `booking_date`, `start_time`, `end_time`, `lesson_name`, `participant_full_name`, `coach_id` (no price, payment, email, or proof columns). `SECURITY DEFINER` / `security_barrier`; rows where `is_admin()` or (`is_coach()` and `coach_id = auth.uid()`). GRANT SELECT to `authenticated`; REVOKE `anon`. Consumers: `src/lib/sessionRoster.js`, `/coach/roster`.

---

## 3. Edge Functions

8 functions are **ACTIVE** (reconciled with the live project 2026-08-10). Since 2026-08-10 (PM), `generate-invoice-pdf` and `notify-payment-verification` run with **`verify_jwt: true`** at the gateway plus in-function JWT verification and authorization checks; the other 6 still run with `verify_jwt: false` (trust enforced inside each function, or not at all). Full request/response contracts: `specs/project-context/api-contracts.md §1`.

| Function | Version | Purpose | Status |
|---|---|---|---|
| `generate-invoice-pdf` | v22 | Generate invoice PDF (atomic `INV-YYYY/MM/DD-XX` numbering via `next_invoice_number` RPC) | **Active — main invoice generator** (called via `src/lib/bookings.js` from `LessonsPage.jsx` and `PaymentsPage.jsx`). Auth: caller JWT + booking ownership (or admin). |
| `submit-contact-form` | v13+ | Persist contact message + trainer/customer emails | **Active** (called by `ContactPage.jsx`) |
| `notify-payment-verification` | v6 | Email customer on proof approval/rejection; audits to `notifications_log` | **Active** (called by `PaymentVerificationPanel.jsx`). Auth: caller JWT + admin role. |
| `cleanup-pending-bookings` | v15+ | Time-based auto-cancel of pending bookings | **Dormant — do NOT schedule.** Rejected approach; to be replaced by an explicit cancel-reservation flow (decision 2026-08-07). |
| `upload-invoice-to-storage` | v2+ | Verify invoice PDF in storage, set status | Active, no frontend caller. To become the flag-driven invoice status-transition helper (future spec). |
| `merge-invoice-qr` | v1+ | Merge QR page into a base64 invoice PDF | Active, no frontend caller (QR merge now inline in `generate-invoice-pdf`) |
| `verify-invoice-generation` | v1+ | Scan generated PDF for unresolved placeholders | Active — QA/debug utility |
| `upload-logo-once` | v1+ | One-off upload of `assets/logo.png` to `invoices` bucket | Active — setup helper |

> **Deleted 2026-08-10** (by owner, via dashboard/CLI): `create-booking` (Stripe), `handle-stripe-webhook` (Stripe), `verify-booking-saved` (validated the dropped Stripe column), `generate-booking-receipt` and `assign-booking-time` (verified unused — no callers, no invocations, broken source bundles). Earlier snapshots also listed `create-booking-with-invoice` and `generate-invoice-pdf-v2`, which no longer exist.
>
> Stripe cleanup status: secrets confirmed removed from Edge Function secrets (2026-08-10). The only remaining manual step is deleting the stale webhook endpoint in the Stripe dashboard (Developers → Webhooks → endpoint pointing to `…/functions/v1/handle-stripe-webhook` → Delete; check Live and Test mode) — harmless while it exists since the target function is gone.

---

## 4. Storage Buckets

| Bucket | Public | Purpose | File size limit | MIME restriction |
|---|---|---|---|---|
| `invoices` | Yes | Generated invoice PDFs (`Pending/YYYY/MM/DD/` prefix; planned: `Paid/`, `Refused/` on finance verification) + `assets/logo.png` | None | None |
| `qr-codes` | Yes | Swiss QR payment slips embedded in invoices (`QR_<amount>.pdf`) | None | None |
| `payment-proofs` | No (private) | Customer-uploaded bank transfer proofs (`<booking_id>/attempt-<n>.<ext>`; legacy `<booking_id>/<booking_id>_<ts>.<ext>` files remain valid), accessed via 24h signed URLs. F1.02 (`0008`): SELECT/INSERT allowed when the first path segment equals an owned `bookings.id` or `is_admin()` | None | None |

> ~~`receipts`~~ bucket **deleted 2026-08-10** (legacy Stripe-era invoice PDFs; verified unreferenced before deletion).
>
> **Bucket structure decision 2026-08-07:** `invoices` and `payment-proofs` stay **separate** — bucket publicity is bucket-level and the two have opposite privacy requirements (public invoice URLs vs private signed proof URLs). See `api-contracts.md §3`.

---

## 5. RLS Policies Summary

Live policy set, verified 2026-08-10 via `pg_policies` (after migration `0006`). RLS is enabled on **all** tables.

| Table | Policy | Role | Command | Condition |
|---|---|---|---|---|
| `profiles` | ~~Public profiles are viewable by everyone~~ | — | — | **DROPPED (migration `0008`)** — was `true`, exposed email/role to anon |
| `profiles` | Users can insert their own profile | public | INSERT | (check via trigger) |
| `profiles` | Users can read own profile role | authenticated | SELECT | `id = auth.uid()` OR `is_admin()` |
| `profiles` | Users can update own profile | public | UPDATE | `auth.uid() = id` — `role` changes rejected by `prevent_role_self_service` when `auth.role()` is `authenticated`/`anon` |
| `bookings` | ~~Public read bookings~~ | — | — | **DROPPED 2026-08-10 (migration `0006`)** — was `true`, exposed PII to anonymous callers |
| `bookings` | Users can view own bookings | authenticated | SELECT | `auth.uid() = user_id` (added 2026-08-10) |
| `bookings` | Admins can view all bookings | authenticated | SELECT | `is_admin()` (added 2026-08-10) |
| `bookings` | Users insert own bookings | public | INSERT | `auth.uid() = user_id` |
| `bookings` | Users update own bookings | public | UPDATE | `auth.uid() = user_id` |
| `bookings` | Admins can update any booking | authenticated | UPDATE | `is_admin()` — `coach_id` changes also require `prevent_non_admin_coach_assignment` (admin-only; target must be `role = coach`) |
| `booking_slots` (view) | *(view grant)* | anon, authenticated | SELECT | view-owner rights over a non-PII projection (added 2026-08-10, migration `0006`) |
| `session_roster` (view) | *(view grant)* | authenticated | SELECT | admin all operational rows; coach assigned rows only (migration `0008`) |
| `lessons` | lessons_public_read | public | SELECT | `true` (intentional — public catalogue) |
| `availability` | Public can view availability | public | SELECT | `true` |
| `credits` | Users can view own credits | public | SELECT | `auth.uid() = user_id` |
| `memberships` | Users can view own membership | public | SELECT | `auth.uid() = user_id` |
| `payment_proofs` | Users can insert their own payment proofs | authenticated | INSERT | — |
| `payment_proofs` | Users can view their own payment proofs | authenticated | SELECT | via `bookings.user_id = auth.uid()` OR `is_admin()` |
| `payment_proofs` | Admins can update any payment proof | authenticated | UPDATE | `is_admin()` |
| `contact_messages` | Service role full access | service_role | ALL | `true` |
| `notifications_log` | Service Role Full Access | service_role | ALL | `true` |
| `invoices` | *(none)* | — | — | **No policies — client reads blocked; writes are service-role only** |
| `invoice_counters` | *(none)* | — | — | **No policies — service-role only (intended)** |

> Dropped 2026-08-07 (migration `0004`): `profiles` policies "Users can update own stripe_customer_id" / "Users can view their own stripe_customer_id" (Stripe-era duplicates).
>
> Hardening executed 2026-08-10 (migration `0006`): the `booking_slots` non-PII view now serves the `LessonsPage` availability grid, and `bookings` SELECT is owner/admin only.
>
> Hardening executed 2026-08-25 (migration `0008`, F1.02): public `profiles` SELECT dropped; PostgREST cannot change `profiles.role`; `payment-proofs` storage is owner-path-or-admin; coaches read `session_roster` only. Remaining: `invoices` read policy (`api-contracts.md §7.1`).

---

## 6. Security Findings

These were reported by the Supabase advisor. Listed here for traceability; remediation should be done as deliberate spec'd tasks, not ad-hoc.

| Severity | Finding | Affected object | Remediation |
|---|---|---|---|
| ⚠️ WARN | `payment_proofs` has a service-role ALL policy targeting `public` role — effectively bypasses RLS for everyone | `payment_proofs` | Remove the "Service Role Full Access Payment Proofs" policy from the `public` role; service_role bypasses RLS by default anyway. [Docs](https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy) |
| ⚠️ WARN | `payment_proofs` has conflicting policies causing multiple permissive policy overhead | `payment_proofs` | Consolidate into a single SELECT and single INSERT policy. [Docs](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) |
| ⚠️ WARN | ~~`profiles` has duplicate SELECT and UPDATE policies (stripe_customer_id ones vs general)~~ | `profiles` | **Resolved 2026-08-07** (migration `0004`): Stripe-named policies dropped. |
| ℹ️ INFO | `invoices` — RLS enabled, zero policies | `invoices` | Add appropriate client-side read policy (e.g. users can read invoices for their own bookings). |
| ℹ️ INFO | ~~`lessons` — RLS enabled, zero policies~~ | `lessons` | **Resolved** — live policy `lessons_public_read` (SELECT, `true`) verified 2026-08-07. |
| ⚠️ WARN | `handle_new_user()` function has a mutable `search_path` | `public.handle_new_user` | Set `search_path = ''` and qualify all object names. [Docs](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) |
| ⚠️ WARN | `handle_new_user()` is callable by `anon` and `authenticated` as `SECURITY DEFINER` | `public.handle_new_user` | Revoke `EXECUTE` from `anon`/`authenticated`, or switch to `SECURITY INVOKER`. [Docs](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) |
| ⚠️ WARN | `invoices` and `receipts` Storage buckets are public and allow directory listing | `storage.invoices`, `storage.receipts` | Remove broad SELECT storage policies; object URLs still work without listing. `receipts` is pending deletion (2026-08-07). [Docs](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing) |
| ⚠️ WARN | ~~`bookings` SELECT policy is `true` — all bookings are readable by anyone (including unauthenticated)~~ | `bookings` | **Resolved 2026-08-10** (migration `0006`): public-read policy dropped; owner (`auth.uid() = user_id`) + admin (`is_admin()`) SELECT policies added; public availability served by the non-PII `booking_slots` view. |
| ⚠️ WARN | ~~`profiles` SELECT policy is `true` — anyone can read email/role~~ | `profiles` | **Resolved 2026-08-25** (migration `0008`): public SELECT dropped; own-or-admin SELECT remains. |
| ⚠️ WARN | Leaked password protection is disabled in Supabase Auth | Auth settings | Enable HaveIBeenPwned.org check in Supabase Auth dashboard → Settings → Auth → Password. |

---

## 7. Performance Findings

| Issue | Affected object | Fix |
|---|---|---|
| Unindexed FK `availability_trainer_id_fkey` | `availability.trainer_id` | `CREATE INDEX ON availability(trainer_id)` |
| Unindexed FK `bookings_user_id_fkey1` | `bookings.user_id` | `CREATE INDEX ON bookings(user_id)` |
| Unindexed FK `bookings_user_id_fkey` | `bookings_old.user_id` | (drop table instead) |
| Unindexed FK `credits_user_id_fkey` | `credits.user_id` | `CREATE INDEX ON credits(user_id)` |
| Unindexed FK `invoices_booking_id_fkey` | `invoices.booking_id` | `CREATE INDEX ON invoices(booking_id)` |
| Unindexed FK `memberships_user_id_fkey` | `memberships.user_id` | `CREATE INDEX ON memberships(user_id)` |
| Unindexed FK `notifications_log_booking_id_fkey` | `notifications_log.booking_id` | `CREATE INDEX ON notifications_log(booking_id)` |
| Unindexed FK `payment_proofs_booking_id_fkey` | `payment_proofs.booking_id` | `CREATE INDEX ON payment_proofs(booking_id)` |
| `auth.uid()` not wrapped in `SELECT` in RLS policies | `profiles`, `bookings`, `bookings_old`, `users`, `credits`, `memberships`, `payment_proofs` | Replace `auth.uid()` with `(SELECT auth.uid())` in all policy expressions. |

---

## 8. Open Items / Deferred Decisions

- **Role system:** Canonical store is `public.profiles.role` (`student`, `coach`, `accounting`, `admin`; default `student`). Helpers: `is_admin()`, `is_coach()` (GRANT EXECUTE to `authenticated`). Live actors after F1.02: student, admin, coach (assigned-session roster). `accounting` remains unused (non-admin, no roster). Role promotion stays out-of-band SQL (`prevent_role_self_service`). JWT custom claims and a `user_roles` table remain rejected. Apply migration `0008` on the target project before treating this as the remote as-is. The current admin user is `josep.barbera.reverte.1999@gmail.com` (the legacy `admin@agcpadelacademy.com` hardcoded in old code never existed in `auth.users`).
- ~~**`generate-invoice-pdf` vs `generate-invoice-pdf-v2`:**~~ **Resolved 2026-08-07** — the `-v2` function no longer exists in the live project; `generate-invoice-pdf` (v18) is the sole canonical generator.
- ~~**`cleanup-pending-bookings`:**~~ **Resolved 2026-08-07** — no scheduler exists and none should be added; time-based auto-cancellation is rejected. To be replaced by an explicit cancel-reservation flow (customer/admin/coach), spec'd as a future feature.
- ~~**Migrations table is empty:**~~ **Resolved** — migrations `0001`–`0006` are tracked in `supabase_migrations` as of 2026-08-10.
- **No-file-size or MIME-type restrictions on any Storage bucket:** Any file size / type can be uploaded to `payment-proofs`. Add limits when implementing the payment-proof upload feature spec.
- **Stripe cleanup:** Edge Functions deleted 2026-08-10; DB artifacts dropped (migration `0004`); Stripe secrets removed from Edge Function secrets 2026-08-10. Last leftover: the webhook endpoint in the Stripe dashboard (Developers → Webhooks, pointing to `…/functions/v1/handle-stripe-webhook`) — delete it there; harmless while it exists (deliveries just fail).
