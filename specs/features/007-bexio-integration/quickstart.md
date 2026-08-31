# Quickstart: Validating the Bexio Integration

**Feature**: `specs/features/007-bexio-integration/spec.md` | **Date**: 2026-08-20
**Artifacts**: [research.md](research.md) · [data-model.md](data-model.md) · [contracts/edge-functions.md](contracts/edge-functions.md) · [contracts/accounting-provider.md](contracts/accounting-provider.md)

This guide proves the feature end-to-end. It assumes the implementation (from `tasks.md`) is deployed. No production data is touched: use the Supabase test branch (constitution: no shared production DB) and a Bexio **trial/demo company**.

---

## 0. Prerequisites (one-time setup)

1. **Bexio developer app**: register at developer.bexio.com → note `client_id`/`client_secret` → register redirect URL `https://<project-ref>.supabase.co/functions/v1/bexio-oauth/callback` (path-based; the IdP matches redirect URIs exactly).
2. **Bexio company setup** (FR-018 checklist): QR-capable bank account configured; invoice template with QR payment part enabled; automatic invoice numbering on; active sales tax present.
3. **Supabase secrets** (Edge Function env): `BEXIO_CLIENT_ID`, `BEXIO_CLIENT_SECRET`, `BEXIO_OAUTH_STATE_SECRET`.
4. **Migration applied**: tables, RLS, view, extensions (`pg_cron`, `pg_net`), cron job — see data-model.md §Migration plan.
5. **Edge Functions deployed**: `bexio-oauth`, `billing-issue-invoice`, `billing-invoice-document`, `billing-cancel-invoice`, `bexio-reconcile`.
6. **Test data**: one student account, one admin account, one future lesson slot.

## 1. Connect (US1)

| Step | Action | Expected |
|---|---|---|
| 1.1 | Admin opens `/admin/integrations` → "Connect Bexio" | Redirect to `auth.bexio.com` consent screen with the 5 scopes |
| 1.2 | Approve | Redirect back with `?bexio=connected`; card shows `connected`, scopes, timestamp |
| 1.3 | Run "Initialize configuration" | Discovered IDs shown; any `missing` items flagged; `config_complete` true after entry |
| 1.4 | In DB: `SELECT refresh_token_secret FROM billing_integrations` | Contains a Vault **name**, never a token value |

## 2. Contact sync + invoice creation (US2, US3)

| Step | Action | Expected |
|---|---|---|
| 2.1 | As student, book a lesson with "receipt by email" | Booking created; response shows Bexio `document_nr`; **no** legacy PDF email |
| 2.2 | In Bexio dashboard | New contact (person, student's name/email); issued invoice with QR payment part, line item text naming the lesson/date, correct CHF total and **0% VAT** |
| 2.3 | In DB: `billing_contacts`, `billing_documents` | One row each; `api_reference = 'agc:booking:<id>'`; status `issued` |
| 2.4 | Repeat the booking call with the same `idempotency_key` (or re-trigger) | `reused: true`; **no** second invoice in Bexio |
| 2.5 | Book again as the same student | Same Bexio contact reused (no duplicate) |

## 3. Invoice PDF access (US5)

| Step | Action | Expected |
|---|---|---|
| 3.1 | Student opens booking → "View invoice" | Bexio-generated PDF with QR payment part renders inline |
| 3.2 | Another student's `booking_id` | `403` |
| 3.3 | Admin opens same invoice | PDF renders |
| 3.4 | Pre-integration booking | Legacy PDF from `invoices` bucket still renders (unchanged path) |

## 4. Reconciliation (US4)

| Step | Action | Expected |
|---|---|---|
| 4.1 | In Bexio, register a payment covering the invoice (demo company: open the invoice → record payment. A live bank feed is **not** required.) | Bexio invoice shows received = total |
| 4.2 | Wait ≤ 15 min (or press "Run reconciliation now" as admin) | Booking `status = 'confirmed'`, `payment_status = 'confirmed'`, `payment_confirmation_source = 'bexio_reconciliation'`; document status `paid`; `payment.reconciled` audit event |
| 4.3 | Re-run reconciliation | No state change, no duplicate events (idempotent) |
| 4.4 | Partial payment case | Document shows `partially_paid`; booking remains `pending`; visible to admin |

## 5. Failure drills (spec Edge Cases, FR-030–FR-032)

| Step | Action | Expected |
|---|---|---|
| 5.1 | Block network to `api.bexio.com` (or revoke scopes in demo app), then book | Booking **succeeds**; invoice step returns `provider_unavailable`; row in `billing_operations` with `next_retry_at`; admin sees failure |
| 5.2 | Restore access, run worker | Operation retried, invoice created+issued, operation `succeeded` |
| 5.3 | Invalidate refresh token, run worker | Integration flips `requires_reauth`; admin sees reconnect banner; no crash loop |
| 5.4 | Check logs (Edge Function logs + `billing_events`) | No tokens, no auth headers, no full payloads |

## 6. Legacy coexistence & cutover

| Step | Action | Expected |
|---|---|---|
| 7.1 | Set integration `status='disconnected'` (or delete row) | New bookings fall back to legacy `generate-invoice-pdf` path automatically |
| 7.2 | Reconnect | New bookings use Bexio again; old legacy invoices still downloadable |
| 7.3 | Invoice numbering | AGC internal sequence unaffected; Bexio numbers are stored display-only |

## 7. Cancellation (US5 — client unpaid lesson)

| Step | Action | Expected |
|---|---|---|
| 8.1 | Student: unpaid invoiced lesson → **Cancel booking** on My Payments → confirm in the in-app modal | Bexio invoice cancelled; My Payments shows Cancelled |
| 8.2 | Cancel while Bexio unreachable | Booking still cancelled in AGC; `invoice_cancel` queued for the worker |
| 8.3 | Paid lesson on My Payments | Shows **Paid**; no cancel action |
| 8.4 | Admin Integrations page | No cancel-invoice or record-refund controls |

## 8. Admin financial overview (US6) — deferred

Not in 007 (Decision 2026-08-25). Outstanding invoices are followed up in Bexio. AGC admin shows connection + worker health only.

## Acceptance mapping

Scenarios 1–9 collectively cover SC-001…SC-010 and the spec's 12 acceptance outcomes; traceability is maintained in `tasks.md` per requirement (FR-001…FR-038).

## Validation log (2026-08-25)

Recorded during 007 implementation on branch `sdd/007-bexio-integration` (T048). Production cutover is T053 and is **not** done.

| Section | Result | Evidence |
|---|---|---|
| §0 secrets + OAuth app | Pass | T002/T017 2026-08-21 |
| §1 Connect | Pass | Live OAuth + config discovery (T017) |
| §2.1 Book + invoice | Pass | Student booked; My Payments showed Awaiting payment |
| §2.2–§2.5 Bexio contact reuse / idempotency | Partial | Adapter unit tests pass; live Bexio dashboard contact check not re-run this session |
| §3 PDF | Pass for owner path | Invoice (PDF) on My Payments; cross-student 403 covered by function auth + tests |
| §4 Reconciliation payment | Open | Worker deployed; **Run reconciliation now** exists; demo-company payment → AGC confirmed not recorded this session |
| §5 Failure drills | Unit only | Deno tests for enqueue/retry/auth errors; live outage drill not run |
| §6 Legacy fallback | Code | `isBexioBillingEnabled()` fail-safe + `requestInvoice` branch |
| §7 Unpaid cancel | Pass | Student cancelled unpaid booking; in-app modal (not `window.confirm`); `billing-cancel-invoice` live (401 without JWT, not 404) |
| §8 US6 | N/A | Deferred — no admin invoice list |

Remaining live checks before T053: register a demo payment (quickstart §4.1–§4.2); optional failure drill §5.
