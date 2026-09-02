# Project context — AGC Padel Academy

Short context for feature specs. Details: `specs/project-context/` and `specs/baseline-system/`. If this file disagrees with those or with live code, record the discrepancy and trust the detailed spec plus the code.

---

## Product purpose

Public web app for a padel academy in Switzerland. **Dual identity (Decision 2026-08-19):** legal entity **CAG Padel Academy GmbH** (invoices, terms, impressum); product brand **AGC Padel Academy** (UI, domain, repo). It is a marketing site and the **system of record for bookings** — no external CRM.

Three lines: **lessons** (live booking + payment), **tournaments** (marketing only), **trips / camps** (marketing only; CTA is `/contact`).

---

## Main users

| User | Role today |
|---|---|
| Visitor | Browse, contact, sign up / sign in |
| Student (`profiles.role = student`) | Profile, book a lesson, pay by bank transfer (QR invoice), re-download invoice |
| Admin (`profiles.role = admin`) | Manage Bexio integration and reconciliation; `is_admin()` enforces this server-side |
| Coach / accounting | Role values exist; no live UI or workflows |

---

## Critical flows

1. **Discover** — home → lessons / trips / tournaments / contact / terms.
2. **Register & sign in** — email + password; confirmation; password recovery lands on `/reset-password` (must not silently log in).
3. **Complete profile** — billing fields required before a booking is created.
4. **Book a lesson** — pick active catalogue item + date/slot → insert booking → generate branded invoice PDF (Swiss QR) → My Payments.
5. **Pay** — bank transfer using the QR invoice. The booking is confirmed when Bexio records the payment (reconciliation worker, every six hours or admin "Run now").
6. **Re-get invoice** — open existing PDF or issue/reuse from My Payments if needed.

Trips and tournaments are **not** bookable. There is **no** live cancel-booking action.

---

## Current stack

- **Frontend:** React 18, Vite 7, Tailwind 3, Radix / shadcn, React Router 6. JavaScript (JSX). No TypeScript.
- **Backend:** Supabase (Postgres + RLS, Auth, Storage, Deno Edge Functions). No custom Node API.
- **Payments:** bank transfer + proof verification. Stripe is removed.
- **Host:** Vercel (`main` → production; branch previews). Node `>= 20.19`.
- **CI:** GitHub Actions — lint, Vitest, production build.

---

## Business priorities

1. Keep lesson booking, invoicing, and payment verification **working and correct** (this is the live revenue path).
2. Preserve existing bookings, invoices, and payment-proof history.
3. Grow via **feature specs**, not a rewrite: memberships/tokens, skill-rank class assignment, cancellation, trips/tournaments as products, OAuth, i18n, coach/accounting roles.
4. Stay the single source of truth for reservations.

---

## Known concerns

- **AGC vs CAG** is a **confirmed dual identity** (Decision 2026-08-19): CAG on legal/invoices; AGC on product UI/domain. Do not rename one side.
- `/lessons` has **no** self-serve calendar or time-slot grid (**Decision 2026-09-02**). New bookings insert with null `booking_date` / `start_time` / `end_time`; the academy assigns the class.
- Booking insert and invoice generation are **two steps**, not one transaction (recoverable via “Get invoice”).
- `invoices.status` does not flip to `paid` on admin approval; `Pending/` → `Paid/` / `Refused/` is **intended** for `invoice-lifecycle` only (Decision 2026-08-19): approve → `paid` + move to `Paid/`; reject proof → invoice stays `pending`; `UNIQUE(booking_id)`; second generate UPDATEs.
- Overlapping booking fields: `status`, `payment_status`, `verification_status`; `bookings.price` is text.
- Proof files have **no** bucket-level size/MIME limits (client validates only).
- Marketing images still live on the former Horizons CDN.
- `memberships`, `credits`, `availability` are empty schema. `coach` / `accounting` stay schema-only until `coach-accounting-matrix` (after class-assignment / memberships-credits). No admin-equivalent access in the meantime.
- OAuth buttons exist; the Google provider is not enabled. UI is English-only (DeepL planned, not built).
- Phone validation is inconsistent today (signup ≥9 digits vs modal raw length 10). **Intended (Decision 2026-08-19):** country calling-code picker (default +41) + digits-only national number, same control everywhere; store E.164 in `profiles.phone`.

---

## Non-negotiable rules

From `.specify/memory/constitution.md`:

1. **Understand before modifying** — read `/docs/sdd-brownfield`, `/specs`, and `/src` first. Mark assumptions; do not invent rules.
2. **Spec-driven** — specify → plan → tasks → implement, with user approval between stages. No non-trivial implementation without an approved spec and plan.
3. **Incremental and compatible** — never delete functionality, tables, columns, or files unless explicitly instructed.
4. **Security first** — no hardcoded secrets; least-privilege RLS; no public PII on bookings (use `booking_slots`); admin via `profiles.role`, not email; hardened Edge Functions use an explicit session JWT on both sides.
5. **Migration discipline** — numbered SQL migrations; no opportunistic schema fixes inside unrelated features.
6. **Document honestly** — Markdown + Mermaid; confirmed vs inferred vs TODO.

Full text: `.specify/memory/constitution.md`.
