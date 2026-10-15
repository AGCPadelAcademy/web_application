# Research: Membership Automatic Collection (F1.26)

**Feature**: `specs/features/011-membership-automatic-collection/spec.md`
**Date**: 2026-10-08
**Purpose**: Resolve Technical Context unknowns without inventing an F1.09 Membership product or a live bank connection that the academy has not confirmed.

Sources: F1.26 spec (including the 2026-10-07 clarifications), constitution, F1.03 billing spine (`0003_bexio_integration.sql`, `financial-service.ts`, `reconciliation-service.ts`, `0004_bexio_reconcile_cron.sql`), F1.25 camp billing extension (`0014_f125_padel_camps.sql`, `camp-mapper.ts`), F1.04 `profiles.is_active`, unused `memberships` / `credits` described in `specs/project-context/domain-model.md`, My Payments (`src/pages/PaymentsPage.jsx`). Local migrations currently run through `0019`.

---

## R-01. Do not adopt the unused `memberships` or `credits` tables

- **Decision**: F1.26 does not read or write `public.memberships` or `public.credits`. Correlation uses new operational tables keyed by `profiles.id` and a `membership_ref` uuid. That uuid is the identifier F1.09 will own. It is not a foreign key to the unused table.
- **Rationale**: The unused table is a plan/subscription leftover (`plan_id`, `active`, `next_charge_date`) and contradicts F1.09 (one Client + one Group, fixed place, explicit lifecycle, no credit wallet). The spec forbids treating it as the product.
- **Alternatives considered**: *Activate `memberships` and collect from `next_charge_date`* — rejected: that would implement the wrong domain. *Wait to plan until F1.09 exists* — rejected: the spec allows a test double of a chargeable period so the collection channel can be built first.

## R-02. F1.26 consumes an intent inbox; it does not own the billing calendar or Membership lifecycle

- **Decision**: `collection_subjects` names the client and `membership_ref` only (no Pending/Active/Paused/Cancelled/Expired column). `membership_period_intents` is the chargeable inbox: amount, currency, opaque `period_key`, and paid state for that period. Until F1.09 exists, only the service role (tests, quickstart seed) may insert subjects and intents. This feature never assigns a Group place and never changes a Membership to Active.
- **Rationale**: FR-013 and FR-021. Calendar month versus academy term stays with F1.09. The payment-confirmed signal is a row F1.09 can read later.
- **Alternatives considered**: *Derive the next charge inside this job* — rejected: invents the calendar the spec forbids. *Store Membership lifecycle here “temporarily”* — rejected: a second state machine.

## R-03. Membership-period invoices extend the F1.03 billing spine

- **Decision**: Add nullable `membership_period_intent_id` on `billing_documents`, `billing_operations`, and `billing_events`. A document has exactly one subject among `booking_id`, `camp_registration_id`, and `membership_period_intent_id`. `api_reference` is `agc:membership-period:{intent_id}`. Issue through the existing `FinancialService` idempotency layers (local document, succeeded operation, `api_reference` search). Bexio stays the accounting source of truth for the invoice and recorded payments.
- **Rationale**: Same pattern F1.25 used for camps. A parallel invoice table would be a second payment machine.
- **Alternatives considered**: *Reuse `booking_id`* — rejected: the spec forbids folding Membership periods into bookings. *New invoice table* — rejected: duplicates retry and reconciliation.

## R-04. Issuer channel is a port with an unconfigured adapter, not a chosen bank client

- **Decision**: Add a server-side `CollectionChannel` port (propose mandate, read mandate status, submit collection, read collection status). The shipped adapter is `UnconfiguredCollectionChannel`: it reports not configured and performs no network call. Opt-in is refused and QR remains. No SIX client. No AKB eBill Web client and no named network-partner client in this feature. When AKB confirms a contract, a later change implements one adapter behind the same port. Secrets, if a future adapter needs them, stay in Vault. The port never accepts bank login credentials.
- **Rationale**: The spec says the concrete channel is chosen after AKB confirmation, and live collection cannot be verified until that contract exists. Choosing AKB or a partner now would invent an integration. The port still lets mandate, idempotency, fallback, and the payment signal be built and tested.
- **Alternatives considered**: *Implement AKB eBill Web now* — rejected: no confirmed contract or credentials in this repo. *Call SIX directly* — rejected by FR-006.

## R-05. One in-flight mandate attempt; a new attempt only after rejection or revocation

- **Decision**: `direct_debit_mandates` is one row per attempt. Status values: `not_requested`, `proposal_sent`, `active`, `rejected`, `revoked`, `failed`, `unsupported_bank`. A partial unique index allows only one `proposal_sent` and only one `active` row per subject. Repeating opt-in while `proposal_sent` updates that row and does not insert another. After `rejected` or `revoked`, the client or an Admin may explicitly request one new attempt. `failed` retries the same attempt. `unsupported_bank` does not create another proposal. A rejected or revoked row is never updated back to `active`.
- **Rationale**: FR-008, FR-009, and the 2026-10-07 clarification. Technical failure is not a new legal mandate. An unsupported bank stays on QR.
- **Alternatives considered**: *One mandate row forever, overwritten in place* — rejected: loses the rejected attempt and makes “do not reuse as active” unauditable. *Automatic new proposal on every rejection* — rejected: the clarification requires an explicit request.

## R-06. One collection per period; stop and deactivation do not cancel an in-flight debit

- **Decision**: `collection_requests.intent_id` is unique. The job submits only when the latest mandate is `active`, the method is `automatic_collection`, the client `profiles.is_active` is true, and the intent is not already paid. Stopping auto-pay sets the method to `qr_invoice` and skips later periods. Deactivation also skips new submissions and refuses a new opt-in. A `collection_requests` row already in `submitted` is left to finish; a later `confirmed` result still marks that period paid.
- **Rationale**: 2026-10-07 clarifications and F1.04. The channel port has no cancel operation because the spec does not require one and a Swiss Direct Debit already sent cannot be reliably withdrawn by this application.
- **Alternatives considered**: *Add a cancel-collection operation* — rejected for V1: the chosen behavior is to let the debit finish. *Keep collecting after deactivation* — rejected: a new period is a new financial commitment.

## R-07. “Hide QR pay” is an in-app action, not a rewritten invoice PDF

- **Decision**: When a collection request for that period is `submitted`, My Payments does not offer the Membership period’s pay / open-QR action. The F1.03 invoice email and PDF stay as they are, so a Swiss QR slip may already have been delivered. If both the debit and a bank transfer settle, the period remains one paid outcome, `duplicate_receipt` is set, and Admins can see it. There is no refund screen.
- **Rationale**: Matches the clarification without changing lesson or camp invoice documents, and without pretending an emailed QR slip can be unsent.
- **Alternatives considered**: *Suppress the QR slip inside the PDF* — rejected: changes F1.03 document generation and still races the email. *Leave the pay button up* — rejected by the clarification.

## R-08. Paid and reversed are signals, not Membership transitions

- **Decision**: A period is paid only from a confirmed collection or from canonical reconciliation of its invoice (fully paid, same spirit as F1.03 partial payments). That inserts one `membership_payment_signals` row of kind `payment_confirmed`. A reversal inserts `payment_reversed`, clears the paid treatment, and is visible to Admins. `consumed_at` stays null for F1.09. Stale channel or accounting timestamps older than the stored status time do not overwrite.
- **Rationale**: FR-016, FR-020, FR-021, FR-026. This feature must not activate, pause, or cancel a Membership.
- **Alternatives considered**: *Update a Membership status column* — rejected: F1.09 does not exist here and must not be invented.

## R-09. Hourly collection run; accounting reconciliation stays on the existing job

- **Decision**: One new scheduled Edge Function, `membership-collection-run`, runs hourly. It polls mandate and collection status through the port and submits due collections. `bexio-reconcile` is extended to include Membership-period documents and to emit the same payment signal when reconciliation is the confirming source, without a second signal if the hourly run already wrote `payment_confirmed`. The existing six-hour schedule is unchanged for lessons and camps. The hourly run is what meets the one-hour signal target when the channel itself confirms.
- **Rationale**: SC-005. Reusing the six-hour job alone would miss the target. A second Bexio poller for every lesson invoice is unnecessary.
- **Alternatives considered**: *Change `bexio-reconcile` to hourly for all documents* — rejected: widens F1.03 rate-limit load for a Membership-only target. *Webhooks* — rejected: Bexio has none in the current integration, and the unconfigured channel has nothing to call.

## R-10. Authorization, PII, and tests follow existing gates

- **Decision**: Clients read only their rows through RLS. Mutations go through Edge Functions with `verify_jwt` and an in-function user check; the scheduler uses the existing Vault scheduler secret, not a user JWT. IBAN is an optional column, written only if a future configured channel requires it, and is never logged. Admins read academy-wide operational rows and the duplicate-receipt / reversal flags. Tests: Vitest for the client payload and forbidden copy; Deno for the port, idempotency, stale status, stop, and deactivation; SQL for RLS and the partial unique indexes.
- **Rationale**: Constitution §IV and §Testing. FR-011, FR-012, FR-029, FR-031.
- **Alternatives considered**: *Client writes mandates directly with RLS* — rejected: the channel call and idempotency must sit server-side.

No `NEEDS CLARIFICATION` remains. Live bank debit remains blocked until a contracted adapter replaces `UnconfiguredCollectionChannel`; that is an explicit non-goal of this plan, not an open spec question.
