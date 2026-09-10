# Feature Specification: Membership Automatic Collection (eBill Direct Debit) (F1.26)

**Feature Branch**: `011-membership-automatic-collection`

**Created**: 2026-09-10

**Status**: Draft

**Input**: GitHub issue #54 — F1.26 Membership automatic collection (eBill Direct Debit). Give academy clients an in-app option to pay a recurring adult Membership automatically. AGC must create and drive the mandate, chargeable membership period, invoice, collection request, and payment-confirmed signal. Clients must not be asked to open their bank and configure Automatic transaction, standing approval, or a standing order. QR / bank-transfer invoice remains the fallback.

> **Forward spec (delta).** Living as-is for invoicing and reconciliation remains [`007-bexio-integration`](../007-bexio-integration/spec.md) (F1.03). Living as-is for lesson booking remains [`001-lesson-booking`](../001-lesson-booking/spec.md). Living as-is for Camps billing remains [`010-padel-camps`](../010-padel-camps/spec.md) (F1.25). Adult Membership domain, Group fixed-place, and lifecycle remain **F1.09** (GitHub issue #14 — Needs Spec; no feature folder yet). This file states only what F1.26 adds: the issuer-initiated collection channel that F1.09 explicitly deferred.
>
> GitHub feature ID is **F1.26**. Spec folder follows sequential numbering under `specs/features/` (`011-membership-automatic-collection`), not the issue path `specs/phase-1/F1.26-membership-automatic-collection/`.

---

## Gap analysis (current → target)

Inspected: GitHub issue #54, F1.09 issue #14, constitution, project context, domain model, baseline requirements (`WF-007`, `XR-005`, `FEAT-PAY-*`), F1.03 (`007`), F1.25 (`010`) billing extension, unused `memberships` / `credits` tables, live payment path. Confirmed unless marked assumption.

| F1.26 rule | Current | This spec |
|---|---|---|
| Client opts into automatic Membership collection from AGC | Payment is per-invoice Swiss QR / bank transfer. F1.03 007 Session 2026-08-25 noted future Membership “QR each month or domiciliation” and left it out of 007. F1.09 defers automatic activation from confirmed payment as Phase 2. | **Add** an in-app collection-method choice on a Membership. Declining auto-pay keeps QR / invoice payment. The product MUST NOT claim that AGC can switch on the bank’s Automatic transaction / standing approval. |
| Issuer-initiated Direct Debit mandate | No mandate, no collection rail. AGC does not connect to SIX. Bexio has no customer Direct Debit API (007). | **Add** a Direct Debit **authorization proposal** through the contracted issuer channel (network partner or bank eBill Web — channel chosen in planning). Persist a provider-neutral mandate mapping. One bank-side mandate approval is required by the Swiss eBill Direct Debit scheme; it is not per-invoice bank setup and is not Automatic transaction. |
| Recurring collection of a Membership period | Lesson invoices use `booking_id`. Camp invoices use `camp_registration_id` (F1.25). 007 FR-013 reserved memberships as a future financial source. Unused `memberships` table has `next_charge_date` but 0 rows and no collection. | **Consume** a chargeable Membership-period intent owned with F1.09 / pricing. Issue the accounting invoice through F1.03 (idempotent, correlated to the period — not as if it were a lesson `booking_id`). Submit one Direct Debit collection against that claim. Confirmed payment emits a **payment-confirmed** signal for F1.09. |
| Paid = confirmed collection / reconciliation | Lesson and Camp paid state comes from accounting reconciliation, not a screenshot. | **Same authority.** Opt-in ≠ paid. Mandate active ≠ paid. Invoice issued ≠ paid. Only confirmed collection/reconciliation marks the period paid. |
| Fallback when auto-pay is unavailable | QR / bank transfer is the only live path. | **Keep** QR / invoice as fallback when the client did not opt in, the payer bank does not support Direct Debit, the mandate is missing/rejected/revoked, or the issuer channel is not configured. Show an honest status. |
| Membership lifecycle / Group fixed-place | Unused `memberships` table (`plan_id`, `active` boolean) does **not** match F1.09. F1.09: Membership = one Client + one Group, fixed place, states Pending Payment / Active / Paused / Cancelled / Expired, **manual Admin activation**. Domain-model §2.9 still describes a plan/subscription leftover. | **Do not** implement F1.09. Do not treat the unused table as the Membership product. Do not invent a credit wallet. This feature owns collection method, mandate, collection, and the payment-confirmed signal only. |
| Kids semester / Camps reuse | Camps are one-off (F1.25). Kids pay once per semester (F1.18 / F1.20 — Needs Spec). | **Out of V1.** Design the collection mapping so a later Kids-semester or other chargeable type could reuse it without copying mandate logic into those domains. |

**Does not replace** F1.03 invoicing/reconciliation, F1.09 Membership/Group domain, F1.11 Booking, F1.12 cancellation, F1.13 Recovery, lesson QR billing, or Camp one-off invoices. Those journeys stay in force.

**Documented discrepancy:** `specs/project-context/domain-model.md` §2.9 still describes unused `memberships` as a plan with `next_charge_date` / `active`. F1.09 issue #14 describes Membership as a Group fixed-place with an explicit lifecycle and **no** generic credit wallet. This spec follows **F1.09 + issue #54**, not the unused-table leftover. Planning must not silently “activate” the unused table as if it were F1.09.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Client or Admin chooses automatic collection (Priority: P1)

An authorized client (for their own Membership) or an Admin acting for a client chooses **automatic collection** for that Membership instead of paying each period by QR / bank transfer. The choice is stored as academy operational data (collection method and later mandate correlation), not in the accounting system. If they decline, the existing QR / invoice path remains available. The screens never instruct them to enable Automatic transaction, standing approval, or a standing order in e-banking as the way auto-pay is set up.

**Why this priority**: Without an honest in-app opt-in, there is nothing to collect against. This is the client’s stated requirement and a viable slice on its own (choice persisted; QR still works).

**Independent Test**: As the Membership’s client, choose auto-pay; confirm the choice is stored and the UI does not mention Automatic transaction as the setup step. Decline on another Membership; QR / invoice payment remains offered. As Admin, set the same choice for a client. As a different client, attempting to change another client’s method is refused.

**Acceptance Scenarios**:

1. **Given** a client with a Membership they are allowed to manage, **When** they choose automatic collection, **Then** AGC stores that collection method for that Membership and does not mark the Membership or any period as paid.
2. **Given** the same client, **When** they decline automatic collection (or never opt in), **Then** they can still pay the Membership period by QR / bank-transfer invoice.
3. **Given** any auto-pay screen, **When** the client reads the copy, **Then** it MUST NOT claim that AGC will switch on Automatic transaction, standing approval, or a standing order in their bank.
4. **Given** an Admin, **When** they choose automatic collection on behalf of a client’s Membership, **Then** the same operational choice is stored and the client can see the resulting status for their own Membership.
5. **Given** a client, **When** they attempt to view or change another client’s collection method, **Then** the operation is refused.
6. **Given** the contracted issuer channel is not configured, **When** a user tries to opt in, **Then** automatic collection is not offered (or is refused with a clear status) and QR / invoice remains available.

---

### User Story 2 - One Direct Debit mandate proposal and status (Priority: P1)

After opt-in, AGC requests a Direct Debit **authorization proposal** through the contracted issuer channel. The client approves that proposal **once** in e-banking (scheme requirement). AGC persists a durable, provider-neutral mandate mapping (client/Membership, external references, status, timestamps, failure reason) and shows an honest status (for example: waiting for bank mandate approval; rejected; revoked; unsupported bank). Sending a proposal does not mark the Membership paid or Active.

**Why this priority**: Collection is illegal/impossible without a mandate. This slice proves the authorization path without depending on a billing period running.

**Independent Test**: Opt in once; exactly one proposal exists. Retry the same opt-in; still one proposal. Status moves from proposal sent to active after simulated bank approval, and to rejected/unsupported without marking anything paid.

**Acceptance Scenarios**:

1. **Given** a successful opt-in, **When** the authorization proposal is requested, **Then** AGC creates exactly one proposal for that Membership/client; retries correlate to the existing proposal and MUST NOT create a second one.
2. **Given** a proposal has been sent, **When** the client has not yet approved it in e-banking, **Then** status distinguishes **proposal sent** from **active**, and the Membership is not treated as paid or Active because of the proposal.
3. **Given** the client approves the mandate in e-banking, **When** AGC learns the new status, **Then** the mandate is **active** and still does not by itself mark any period paid.
4. **Given** the payer’s institution does not support eBill Direct Debit, **When** the channel reports that, **Then** status is **unsupported bank**, auto-pay is unavailable, and QR / invoice payment is offered.
5. **Given** the client or bank rejects or later revokes the mandate, **When** AGC learns that status, **Then** further Direct Debit collections MUST NOT be submitted and QR / invoice remains the payment path.
6. **Given** any mandate record, **When** it is stored, **Then** AGC NEVER stores full bank login credentials. IBAN or eBill recipient identifiers are collected only if the contracted channel requires them, under existing PII and authorization rules.

---

### User Story 3 - Period collection, invoice, and payment-confirmed signal (Priority: P1)

On each Membership billing period (period rules belong to F1.09 / pricing; this feature consumes the chargeable intent): AGC creates a chargeable financial operation for that period, issues the accounting invoice through the existing F1.03 boundary (idempotent, correlated to the Membership period), and — when the mandate is active — submits one Direct Debit collection request against that claim. Confirmed collection/reconciliation marks the period paid and notifies F1.09 with a **payment-confirmed** signal. This feature does not itself implement Membership state transitions, Group assignment, or fixed-place logic. Jobs are safe to rerun: retries MUST NOT create duplicate invoices or duplicate collections.

**Why this priority**: This is the revenue path and the missing Phase 2 financial signal F1.09 deferred.

**Independent Test**: With an active mandate, run one billing period twice; one invoice and one collection exist; after a confirmed payment the period is paid and F1.09 is notified. Issuing the invoice alone does not mark the period paid.

**Acceptance Scenarios**:

1. **Given** an active mandate and a chargeable Membership period, **When** the collection job runs, **Then** at most one invoice and at most one collection request exist for that period, including after retries.
2. **Given** that invoice is issued through F1.03, **When** collection has not yet been confirmed, **Then** the period is not treated as paid.
3. **Given** confirmed collection and/or canonical accounting reconciliation for that invoice, **When** AGC records it, **Then** the period is marked paid and a payment-confirmed signal is available for F1.09 to activate or renew — without this feature assigning a Group place.
4. **Given** a stale partner or accounting response, **When** it arrives after a newer known AGC financial state, **Then** it MUST NOT overwrite the newer state.
5. **Given** the collection channel is temporarily unavailable, **When** the period is processed, **Then** operational Membership records are not rolled back solely because of that outage; the failure is retryable and visible to Admins.

---

### User Story 4 - Honest fallback to QR / invoice (Priority: P2)

When automatic collection is unavailable, the client pays the F1.03 invoice by QR / bank transfer as today. AGC shows a clear status (waiting for bank mandate approval; auto-pay unavailable at your bank; pay by invoice). Lesson invoices and Camp invoices are unaffected.

**Why this priority**: Coverage will never be 100% of banks; QR is the live academy payment method and must remain the safety net.

**Independent Test**: For not opted-in, unsupported bank, missing mandate, rejected/revoked mandate, and unconfigured channel, the client can pay by QR / invoice and sees an honest status. A lesson invoice still behaves as today.

**Acceptance Scenarios**:

1. **Given** the client did not opt in, **When** a Membership period is billed, **Then** payment is by QR / invoice and no Direct Debit collection is submitted.
2. **Given** unsupported bank, missing mandate, or revoked/rejected mandate, **When** the client views payment status, **Then** they see that auto-pay is unavailable and can pay the invoice by QR / bank transfer.
3. **Given** a lesson booking invoice, **When** Membership auto-pay is enabled for that client, **Then** the lesson invoice path is unchanged.

---

### User Story 5 - Failed collection, reclaim, and stop (Priority: P2)

A failed or rejected collection does not silently activate or extend a Membership. Client reclaim / objection is handled in eBill; AGC does not invent a second money-movement UI. When F1.03 or the partner reports a reversal, AGC surfaces it to Admins and stops treating the period as paid. Stopping auto-pay in AGC stops further collection submissions. Mandate revocation at the bank is detected and also stops collections. What happens to an already-Active Membership (pause vs stay Active until period end) is owned by F1.09 — this feature MUST NOT invent a second cancellation policy.

**Why this priority**: Silent activation on failure, or continuing to collect after stop/revoke, would be financially and legally wrong.

**Independent Test**: Simulate failed collection, reversal, in-app stop, and bank revocation. Confirm no activation/extension on failure, Admin visibility of reversal, and no further collection submissions after stop or revoke.

**Acceptance Scenarios**:

1. **Given** a failed or rejected collection, **When** AGC records it, **Then** the Membership is not activated or extended because of that attempt, and the period is not treated as paid.
2. **Given** a reported reclaim/reversal from the accounting system or the collection channel, **When** AGC records it, **Then** Admins can see it and the period is no longer treated as paid.
3. **Given** the client or Admin stops auto-pay in AGC, **When** later billing periods run, **Then** no further Direct Debit collection submissions are made (QR / invoice remains available).
4. **Given** the mandate is revoked in the bank, **When** AGC learns that status, **Then** further collections stop. Effect on an already-Active Membership follows F1.09; this feature does not invent pause/cancel rules.

---

### Edge Cases

- Opt-in while a proposal is already in flight: retry correlates; no second proposal.
- Opt-in after a previous rejection: a new proposal MAY be requested; it MUST be a new correlated attempt, not a silent reuse of a rejected mandate as if it were active.
- Channel not configured: auto-pay is not offered; QR remains.
- Client opts in, then pays the same period by QR before Direct Debit confirms: at most one paid outcome for that period; no second collection after the period is already paid.
- Duplicate job runs / double-click / worker restart: still one invoice and one collection per period.
- Partner timeout after the collection was actually created: recovery MUST find the existing collection instead of submitting a second one.
- Stale status webhook or poll older than current AGC state: ignored for overwrite.
- IBAN / recipient id required by the channel but missing: proposal is not sent; client/Admin sees a clear completion request; no paid flag.
- Admin sets auto-pay for a deactivated client: follow F1.04 — deactivated clients cannot start new financial commitments; existing history remains readable.
- Partial accounting payment vs full Direct Debit confirmation: the period is paid only when the canonical financial position is fully paid (same spirit as 007 partial-payment rules).
- Reversal after F1.09 already consumed payment-confirmed: this feature marks the period no longer paid and surfaces the reversal; F1.09 owns any Membership lifecycle reaction (do not invent one here).
- Kids semester and Camp registration: MUST NOT be billed by this V1 collection job even if a later reuse of the mandate mapping is designed.
- Paper / analogue Direct Debit mandates (scheme change from June 2027): out of scope.
- English remains the live UI language (`XR-006`).

---

## Requirements *(mandatory)*

F1.03 invoicing/reconciliation, F1.02 authorization, F1.04 client identity, and live lesson/Camp QR payment stay in force. F1.09 owns Membership lifecycle and Group fixed-place. This feature adds the collection channel.

### Functional Requirements

#### Opt-in and collection method

- **FR-001**: An authorized client MUST be able to choose automatic collection for a Membership they own. An Admin MUST be able to choose it on behalf of a client. If F1.09 keeps Membership **creation** Admin-only, that rule stays with F1.09; this feature still defines both opt-in actors.
- **FR-002**: The collection-method choice (automatic collection vs QR / invoice) MUST be stored as AGC operational data, correlated to the client and Membership, not as a field in the accounting system.
- **FR-003**: Declining or never choosing automatic collection MUST leave QR / bank-transfer invoice payment available for that Membership.
- **FR-004**: Product copy MUST NOT instruct the user to enable Automatic transaction, standing approval, or a standing order in e-banking as the way auto-pay is set up. One eBill Direct Debit mandate approval in e-banking is allowed and required; it is not per-invoice bank setup.
- **FR-005**: Automatic collection MUST only be offered when the contracted issuer channel is configured. Otherwise the user sees that auto-pay is unavailable and can pay by invoice.

#### Mandate

- **FR-006**: After opt-in, AGC MUST request a Direct Debit authorization proposal through the contracted issuer channel. AGC MUST NOT connect to SIX directly.
- **FR-007**: AGC MUST persist a durable, provider-neutral mandate mapping: AGC client and Membership, external mandate/Biller references, status, timestamps, and failure reason when known.
- **FR-008**: Mandate status MUST at least distinguish: not requested, proposal sent, active, rejected, revoked, failed, unsupported bank.
- **FR-009**: Opt-in MUST create exactly one authorization proposal for that Membership/client; retries MUST correlate to the existing proposal.
- **FR-010**: Sending a proposal or having an active mandate MUST NOT by itself mark the Membership or a period as paid, and MUST NOT by itself mark the Membership Active.
- **FR-011**: AGC MUST NEVER store full bank credentials. IBAN or eBill recipient identifiers MAY be collected only if the contracted channel requires them, under existing PII rules and server-side authorization.
- **FR-012**: Partner, eBill Web, accounting, and bank credentials MUST stay server-side. Least-privilege access to mandate and collection operations. Do not log tokens, full account numbers, or unnecessary financial PII. External identifiers are not authorization credentials.

#### Recurring collection and invoice

- **FR-013**: This feature MUST consume the Membership billing period / chargeable intent owned with F1.09 and pricing. It MUST NOT invent a second billing calendar (calendar month vs academy term is not decided here).
- **FR-014**: For each chargeable period with an active mandate, the system MUST create a chargeable financial operation, issue the invoice through the existing F1.03 provider-neutral financial/accounting boundary, and submit one Direct Debit collection request against that claim. Membership, Booking, Cancellation, and Recovery services MUST NOT call the accounting provider, SIX, or the issuer channel directly; they express intent; this feature and F1.03 execute it.
- **FR-015**: Membership-period invoices MUST reuse F1.03 invoice, correlation, PDF, email, and reconciliation mechanisms. The invoice MUST be correlated to the Membership period, not treated as a lesson `booking_id`. Bexio remains the accounting source of truth for the invoice document and recorded payments. Bexio MUST NOT become the source of truth for Membership lifecycle or Group fixed-place.
- **FR-016**: Invoice issuance MUST NOT mark the period paid.
- **FR-017**: For an active mandate, a billing period MUST create at most one invoice and at most one collection request for that period, including after retries, timeouts, and worker restarts.
- **FR-018**: Financial operations MUST be idempotent and auditable. Stale partner or accounting responses MUST NOT overwrite newer known AGC financial state.
- **FR-019**: A collection-channel or accounting outage MUST NOT roll back operational Membership/Booking records solely because the partner is temporarily unavailable. Failures MUST be retryable and visible to Admins.
- **FR-020**: Paid for a period means confirmed Direct Debit collection and/or canonical accounting reconciliation for that invoice — not a client screenshot, not opt-in, not mandate active, not invoice issued.
- **FR-021**: When a period is paid, this feature MUST emit a payment-confirmed signal that F1.09 can use to activate or renew the Membership. This feature MUST NOT reimplement Membership state transitions, Group assignment, or fixed-place logic.
- **FR-022**: Lesson QR billing (F1.03 V1) MUST remain unchanged. Camp one-off invoices (F1.25) MUST remain unchanged in V1 of this feature.

#### Fallback, failure, stop

- **FR-023**: Automatic collection MUST be unavailable — and QR / invoice used instead — when: the client did not opt in; the payer’s institution does not support eBill Direct Debit; the mandate is missing, rejected, or revoked; or the issuer channel is not configured.
- **FR-024**: AGC MUST show a clear, honest status in those cases (for example: waiting for bank mandate approval; auto-pay unavailable at your bank; pay by invoice).
- **FR-025**: A failed or rejected collection MUST NOT activate or extend a Membership and MUST NOT mark the period paid.
- **FR-026**: Client reclaim / objection is handled in eBill. AGC MUST NOT invent a second money-movement or refund UI. When F1.03 or the partner reports a reversal, AGC MUST surface it to Admins and MUST NOT keep treating the period as paid.
- **FR-027**: Stopping auto-pay in AGC MUST stop further collection submissions. Detected bank-side mandate revocation MUST also stop collections. Effect on an already-Active Membership is owned by F1.09; this feature MUST NOT invent a second cancellation or pause policy.
- **FR-028**: No card payments, Stripe, TWINT PSP checkout, or generic credit-wallet model. Membership remains a Group fixed-place (F1.09); Recovery remains a domain entitlement (F1.13).

#### Authorization, reuse, tests

- **FR-029**: Clients MUST see only their own mandate and collection status. Admins MAY see academy-wide operational status. Non-Admins MUST NOT perform Admin collection operations. Backend authorization is authoritative (F1.02).
- **FR-030**: The mandate/collection mapping SHOULD be reusable later by Kids-semester or other chargeable types without copying mandate logic into those domains. Kids (F1.18 / F1.20) and Camps (F1.25) are **not** V1 of this feature.
- **FR-031**: Mandate uniqueness, duplicate-collection prevention, fallback-to-QR, reversal visibility, authorization isolation, and payment-confirmed → F1.09 signal paths MUST be covered by this feature’s tests and belong in F1.24 integration/regression coverage.

---

### Key Entities *(feature involves data)*

- **Collection method choice**: per Membership (and client), whether automatic collection or QR / invoice is selected; operational AGC data, not an accounting-system field.
- **Direct Debit mandate**: provider-neutral mapping of AGC client/Membership to an external mandate/Biller reference, with status (not requested / proposal sent / active / rejected / revoked / failed / unsupported bank), timestamps, and optional failure reason. Does not imply paid.
- **Chargeable Membership period**: the billable interval produced by F1.09 / pricing. This feature does not own the calendar; it consumes the intent and records paid vs not paid for that period.
- **Period invoice**: F1.03 financial document for that period (same invoice/PDF/reconciliation mechanisms as lessons and Camps, correlated to the period rather than a lesson booking).
- **Collection request**: one Direct Debit collection against a period claim, idempotent, auditable.
- **Payment-confirmed signal**: notice to F1.09 that a period is paid via canonical reconciliation/collection. Not a Membership state machine.
- **Existing entities reused, not redefined**: **Profile** (F1.04 client), **Membership** (F1.09 — Group fixed-place; not the unused `memberships` leftover), **Billing document / operation / event** (F1.03), **Booking** (F1.11 — not reserved by this feature).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorized client or Admin can complete automatic-collection opt-in from AGC in under 2 minutes without being instructed to configure Automatic transaction / standing approval in e-banking.
- **SC-002**: 100% of opt-ins produce at most one authorization proposal per Membership/client across retries.
- **SC-003**: 0% of “proposal sent” or “mandate active” events, by themselves, mark a Membership period paid or the Membership Active.
- **SC-004**: 100% of billing periods with an active mandate produce at most one invoice and at most one collection request, including after retries.
- **SC-005**: After confirmed collection/reconciliation, the period is marked paid and F1.09 can observe the payment-confirmed signal within one synchronization interval (target ≤ 1 hour), with 0 double-paid periods over any rolling 30-day window.
- **SC-006**: 100% of failed/rejected collections leave the Membership not activated or extended by that attempt.
- **SC-007**: 100% of unsupported-bank, missing-mandate, revoked-mandate, not-opted-in, and unconfigured-channel cases offer QR / invoice payment with an honest status in AGC.
- **SC-008**: 100% of unauthorized attempts to view or change another client’s mandate or collection status are denied.
- **SC-009**: Lesson invoices remain payable and reconcilable exactly as today; 0 lesson invoices are submitted as Direct Debit collections by this feature.
- **SC-010**: After stop-auto-pay in AGC or detected bank revocation, 0 further Direct Debit collections are submitted for that Membership.

---

## Assumptions

> **Assumption:** F1.09 is a dependency for Membership records, billing-period meaning, and any activation/renewal behaviour. This spec can proceed; live collection against a real Membership cannot be demonstrated until F1.09 exists (or a test double of a chargeable Membership period is used).
>
> **Assumption:** Whether a successful first collection is sufficient to activate a Pending Payment Membership remains an F1.09 decision. This feature always emits the payment-confirmed signal. F1.09 currently says automatic activation is Phase 2; issue #54 is that Phase 2 **financial path**, not a second Membership state machine.
>
> **Assumption:** Opt-in actors are **client (own Membership)** and **Admin (on behalf of a client)**. F1.09 may keep Membership *creation* Admin-only; that does not remove client opt-in on an existing Membership they own.
>
> **Assumption:** The exact issuer channel (AKB eBill Web vs certified network partner vs both) is chosen in planning after AKB/partner confirmation. This spec is channel-agnostic: AGC talks to one contracted issuer channel and never to SIX directly.
>
> **Assumption:** V1 offers Direct Debit for any payer institution the contracted channel reports as supporting eBill Direct Debit. If the contracted channel is AKB-only, that is a channel constraint, not a second product rule. Unsupported banks always fall back to QR.
>
> **Assumption:** Billing period (calendar month vs academy term) is owned with F1.09 / pricing. This feature does not invent a second calendar.
>
> **Assumption:** Manual issuer prerequisites (Biller ID, contract, ability to send proposals and collections) sit outside this issue’s application work. Spec/plan may proceed with QR fallback; live-bank collection cannot be verified until that channel exists.
>
> **Assumption:** Invoice VAT/tax follows live F1.03 configuration. No card path. English UI (`XR-006`).
>
> **Assumption:** F1.24 will later collect academy-wide regression suites; this feature still owns tests for its critical paths (FR-031).

---

## Non-goals

- Implementing F1.09 Membership/Group domain (fixed place, lifecycle UI, Admin creation, pause/cancel policy).
- F1.12 / F1.13 session cancellation and Recovery rules. Collecting or failing a Membership period MUST NOT cancel a single Session or mint Recovery.
- F1.11 Booking Engine / reserving places.
- Kids semester collection (F1.18 / F1.20) and Camps / one-off events (F1.25) as V1 jobs.
- Turning on the client’s bank Automatic transaction / standing approval remotely (not possible).
- Paper / analogue Direct Debit mandates (SIX: from June 2027).
- Card / Stripe / TWINT PSP checkout (`XR-005`).
- Generic credit wallets (forbidden by F1.09 / F1.13).
- AGC-built accounting, bank-reconciliation UI, or SIX connectivity.
- Changing lesson QR billing (F1.03 V1).
- Inventing a second Membership cancellation policy when auto-pay stops.

---

## Compatibility

- Preserve F1.03: provider-neutral financial boundary, idempotent invoices, PDF, invoice email, reconciliation authority, no Stripe, no AGC accounting dashboard.
- Extend F1.03 eligibility so a Membership **period** is an additional financial source (007 FR-013 already required future sources without rework of the integration core; F1.25 already added Camp registrations). Do not fold Membership periods into `bookings`.
- Preserve lesson booking and Camp registration payment behaviour.
- Preserve F1.02: admin via role enforced server-side; clients isolated to their own records.
- Preserve F1.04: one client profile per login; deactivated clients cannot start new financial commitments.
- Do not opportunistically rewrite the unused `memberships` / `credits` tables inside this feature except as F1.09-aligned correlation requires at planning — and do not treat those leftovers as F1.09.
- Do not opportunistically migrate unrelated schema debt (constitution §V).

---

## Baseline coverage

| ID | Covered? |
|---|---|
| WF-007 / XR-005 / XR-001 | Preserved — CHF; no Stripe; QR / bank transfer remains the fallback |
| FEAT-PAY-001 … FEAT-PAY-003 | Preserved for lessons; Membership period invoices SHOULD appear on My Payments once F1.09 periods exist, without becoming lesson bookings |
| F1.03 `007` FR-013 future sources | This spec is that future source for Membership **periods** (collection rail is additional; invoices still go through F1.03) |
| F1.03 `007` FR-020 / FR-035 | Paid remains canonical reconciliation; Direct Debit confirmation is an additional collection rail into the same paid meaning |
| F1.09 issue #14 | Consumed as the Membership domain owner; auto-activation still not implemented here |
| F1.11 / F1.12 / F1.13 | Not implemented; boundaries preserved |
| F1.18 / F1.20 / F1.25 | Out of V1; mapping designed for later reuse |
| Unused `memberships` table | Not adopted as the product model (discrepancy documented above) |

---

## Open questions

None blocking. Defaults are in Assumptions. Use `/speckit-clarify` if the academy wants: (1) AKB-payers-only even when the channel could support other banks; (2) this feature to flip Membership to Active itself instead of signalling F1.09; (3) client-only or Admin-only opt-in (not both).

Issuer channel (AKB eBill Web vs network partner) remains a **planning** decision after AKB confirmation, not a specification blocker.
