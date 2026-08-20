# Quickstart: Validating the Bexio Integration

**Feature**: `specs/features/007-bexio-integration/spec.md` | **Date**: 2026-08-20
**Artifacts**: [research.md](research.md) · [data-model.md](data-model.md) · [contracts/edge-functions.md](contracts/edge-functions.md) · [contracts/accounting-provider.md](contracts/accounting-provider.md)

This guide proves the feature end-to-end. It assumes the implementation (from `tasks.md`) is deployed. No production data is touched: use the Supabase test branch (constitution: no shared production DB) and a Bexio **trial/demo company**.

---

## 0. Prerequisites (one-time setup)

1. **Bexio developer app**: register at developer.bexio.com → note `client_id`/`client_secret` → register redirect URL `https://<test-project-ref>.supabase.co/functions/v1/bexio-oauth?action=callback` (plus localhost variant for dev).
2. **Bexio company setup** (FR-018 checklist): QR-capable bank account configured; invoice template with QR payment part enabled; automatic invoice numbering on; active sales tax present.
3. **Supabase secrets** (Edge Function env): `BEXIO_CLIENT_ID`, `BEXIO_CLIENT_SECRET`, `BEXIO_OAUTH_STATE_SECRET`.
4. **Migration applied**: tables, RLS, view, extensions (`pg_cron`, `pg_net`), cron job — see data-model.md §Migration plan.
5. **Edge Functions deployed**: `bexio-oauth`, `billing-issue-invoice`, `billing-invoice-document`, `bexio-reconcile`.
6. **Test data**: one student account, one admin account, one future lesson slot.

## 1. Connect (US1)

| Step | Action | Expected |
|---|---|---|
| 1.1 | Admin opens `/admin/integrations` → "Connect Bexio" | Redirect to `idp.bexio.com` consent screen with the 5 scopes |
| 1.2 | Approve | Redirect back with `?bexio=connected`; card shows `connected`, scopes, timestamp |
| 1.3 | Run "Initialize configuration" | Discovered IDs shown; any `missing` items flagged; `config_complete` true after entry |
| 1.4 | In DB: `SELECT refresh_token_secret FROM billing_integrations` | Contains a Vault **name**, never a token value |

## 2. Contact sync + invoice creation (US2, US3)

| Step | Action | Expected |
|---|---|---|
| 2.1 | As student, book a lesson with "receipt by email" | Booking created; response shows Bexio `document_nr`; **no** legacy PDF email |
| 2.2 | In Bexio dashboard | New contact (person, student's name/email); issued invoice with QR payment part, line item text naming the lesson/date, correct CHF total and VAT |
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
| 4.1 | In Bexio, register a payment covering the invoice (demo company) | — |
| 4.2 | Wait ≤ 15 min (or press "Run reconciliation now" as admin) | Booking mirrors admin-approval end state: `status = 'confirmed'`, `payment_status = 'confirmed'`, `verification_status = 'approved'`, `payment_confirmation_source = 'bexio_reconciliation'`; document status `paid`; `payment.reconciled` audit event — **no admin verification clicked** |
| 4.3 | Re-run reconciliation | No state change, no duplicate events (idempotent) |
| 4.4 | Partial payment case | Document shows `partially_paid`; booking remains `pending`; visible to admin |

## 5. Manual verification interplay (Q2-A guards)

| Step | Action | Expected |
|---|---|---|
| 5.1 | New booking → student uploads proof → admin verifies **before** any Bexio payment | Booking `payment_status = 'confirmed'`, source `manual_proof` |
| 5.2 | Later, Bexio reconciles that invoice | No downgrade/duplicate; source stays recorded; reconciliation event notes already-paid |
| 5.3 | Reconciled-paid booking → student uploads proof | Proof stored but flagged `superseded`; admin sees it flagged, not pending (FR-038) |
| 5.4 | Admin tries to verify an already-reconciled booking | Guard rejects; state unchanged (FR-037) |

## 6. Failure drills (spec Edge Cases, FR-030–FR-032)

| Step | Action | Expected |
|---|---|---|
| 6.1 | Block network to `api.bexio.com` (or revoke scopes in demo app), then book | Booking **succeeds**; invoice step returns `provider_unavailable`; row in `billing_operations` with `next_retry_at`; admin sees failure |
| 6.2 | Restore access, run worker | Operation retried, invoice created+issued, operation `succeeded` |
| 6.3 | Invalidate refresh token, run worker | Integration flips `requires_reauth`; admin sees reconnect banner; no crash loop |
| 6.4 | Check logs (Edge Function logs + `billing_events`) | No tokens, no auth headers, no full payloads |

## 7. Legacy coexistence & cutover

| Step | Action | Expected |
|---|---|---|
| 7.1 | Set integration `status='disconnected'` (or delete row) | New bookings fall back to legacy `generate-invoice-pdf` path automatically |
| 7.2 | Reconnect | New bookings use Bexio again; old legacy invoices still downloadable |
| 7.3 | Invoice numbering | AGC internal sequence unaffected; Bexio numbers are stored display-only |

## 8. Cancellation & refunds (US5)

| Step | Action | Expected |
|---|---|---|
| 8.1 | New booking → invoice issued → cancel booking **before** payment | Bexio invoice shows cancelled via API; `billing_documents.status = 'cancelled'` |
| 8.2 | Cancel while Bexio unreachable | AGC operational cancellation completes; `invoice_cancel` operation queued and retried by the worker; systems do not silently diverge |
| 8.3 | Reconciled-paid booking → cancel with refund agreed | No automatic money movement; refund expectation recorded; admin sees an explicit "financial correction required in Bexio" indicator |
| 8.4 | Cancel an invoice Bexio refuses (e.g. already paid) | Conflict surfaced to admin; no forced state change in AGC |

## 9. Admin financial overview (US6)

| Step | Action | Expected |
|---|---|---|
| 9.1 | Admin opens the financial overview | Per-transaction payment/invoice status, outstanding indicator, Bexio document reference |
| 9.2 | A transaction with a failed/exhausted operation | Failure state visible with a working re-run action |
| 9.3 | Follow the Bexio reference link on a row | Lands on the matching invoice inside the Bexio web app |
| 9.4 | Look for ledger/VAT/financial-report features in AGC | Absent by design — those remain exclusively in Bexio |

## Acceptance mapping

Scenarios 1–9 collectively cover SC-001…SC-010 and the spec's 12 acceptance outcomes; traceability is maintained in `tasks.md` per requirement (FR-001…FR-038).
