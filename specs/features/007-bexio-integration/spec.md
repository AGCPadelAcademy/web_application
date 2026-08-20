# Feature Specification: Bexio Financial & Accounting Integration

**Feature Branch**: `007-bexio-integration`
**Created**: 2026-08-20
**Status**: Draft — clarifications resolved 2026-08-20 (Q1-A, Q2-A); ready for planning
**Input**: User description: "Integrate Bexio as the external financial and accounting system of the AGC Padel Academy web application. AGC remains the operational system of record (users, bookings, memberships, schedules, pricing, application-level payment state); Bexio becomes the financial/accounting system (accounting contacts, invoices, invoice PDFs, receivables, payment reconciliation, VAT/accounting workflows, financial reporting). No card payments. Preserve existing brownfield behavior."

> **Forward spec.** This document deltas against the brownfield baseline (`specs/baseline-system/requirements.md`, `specs/project-context/domain-model.md`, `specs/project-context/api-contracts.md`, `specs/baseline-system/supabase-backend.md`) and the live reverse specs `001`–`006`. It does not restate baseline behavior. External-system claims are grounded in the official Bexio API reference (docs.bexio.com, retrieved 2026-08-20) — see §"Verified External Capabilities".
>
> **Core architectural principle (binding):** AGC is the operational system; Bexio is the financial/accounting system. Bexio MUST NOT become the source of truth for any operational AGC domain data (users, players, memberships, bookings, coaches, schedules, courts, pricing, discounts, lifecycles, application-level payment state). AGC MUST NOT re-implement Bexio's accounting functionality (general ledger, VAT workflows, bank reconciliation UI, financial statements, expense accounting).

---

## Clarifications

### Session 2026-08-20

- Q: Invoice delivery channel post-cutover — in-app only, Bexio send-by-email, or both? → A: In-app only (view/download inside AGC); Bexio send-by-email is not used in V1.
- Q: Swiss VAT treatment of lesson prices (registered incl./excl./exempt)? → A: Unknown — deferred to the academy's accountant; VAT handling stays fully config-driven with no hardcoded default, and go-live remains blocked until the accountant confirms the Bexio tax configuration (FR-018).
- Q: Does V1 re-issue pre-integration bookings into Bexio (none / admin-triggered / bulk)? → A: No backfill in V1 — pre-integration bookings permanently keep their legacy documents; any future re-issuance requires its own explicitly specified feature.
- Q: Grace period for the FR-038 "proof approved but no Bexio payment" discrepancy flag? → A: 30 days from admin proof approval, configurable via `manual_paid_grace_days`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Bexio connection for the academy (Priority: P1)

An admin connects the AGC application to the academy's Bexio account once, via Bexio's OAuth 2.0 authorization flow. From then on, all server-side financial operations run under that connection without any further user interaction, and no credential or token is ever exposed to a browser client.

**Why this priority**: Every other capability (contacts, invoices, reconciliation) is impossible without an authenticated, server-side connection. This is the foundation slice and delivers a verifiable "integration is alive" outcome on its own.

**Independent Test**: An admin completes the connect flow in an admin settings area; the system then performs an authenticated read against the Bexio API and shows the connection as healthy. Disconnect/revoke is reflected immediately. No secret material appears in any browser-visible response, bundle, or log.

**Acceptance Scenarios**:

1. **Given** an admin on the integration settings area, **When** they start the Bexio connection, **Then** they are redirected to Bexio's consent screen and, after granting access, land back in AGC with the connection marked active.
2. **Given** an active connection, **When** time passes beyond the access token's validity, **Then** the system refreshes tokens automatically without admin involvement and continues operating.
3. **Given** the connection is revoked on the Bexio side, **When** the next financial operation runs, **Then** the system marks the connection as requiring re-authorization, surfaces this to an admin, and does not lose any queued financial operation.
4. **Given** any student or anonymous visitor, **When** inspecting any page, network response, or client configuration, **Then** no Bexio client secret, access token, or refresh token is observable.

---

### User Story 2 - A lesson purchase produces exactly one Bexio invoice (Priority: P1)

When a student completes the existing lesson-booking flow (reverse specs `001`/`002`), AGC ensures the corresponding financial document exists in Bexio: the customer's accounting contact is located or created once, and exactly one Bexio invoice is created for that booking — even if the operation is retried, times out, or is requested twice.

**Why this priority**: This is the core business value — every franc billed by the academy becomes visible in the accounting system without manual re-entry, while the booking UX stays exactly as it is today.

**Independent Test**: Create a booking as a student; verify in Bexio that one contact and one invoice exist, linked to that booking; then force a retry of the same operation and verify no second invoice or second contact appears.

**Acceptance Scenarios**:

1. **Given** a new booking by a customer never billed through Bexio before, **When** the financial operation executes, **Then** a Bexio contact is created for that customer, the mapping is persisted in AGC, and an invoice referencing the booking is created against that contact.
2. **Given** a returning customer already mapped to a Bexio contact, **When** a new booking is billed, **Then** the existing Bexio contact is reused and no duplicate contact is created.
3. **Given** a booking whose Bexio invoice already exists, **When** the same invoice-creation request is retried (user double-click, page reload, network retry, or recovery action), **Then** AGC returns/references the existing invoice and MUST NOT create a second Bexio invoice for the same booking.
4. **Given** an invoice-creation call that times out after the invoice was actually created in Bexio (response lost), **When** the system retries, **Then** it recovers the already-created invoice by its external reference instead of creating a duplicate.
5. **Given** the Bexio API is unreachable or returns an error, **When** a student completes a booking, **Then** the booking itself still succeeds (baseline behavior preserved, per FEAT-BKG-005/WF-006), the student-facing flow is not blocked, and the failed financial operation is recorded as pending for automatic retry or admin-triggered re-run.

---

### User Story 3 - Invoice document access from AGC (Priority: P1)

A student (and an admin) can open or download the official invoice document for a booking from within AGC, without needing a Bexio login. AGC does not build a second invoice-rendering engine; for every transaction integrated after go-live, the document of record is the Bexio-generated invoice PDF (Decision 2026-08-20, Q1-A). Pre-integration bookings keep their existing legacy AGC-generated documents unchanged.

**Why this priority**: Invoice self-service is an existing live capability (BC-05, BC-09, FEAT-PAY-002/003) that must keep working throughout and after the integration — backward compatibility is mandatory.

**Independent Test**: As a booking owner, open the invoice from My Payments; as a different student, attempt the same and be denied; as an admin, open any booking's invoice.

**Acceptance Scenarios**:

1. **Given** a booking with a Bexio-issued invoice, **When** the owner or an admin requests the document in AGC, **Then** the system delivers the Bexio-generated invoice PDF (or the still-valid legacy document for pre-integration bookings).
2. **Given** a student attempting to open another student's invoice, **When** the request is processed, **Then** it is denied (same ownership rule as FEAT-INV-005).
3. **Given** the financial document is temporarily unavailable from Bexio, **When** the user requests it, **Then** the system returns a clear, non-technical error and does not corrupt or delete any AGC-side record.

---

### User Story 4 - Bank payments become visible in AGC via reconciliation (Priority: P2)

When a customer pays a Bexio invoice by Swiss bank transfer (QR invoice), and that payment is recorded in Bexio (via the academy's bank reconciliation in Bexio or a manual entry there), AGC learns about it and reflects the resulting payment state on the affected booking/invoice — without an admin typing anything into AGC (Decision 2026-08-20, Q2-A: Bexio-recorded payment is the authoritative paid signal; the existing proof-upload flow remains as the dispute/manual path).

**Why this priority**: This closes the loop `AGC transaction → Bexio invoice → Swiss QR / bank transfer → bank payment → Bexio reconciliation → AGC payment state`. It removes today's purely manual "did they pay?" check, but it depends on the academy's bank-feed habits inside Bexio, so it ships after invoicing works.

**Independent Test**: With a synced invoice outstanding, record the payment in a Bexio test account; after at most one synchronization interval, the AGC view of that transaction shows the payment (amount, date), and repeated syncs never double-apply it.

**Acceptance Scenarios**:

1. **Given** an outstanding invoice, **When** Bexio records a full payment for it, **Then** after the next synchronization run the corresponding transaction reflects "paid" with the payment date and is confirmed without admin action.
2. **Given** a partial payment recorded in Bexio, **When** synchronization runs, **Then** AGC reflects a partially-paid state with the outstanding amount, and the booking is NOT treated as fully paid.
3. **Given** a payment that was already synchronized once, **When** subsequent synchronization runs execute, **Then** the payment is not applied twice and the state does not flap.
4. **Given** a synchronization run that fails or is delayed, **When** the next successful run executes, **Then** all intermediate payment changes are picked up — synchronization is idempotent and order-safe (a stale run never overrides newer state).
5. **Given** a booking whose payment proof is still awaiting admin review, **When** reconciliation records full payment for its invoice, **Then** the booking is confirmed and the pending proof is flagged as superseded (no admin action required); the proof record itself is retained.
6. **Given** an admin-approved proof whose payment never appears in Bexio within the defined grace period, **When** synchronization runs, **Then** the transaction is flagged for admin review as a reconciliation discrepancy (FR-038).

---

### User Story 5 - Cancellation and refund handling (Priority: P2)

When a booking that has not been paid is cancelled in AGC, the corresponding Bexio invoice is cancelled programmatically so receivables stay clean. When money has already moved (paid bookings, partial payments, corrections), AGC records the operational truth (cancelled/refund agreed) and the financial correction (credit note / refund booking) is executed in Bexio — manually in V1, because Bexio does not offer a credit-note API (verified limitation, see research findings).

**Why this priority**: Unpaid cancellations are common (plan changes, no-shows before payment) and must not leave phantom receivables. Paid refunds are rarer and legally sensitive; a documented manual workflow in Bexio is safer than inventing automation around an API capability that does not exist.

**Independent Test**: Cancel an unpaid, invoiced booking → the Bexio invoice shows as cancelled. Cancel a paid booking → AGC marks the operational state and the admin sees an explicit "financial correction required in Bexio" task/indicator; no automatic money movement is attempted.

**Acceptance Scenarios**:

1. **Given** a booking in an unpaid state with an issued Bexio invoice, **When** the booking is cancelled, **Then** the Bexio invoice is cancelled via API and AGC persists that cancellation state.
2. **Given** a paid booking that is cancelled with a refund agreed, **When** the cancellation executes, **Then** AGC records the refund expectation against the transaction and flags it for manual financial processing in Bexio, without attempting a programmatic credit note.
3. **Given** a cancellation request while Bexio is unavailable, **When** the Bexio-side cancellation fails, **Then** the AGC-side operational cancellation still completes (or is queued per the cancellation feature's own rules) and the pending financial cancellation is retried or surfaced to an admin — the two systems never silently diverge.
4. **Given** an invoice that Bexio refuses to cancel (e.g., already paid or locked in a closed business year), **When** the cancel attempt fails, **Then** AGC surfaces the conflict to an admin instead of forcing state.

---

### User Story 6 - Admin financial overview without a second accounting dashboard (Priority: P3)

An admin sees operationally useful financial information inside the existing admin area — payment status, invoice status, Bexio document reference, outstanding amounts — and a link/action to the corresponding record in Bexio for anything beyond that. AGC deliberately does not rebuild financial statements, the general ledger, VAT workflows, bank reconciliation, or any other Bexio dashboard capability.

**Why this priority**: Valuable for daily operations ("who still owes money?") but strictly read-only aggregation over data already synchronized by stories 2–4. It is independently shippable and deliberately minimal to protect the "no second ERP" principle.

**Independent Test**: An admin opens the financial overview, identifies all outstanding payments, and follows a reference link to the matching Bexio record for one of them.

**Acceptance Scenarios**:

1. **Given** synchronized invoices, **When** an admin opens the financial area, **Then** they see per-transaction payment/invoice status, outstanding indicator, and the Bexio reference.
2. **Given** a transaction whose financial operation failed or is pending retry, **When** an admin views it, **Then** the failure state and a re-run action are visible.
3. **Given** any financial report, ledger view, or VAT workflow need, **When** evaluating AGC, **Then** these remain exclusively in Bexio — AGC links out instead of re-implementing.

---

### Edge Cases

- **Bexio unavailable at booking time**: booking succeeds (baseline FEAT-BKG-005/WF-006); the financial operation is persisted as pending and retried with backoff; no data is lost or corrupted.
- **Authentication expired / revoked**: operations pause safely; admin is notified to re-authorize; queued operations resume after reconnection.
- **Invoice created but response lost**: recovery lookup by the persisted external reference (Bexio-side searchable reference) prevents duplicates.
- **Duplicate request / double-click / page reload**: same external reference → same invoice; AGC never stores two invoice references for one financial event.
- **Reconciliation delayed or bank payment arrives late**: payment state converges on the next sync; the student-facing state remains consistent with the last confirmed state; no partial flapping.
- **Payment applied to the wrong invoice in Bexio**: AGC must key reconciliation strictly on the invoice↔booking mapping, never on amount/name heuristics.
- **Proof uploaded for an already-reconciled paid transaction**: the proof is retained and flagged as superseded; it MUST NOT regress the paid state.
- **Customer data sync failure (contact create/update fails)**: invoice creation for that transaction is postponed/retried; the failure is visible to admins; the booking itself is unaffected.
- **Partial system outage (AGC DB ok, Bexio ok, sync worker dead)**: operational flows keep working; sync backlog drains when the worker recovers.
- **Rate limiting (Bexio 429)**: sync and retries respect the provider's rate-limit signals and back off instead of hammering.
- **Pre-integration bookings**: bookings invoiced by the legacy AGC generator keep their existing documents and behavior; they are never re-invoiced in Bexio (no backfill in V1 — Clarification 2026-08-20).
- **Profile changed after contact creation**: billing-relevant profile changes are propagated to the mapped Bexio contact on the next financial operation (update-if-mapped), never creating a second contact.

---

## Requirements *(mandatory)*

### Functional Requirements

#### A. Integration infrastructure & security

- **FR-001**: The system MUST authenticate to Bexio server-side using Bexio's supported OAuth 2.0 Authorization Code flow (with refresh tokens). Personal Access Tokens MUST NOT be used for the production integration (60-day validity, full scope — unsuitable).
- **FR-002**: Bexio credentials (client id/secret, access tokens, refresh tokens) MUST exist only in server-side secret storage (Edge Function secrets / equivalent). No Bexio credential, token, or secret material MUST ever be shipped to or readable by the browser client.
- **FR-003**: The integration MUST request the least-privilege scope set required for V1: contact read/write, invoice read/write, and offline (refresh-token) access. Accounting, banking, payroll, purchase, or expense scopes MUST NOT be requested in V1.
- **FR-004**: The system MUST refresh access tokens automatically before expiry, MUST replace the stored refresh token on every refresh (Bexio rotates them), and MUST detect irrecoverable authorization failure (revocation, 1-year offline-session idle limit) and surface a "re-authorization required" state to admins.
- **FR-005**: Only an admin (`profiles.role = 'admin'`, per ACT-003) MUST be able to connect, disconnect, or view the connection status of the Bexio integration.
- **FR-006**: Every outbound Bexio call MUST have a bounded timeout and a retry policy that (a) retries transient failures (5xx, network, timeouts) with exponential backoff, (b) honors Bexio rate-limit responses (HTTP 429 and `RateLimit-*` headers), and (c) never retries non-retryable client errors (4xx other than 429).
- **FR-007**: All integration operations MUST be observable: every external call outcome (success, failure class, retry count, duration) MUST be recorded server-side in a form an admin can inspect, without logging credentials, tokens, or unnecessary personal financial data (constitution §IV; safe-logging rule).
- **FR-008**: A Bexio outage or failure MUST NOT corrupt, block, or roll back AGC operational data (bookings, profiles, proofs). Financial operations that cannot complete MUST be persisted as pending and remain recoverable/retryable (manually by an admin and/or automatically).

#### B. Customer ↔ Bexio contact synchronization

- **FR-009**: AGC MUST persist a provider-keyed mapping between the AGC customer (profile) and the external accounting contact identifier, so that every financial operation can locate the mapped contact deterministically. The mapping MUST be provider-neutral in shape (provider + external id), not a Bexio-named column scattered across domain tables.
- **FR-010**: On the first financial operation for a customer, the system MUST locate the mapped Bexio contact, or — absent a mapping — search Bexio for an existing contact for that customer before creating one, to prevent accidental duplicates. AGC (the profile) remains the primary customer database; Bexio is never the source of truth for customer data.
- **FR-011**: Contact creation in Bexio MUST carry the customer's billing-relevant data (name, billing address, email) as captured in the complete AGC profile (FEAT-PRF-003). Billing-relevant profile changes MUST be propagated to the mapped contact on the next financial operation (update-in-place), never by creating a second contact.
- **FR-012**: Contact synchronization failures MUST NOT block or alter the booking; they postpone the dependent financial operation and are surfaced per FR-007/FR-008.

#### C. Invoice creation

- **FR-013**: Eligible AGC financial transactions MUST be able to generate a Bexio invoice. V1 eligibility = the currently live purchase flow only: lesson bookings (reverse specs `001`/`002`). Memberships, packages, events/camps, trips, and tournaments are out of V1 (they are not live purchase flows — baseline §7) but the design MUST accommodate them as future sources without rework of the integration core.
- **FR-014**: The domain layer MUST express financial intentions (e.g., "issue invoice for booking X", "record payment", "cancel invoice") without depending on Bexio-specific endpoints or payload shapes. All provider-specific logic MUST be isolated behind a provider abstraction so the provider can theoretically be replaced. (Constitution §VII applies: one provider in V1 — no speculative provider-selection UI or multi-provider config.)
- **FR-015**: Bexio invoices MUST carry: the customer's billing information, line item(s) reflecting the AGC charge (designation, quantity, unit price), currency (CHF, per XR-001), applicable taxes/VAT per the academy's Bexio configuration, and a reference back to the originating AGC transaction.
- **FR-016**: The AGC↔Bexio correlation MUST be two-sided and durable: (a) AGC persists the external invoice identifier against the AGC financial record, and (b) the Bexio invoice carries the AGC-side reference in Bexio's API-managed reference field (`api_reference`), which is searchable — enabling duplicate checks and recovery after lost responses.
- **FR-017**: Invoice creation MUST be idempotent per financial event: before creating, the system MUST check for an already-persisted external reference locally and, where local state is missing/uncertain (lost response), check Bexio by external reference. A retry MUST NOT create a second invoice for the same booking. One AGC financial record MUST map to at most one active external invoice.
- **FR-018**: Bexio invoice numbering/branding MUST follow the Bexio account's configuration (document series, templates/layout). AGC branding requirements (CAG Padel Academy GmbH legal identity on financial documents, per Decision 2026-08-19) MUST be satisfied through the Bexio template configuration, not by post-processing PDFs in AGC. Go-live under Q1-A requires these Bexio-side prerequisites (branded document template, QR-capable bank account, accountant-confirmed VAT/tax configuration) to be verified before the first integrated transaction is issued.
- **FR-019**: The system MUST be able to retrieve the Bexio-generated invoice PDF for an issued invoice (verified capability: base64 PDF export endpoint). AGC MUST NOT build a second invoice-rendering engine. **Cutover (Decision 2026-08-20, Q1-A):** the Bexio-generated PDF is the document of record for every new integrated transaction; the legacy AGC invoice generator is no longer invoked for new bookings after go-live, while historical documents remain accessible unchanged (FR-028).

#### D. Swiss QR / bank-transfer payment flow & reconciliation

- **FR-020**: The payment flow MUST remain Swiss-QR-invoice/bank-transfer only (WF-007, XR-005). No card processing, card providers, or card-specific infrastructure may be introduced.
- **FR-021**: QR-invoice payment parts MUST come from Bexio's invoice rendering (Bexio invoices carry QR-invoice linkage; QR-slip rendering depends on the Bexio account's bank/template configuration). The plan MUST verify the academy's Bexio configuration produces valid Swiss QR payment slips; any gap MUST be documented rather than worked around in AGC.
- **FR-022**: Because Bexio exposes no documented webhook/event mechanism (verified 2026-08-20 against the official API reference), AGC MUST synchronize payment state via scheduled polling/reconciliation of invoice payment data. Synchronization cadence is a planning decision (must respect rate limits, FR-006) and MUST be admin-visible.
- **FR-023**: AGC determines an invoice's payment position from Bexio's recorded payments/totals (e.g., received vs. remaining amounts), mapping them onto AGC's financial status. Payment application MUST be keyed strictly on the persisted invoice↔booking mapping.
- **FR-024**: Payment-state synchronization MUST be idempotent and order-safe: re-processing the same Bexio state MUST NOT duplicate effects, and a stale sync result MUST NOT override newer AGC state (last-write-wins by source timestamp/version, defined at planning).
- **FR-025**: AGC's payment lifecycle MUST extend the existing model minimally. Existing live states (`bookings.payment_status`: `pending`/`confirmed`/`cancelled`; `invoices.status`: `pending`/`paid`/`cancelled`) keep their meaning. The integration adds a financial synchronization view per transaction covering: not synced/pending sync, awaiting bank payment, partially paid, paid, cancelled, refunded, sync failed. Exact storage and enum values are decided at planning. Per Decision 2026-08-20 (Q2-A), a reconciled full payment MUST drive the existing booking/invoice fields to their confirmed/paid end state (FR-035); the booking state machine itself gains no new operational states.
- **FR-026**: Every payment-state transition sourced from Bexio MUST record when the state was synchronized and the external state it reflects (reconciliation timestamp), so admins can distinguish "AGC knows" from "bank/Bexio recorded".

#### E. Invoice access from AGC

- **FR-027**: Students MUST be able to view/download the invoice document for their own transactions from the existing payments area; admins for any transaction. Authorization MUST be enforced server-side, mirroring FEAT-INV-005 (owner or admin).
- **FR-028**: For pre-integration bookings with only a legacy AGC PDF, the existing document MUST remain accessible unchanged (backward compatibility, constitution §III).
- **FR-029**: Invoice documents served from AGC MUST come from Bexio's generated PDF (post-cutover per Q1); AGC MUST NOT maintain a parallel invoice renderer for Bexio-managed transactions.

#### F. Cancellation, refunds, corrections

- **FR-030**: When an unpaid transaction is cancelled in AGC, the corresponding Bexio invoice MUST be cancelled via Bexio's invoice-cancel capability, and AGC MUST persist the outcome. (Customer-facing cancellation UX itself belongs to the separate `cancel-reservation` feature; this spec covers the financial side effect and an admin-triggerable path.)
- **FR-031**: Refunds of received payments, partial refunds, and payment corrections MUST be handled in Bexio (manual or hybrid workflow) in V1, because Bexio does not expose credit notes via API (verified limitation). AGC MUST record the refund expectation/state against the transaction and surface pending financial corrections to admins so the two systems cannot silently diverge.
- **FR-032**: If Bexio refuses a programmatic cancellation (already paid, closed/locked business year, or other provider rule), AGC MUST surface the conflict for manual resolution instead of forcing inconsistent state.

#### G. Admin financial visibility (bounded)

- **FR-033**: AGC MUST expose only operationally useful financial information: payment status, invoice status, outstanding indicators, recent transactions, external invoice reference, sync/failure state, and a navigation path to the corresponding Bexio record. The confirmation source (Bexio-reconciled vs. manual admin) MUST be distinguishable per transaction.
- **FR-034**: Full accounting capabilities MUST remain exclusively in Bexio: financial statements, general ledger, detailed VAT workflows, bank reconciliation interface, professional accounting reports, expense accounting, fiduciary operations. AGC MUST NOT rebuild any of these.

#### H. Reconciliation authority & dispute handling (Decision 2026-08-20, Q2-A)

- **FR-035**: A Bexio-recorded full payment MUST automatically transition the affected transaction to the same end state an admin proof approval produces today (booking confirmed, payment confirmed, invoice paid per the `invoice-lifecycle` decision) — without admin action.
- **FR-036**: The payment-proof upload and admin approve/reject capability (specs `003`/`004`) MUST remain available as the dispute and manual path (e.g., reconciliation lag, provider outage, non-standard payments). An admin approval remains a valid manual confirmation.
- **FR-037**: A payment proof still awaiting review for a transaction that becomes reconciled-paid MUST be flagged as superseded (no admin action required); the proof record is retained (append-only, per domain model R6).
- **FR-038**: Reconciliation discrepancies MUST be surfaced for admin review: (a) proof approved but no matching Bexio payment after the defined grace period of **30 days from admin approval** (Clarification 2026-08-20; configurable via `manual_paid_grace_days`); (b) payment recorded against a cancelled invoice; (c) overpayment beyond the invoice total.

---

### Key Entities *(feature involves data)*

- **Accounting Connection** (new): the single AGC↔Bexio link — provider identity, non-secret configuration, authorization status (active / needs re-authorization), last health check. Secret material lives only in server-side secret storage (FR-002).
- **External Contact Mapping** (new): AGC profile ↔ provider contact id, provider-keyed, with sync timestamps. Owned by AGC; Bexio contact is a projection.
- **External Invoice Reference** (extends the existing **Invoice** concept rather than a parallel structure where possible): AGC financial record ↔ provider invoice id + provider document number, synchronization state, last-synced-at, and the external payment position (received/remaining). Smallest durable model per constitution §V; exact placement (extend `invoices` vs. companion table) is a planning decision.
- **Payment Synchronization record** (conceptual; may be fields on the invoice reference rather than a table): per-transaction financial sync state (FR-025), reconciliation timestamp (FR-026), and failure/retry bookkeeping (FR-008).
- Existing entities reused unchanged in meaning: **Profile** (customer master), **Booking** (operational transaction, lifecycle owner), **Payment Proof** (existing verification evidence), **Invoice** (AGC financial record).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of new eligible purchases produce exactly one accounting-system invoice; 0 duplicate invoices across retries, reloads, or recovered timeouts (verifiable by sampling Bexio against AGC financial records).
- **SC-002**: A payment recorded in the accounting system confirms the corresponding AGC transaction — without admin action — within one synchronization interval (target ≤ 1 hour), with 0 double-applied payments over any rolling 30-day window.
- **SC-003**: During an accounting-system outage, 100% of bookings still complete and 0 financial operations are lost — all missed operations become recoverable without re-entering data after the outage ends.
- **SC-004**: Students and admins can open the official invoice document from AGC in under 10 seconds in the normal case; unauthorized access attempts are denied 100% of the time.
- **SC-005**: Admins can answer "which transactions are still unpaid?" from AGC alone for at least 95% of daily checks; full accounting questions continue to be answered in Bexio.
- **SC-006**: Security audit confirms 0 Bexio secrets or tokens in browser bundles, client responses, or client-readable storage; all integration calls originate server-side.
- **SC-007**: An admin can detect and re-run a failed financial operation from within AGC in under 2 minutes, without touching server logs or the accounting system.

---

## Verified External Capabilities vs. Desired AGC Behavior

Research source: official Bexio API reference (docs.bexio.com), retrieved in full on 2026-08-20; corroborating integrator sources (n8n Bexio node docs, Maesn) for the webhook gap. This table separates **what Bexio verifiably supports** from **what AGC wants**, per the feature brief.

| Concern | Verified Bexio capability (official docs) | Desired AGC behavior | Gap / decision |
|---|---|---|---|
| Authentication | OAuth 2.0 Authorization Code + OpenID Connect via `auth.bexio.com/realms/bexio`; refresh tokens with `offline_access`; refresh tokens rotate on use; offline session idle-timeout 1 year; PATs exist but expire after 60 days with full scopes | Unattended server-side integration | Use auth-code flow with `offline_access`; PAT only acceptable for manual setup/testing |
| Scopes | `contact_show`/`contact_edit`, `kb_invoice_show`/`kb_invoice_edit` (write implies read), plus `accounting`, `bank_account_show`, etc. | Least privilege | V1 requests only contact edit + invoice edit + offline_access |
| Contacts | Full CRUD + search + bulk create; no idempotency key, no external-reference field on contacts | Find-or-create, no duplicates | AGC-side mapping table is authoritative; search-by-email fallback before create |
| Invoice creation | `POST /2.0/kb_invoice`; positions (custom/article), currency id, `mwst_type`/tax ids, `bank_account_id`, header/footer; no idempotency key | Idempotent invoice per booking | Idempotency enforced AGC-side via persisted external id + `api_reference` search |
| Correlation | `api_reference` field: "can only be read and edited by the api… save references to other systems"; searchable via `POST /2.0/kb_invoice/search` | Two-sided durable correlation | Store AGC booking/invoice reference in `api_reference` |
| Invoice lifecycle | issue, revert_issue (issued→draft), cancel, mark_as_sent, send-by-email, copy, delete | Cancel unpaid invoices programmatically | Supported for V1 (FR-030); provider refusals surfaced (FR-032) |
| Invoice PDF | `GET /2.0/kb_invoice/{id}/pdf` returns JSON with base64 PDF content | Serve official document in AGC | Backend fetches and serves; no second renderer |
| Invoice status/totals | `kb_item_status_id`, `total_received_payments`, `total_remaining_payments`, `total_credit_vouchers`; UI-level statuses: draft/pending/paid/partially paid/overdue/cancelled | Map payment position to AGC states | Exact `kb_item_status_id` mapping confirmed at planning |
| Payments on invoices | List/create/fetch/delete payments per invoice (`/2.0/kb_invoice/{id}/payment`) | Read bank payments; optional manual payment recording | Reconciliation reads payments; write path available if ever needed |
| Swiss QR invoices | Invoice object carries `esr_id` + `qr_invoice_id`; QR payment slip rendered on invoice PDF when the Bexio account/bank/template is configured for it | QR-bank-transfer flow end-to-end | Configuration prerequisite in Bexio account (QR-IBAN + template), verified at planning, not an AGC feature |
| Bank transactions (incoming) | No API for incoming bank feed/camt retrieval; `/4.0/banking/payments` covers **outgoing** payments only (with `qr_reference_number` for QR bills) | "Bank receives payment → AGC sees it" | Incoming payments must be reconciled **inside Bexio** (bank sync or manual); AGC polls invoice payment state |
| Webhooks / events | **None documented** in the official API reference (full-text search, 2026-08-20); integrator ecosystem (n8n, Maesn) corroborates polling as the standard pattern | Event-driven payment updates | Scheduled polling/reconciliation (FR-022). Unverified third-party blog claims of a Bexio webhook-registration UI (Apr 2026) MUST be re-checked at planning; do not design around it |
| Credit notes / refunds | FAQ (official docs): "Credit Notes are not available" via API | Refund workflow | Manual/hybrid workflow in Bexio for V1 (FR-031); AGC tracks refund state |
| Accounting representation | Manual entries API (single/compound/group), journal read, accounts, taxes, VAT periods, business years | Bank-transfer payments represented in accounting | Handled inside Bexio by its reconciliation; AGC does not post journal entries in V1 |
| Rate limits | Per-company per-minute limit; HTTP 429 + `RateLimit-Limit/Remaining/Reset` headers; numeric threshold not published in docs | Respect limits, no hammering | Backoff honoring 429/headers (FR-006); poll cadence sized at planning |
| Deletions | `DELETE` is permanent | — | AGC never deletes Bexio records; cancel-only semantics |

---

## Brownfield Impact (existing components affected)

Required by the brownfield workflow (AGENTS.md / brownfield rules). No unrelated refactoring; all changes are additive unless marked.

| Area | Impact |
|---|---|
| Booking flow (`src/pages/LessonsPage.jsx`, `src/lib/bookings.js`) | **Additive**: after the existing booking insert, trigger the financial operation (invoice issuance) via the new provider-abstracted path. The current sequential non-transactional insert→invoice pattern (known gap in reverse spec `002`) is preserved as the fallback-safe baseline; the integration adds persisted pending-state recovery. |
| Invoice generation (Edge Function `generate-invoice-pdf` v22) | **Cutover decided (Q1-A)**: not invoked for new integrated bookings after go-live; historical PDFs remain accessible (FR-028); the function stays deployed during the transition for legacy recovery paths (FEAT-PAY-003 on pre-integration bookings). |
| My Payments (`src/pages/PaymentsPage.jsx`) | **Additive**: invoice-document access routes to Bexio-backed documents for integrated transactions; legacy PDFs unchanged. Financial sync state may be surfaced on the student's own transactions (read-only). |
| Admin (`PaymentVerificationPanel.jsx` / admin area) | **Additive**: financial overview (FR-033), sync-failure surfacing and re-run (FR-008/FR-007), connection management (FR-005). The live proof-verification flow (spec `004`) is retained as the dispute/manual path (Decision Q2-A, FR-036–FR-038). |
| Data model | **New, minimal, provider-neutral**: accounting-connection state, contact mapping, invoice external-reference + sync state (per Key Entities). Migrations will be numbered per constitution §V and defined in the plan. No changes to existing column semantics; no schema-debt cleanup piggybacked (constitution §V debt rule). |
| RLS / security | New tables get least-privilege RLS (owner/admin reads where user-facing; service-role-only writes), matching the migration `0006`/`0007` pattern. |
| Edge Functions | New server-side function(s) for OAuth callback/token handling, financial operations, and scheduled reconciliation. All run `verify_jwt` + in-function checks where user-invoked, per constitution §IV. The scheduled reconciler is service-side only. |
| Specs to update after implementation | `specs/baseline-system/requirements.md` (BC-05/06/08/09 deltas), `specs/project-context/api-contracts.md` (new functions/endpoints), `specs/project-context/domain-model.md` (new entities/relationships), `specs/baseline-system/supabase-backend.md` (schema snapshot), reverse specs `002`/`003`/`004` where behavior changes per Q1/Q2. |

**Backward-compatibility risks identified**: (1) invoice-document cutover changing the customer-visible PDF/numbering (cutover decided Q1-A; mitigated by FR-028 and the go-live prerequisite verification in FR-018); (2) payment-state authority change colliding with the live admin proof flow (resolved Q2-A; mitigated by the ordering rules FR-024/FR-025 and the retained manual path FR-036); (3) polling load vs. Bexio rate limits (mitigated by FR-006/FR-022 cadence sizing); (4) duplicate contacts/invoices in Bexio from retries (mitigated by FR-010/FR-016/FR-017).

---

## Scope

### V1 (this feature)

- Secure server-side Bexio connection (OAuth 2.0 auth-code flow, token storage/refresh/rotation, least-privilege scopes, admin-managed connect/disconnect/status).
- Contact find-or-create mapping with duplicate prevention and billing-data propagation.
- Invoice creation for the live lesson-booking purchase flow — idempotent, correlated, recoverable.
- Invoice document retrieval (Bexio PDF) for owner/admin, with legacy-document compatibility; delivery is in-app only — Bexio send-by-email is not used in V1 (Clarification 2026-08-20).
- Scheduled payment reconciliation (polling) reflecting Bexio payment position into AGC per Q2's resolution.
- Programmatic cancellation of unpaid Bexio invoices; manual/hybrid refund workflow with AGC-side tracking.
- Failure handling, retry queue, observability, and the bounded admin financial overview.

### Future scope (design-compatible, NOT implemented)

- Invoicing for memberships/packages/events/trips/tournaments as those purchase flows ship (see `memberships-credits`, `trips-tournaments` in `specs/features/README.md`).
- Automatic bank-transaction-driven reconciliation depth (if/when Bexio exposes incoming-payment APIs); adoption of any officially documented Bexio webhook mechanism.
- Credit-note automation when Bexio ships a credit-note API.
- Expenses/supplier workflows, VAT/account mappings, accountant/fiduciary workflows, advanced financial reporting — all stay in Bexio.
- Additional accounting providers behind the same abstraction (only when a second provider is a concrete requirement — constitution §VII).
- Additional payment methods if ever required (out of scope by mandate; no card infrastructure).

---

## Non-goals

- Re-implementing any Bexio accounting capability inside AGC (ledger, VAT, statements, reconciliation UI, expenses, fiduciary tooling).
- Making Bexio the source of truth for any operational AGC data.
- Card payments, Stripe, or any card-payment-specific infrastructure (XR-005).
- Changing the live booking lifecycle, the proof-upload flow, or admin verification semantics (specs `001`/`003`/`004`) beyond what Q1/Q2 resolutions explicitly decide.
- Retroactive migration or re-issuance of pre-integration invoices — **none in V1** (Clarification 2026-08-20): legacy bookings keep legacy documents permanently; no backfill UI or job is built; any future re-issuance is its own feature spec.
- Event-driven infrastructure (message bus, domain-event store): not justified by current complexity — synchronous invocation with persisted sync state and retry is sufficient (constitution §VII). The conceptual events listed in the brief (InvoiceRequested, PaymentReconciled, …) are realized as state transitions on the payment-synchronization record, not as a bus.
- `plan.md` / `tasks.md` / production code — this is a specification only.

---

## Open questions (non-blocking for spec approval; resolved at planning)

- Exact `kb_item_status_id` ↔ AGC sync-state mapping; whether to derive "paid" from status or from received/remaining totals (lean: totals, per FR-023).
- ~~Whether Bexio's `send`-by-email should be used for invoice delivery, or AGC keeps surfacing documents in-app only~~ — resolved 2026-08-20: **in-app only in V1**; Bexio send-by-email is not invoked (may be enabled later without code changes).
- ~~VAT treatment of lesson prices (VAT-registered status, inclusive/exclusive pricing)~~ — clarified 2026-08-20: **unresolved business fact, owned by the accountant**; implementation MUST keep VAT/tax fully configuration-driven (no hardcoded rate or inclusivity), and it is a hard go-live prerequisite (FR-018) — no live invoice may be issued before accountant confirmation.
- Whether the unverified April-2026 third-party claim of a Bexio webhook-registration UI reflects a real, supported product feature (re-check official sources at planning; polling remains the designed mechanism regardless).
- ~~Whether the legacy static per-amount QR files in the `qr-codes` bucket remain needed post-cutover~~ — resolved by Q1-A: not needed for new transactions (they are inputs to the legacy generator only); the bucket is retained for historical continuity.
- ~~Grace period and detection rule for the "proof approved but no matching Bexio payment" discrepancy flag (FR-038)~~ — resolved 2026-08-20: 30 days from admin proof approval, configurable (`manual_paid_grace_days`); detection runs in the scheduled reconciliation worker.
- Contact number assignment strategy in Bexio (auto `nr` vs. academy convention).

---

## Assumptions

- The academy operates (or will operate) a Bexio account for CAG Padel Academy GmbH with Swiss QR-invoice capability configured (QR-IBAN bank account, invoice template with QR payment part). This is a business prerequisite, not an AGC feature.
- An admin of the AGC application has the authority to complete Bexio OAuth consent for the academy.
- The only live, chargeable purchase flow today is lesson booking (baseline §3/§7); V1 integrates exactly that flow.
- The payment method remains Swiss QR invoice + bank transfer only. The proof-upload/admin-verification flow remains available as the dispute and manual path, while Bexio reconciliation is the authoritative paid signal for integrated transactions (Decision 2026-08-20, Q2-A).
- Supabase Edge Functions (Deno) are the server-side execution environment; no custom API server exists or is introduced (architecture §0 of api-contracts.md; constitution Technology Stack).
- Pre-integration bookings/invoices are left untouched; coexistence is permanent for historical records.
- Single academy, single Bexio company (single-tenant per XR-002); multi-company Bexio setups are out of scope.
- Synchronization is pull-based and does not need to be real-time; an interval of up to one hour is acceptable to the business (confirmed via SC-002 target).

---

## Relationship to other specs

| Spec | Relationship |
|---|---|
| `specs/baseline-system/requirements.md` | Baseline this feature deltas against (BC-04/05/06/07/08/09, FEAT-BKG-*, FEAT-INV-*, FEAT-PAY-*, WF-005/007/008, XR-001/003/005) |
| `specs/features/001-lesson-booking/spec.md` | Trigger point of the financial operation |
| `specs/features/002-invoice-generation/spec.md` | Legacy invoice generator — cutover for new bookings per Decision Q1-A; historical documents unaffected |
| `specs/features/003-payment-proof-upload/spec.md` | Proof upload retained as dispute/manual path per Decision Q2-A |
| `specs/features/004-admin-payment-verification/spec.md` | Admin verification becomes the manual/dispute path per Decision Q2-A |
| `specs/features/006-roles-and-permissions/spec.md` | Admin-only integration management reuses the live role model |
| `specs/project-context/domain-model.md` | New entities (connection, contact mapping, invoice reference) extend it after implementation |
| `specs/project-context/api-contracts.md` | New Edge Functions/contracts added there after implementation |
| Future: `cancel-reservation`, `invoice-lifecycle`, `memberships-credits` | Downstream consumers of this integration; cancellation UX owns its booking-side rules, this spec owns the financial side effects |
