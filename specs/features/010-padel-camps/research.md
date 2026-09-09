# Research: Padel Camps / Camps Registration (F1.25)

**Feature**: `specs/features/010-padel-camps/spec.md`
**Date**: 2026-09-08
**Purpose**: Resolve every unknown in Technical Context so plan, data model, and contracts can be built without inventing APIs, schema, or business rules.

Sources: spec `010-padel-camps/spec.md`, constitution, F1.03 (`007-bexio-integration`) spec/plan/research/contracts and live code (`supabase/functions/_shared/billing/*`, `billing-issue-invoice`, `bexio-reconcile`), F1.04 (`009-client-management`) RLS/trigger pattern, `src/lib/bookings.js`/`billing.js`/`profileService.js`, admin dashboard composition, existing migration/RLS tests.

---

## R-01. Camp/child registration is **not** a second `bookings` row type

- **Decision**: Camps get their own domain tables (`camps`, `camp_extras`, `children`, `camp_registrations`, `camp_registration_extras`, `camp_waitlist_entries`). Camp registrations do **not** reuse `public.bookings`.
- **Rationale**: `bookings` is the lesson reservation with `lesson_code`, legacy `price text`, `bookings.user_id = auth.uid()` ownership, coach assignment, and My Payments lessons UI. A Camp registration is child-scoped, extra-bearing, capacity-controlled, and deadline-driven. Forcing Camps into `bookings` would either break lesson RLS/invoicing or require a polymorphic product model this feature has not been approved to design (F1.05/F1.08/F1.10 remain separate).
- **Alternatives considered**: *Extend `bookings` with `camp_id` and nullable lesson* — rejected: turns the central transactional table into a polymorphic mix, leaks coach/roster semantics, and leaves legacy invoice semantics ambiguous. *Shoehorn into `lessons`* — rejected: Camps are event-like offerings, not recurring catalogue lessons.
- **Constraint honored**: constitution §III/§V — additive schema; no destructive or opportunistic changes to `bookings`.

## R-02. Camp invoices ride the existing F1.03 boundary with a **generic billable reference**

- **Decision**: Keep Bexio as the only accounting provider and keep `billing_documents` / `billing_operations` / `billing_events` / `billing_contacts` provider-neutral. Add additive columns so those tables can reference a **camp registration** in addition to a lesson booking:
  - `billing_documents.camp_registration_id uuid NULL UNIQUE`
  - `billing_operations.camp_registration_id uuid NULL`
  - `billing_events.camp_registration_id uuid NULL`
  Exactly one of `booking_id` / `camp_registration_id` may be set on a document. `api_reference` for camps is `agc:camp-registration:{uuid}`.
- **Rationale**: FR-028/FR-030 require the provider-neutral financial boundary, one invoice per registration, idempotent creation, two-sided correlation, and retry after lost responses. The existing F1.03 tables already express that spine; duplicating them would create a second payment machine (explicitly forbidden by the spec).
- **Alternatives considered**: *A camp-specific `camp_invoices` table* — rejected: duplicate audit/retry/idempotency surface and violates F1.03 reuse. *Overwrite `booking_id` semantics* — rejected: breaks lesson history and RLS.
- **Authorization note**: `billing_documents` RLS keeps owner-or-admin semantics; the owner for a Camp document is the registration’s parent profile, so the Children page can show invoices only for that parent’s children.

## R-03. Children are dependents of the parent profile — no login, no second customer

- **Decision**: New `children` table owned by `profiles.id` (the authenticated parent). Child has no auth identity, no email-login, and no Bexio contact. The billed customer remains the parent profile (F1.04), which keeps `billing_contacts` mapping 1:1 with the paying user.
- **Rationale**: F1.04 forbids a parallel identity system; F1.25’s clarification (2026-09-08) requires reusable children and per-child invoices. Storing children as dependents avoids auth complexity and keeps financial identity stable.
- **Alternatives considered**: *Child as a `profiles` row with its own login* — rejected: creates a second customer identity and violates F1.04. *Child fields only on the registration* — rejected by the follow-up: the same child must be reusable across future Camps.
- **Isolation**: RLS restricts children to the owning parent (and admins for operations). Direct identifier access to another family’s child is denied.

## R-04. Capacity is derived from active registrations and enforced by a database transaction

- **Decision**: `camps.max_capacity` is configuration. Available places = `max_capacity - count(camp_registrations where status IN ('pending_payment','confirmed'))`. Registration submission runs in a Postgres function that, in one transaction, locks the Camp row (`SELECT … FOR UPDATE`), revalidates publication/window/eligibility, counts active registrations, and inserts only when a place is free. Full Camps are shown with `Complet / Ausgebucht`.
- **Rationale**: FR-019/FR-020 require derived availability and atomic last-place enforcement. A browser-side check or a hand-decremented counter cannot stop two concurrent submissions.
- **Alternatives considered**: *Maintained `places_taken` counter* — rejected: drift source and still needs transactional guards. *Queue-only serialization in an Edge Function* — rejected: a DB constraint/transaction is the canonical authority and protects direct API calls too.
- **Capacity reduction rule**: lowering `max_capacity` below current active count does not cancel registrations; the Camp is simply full until active registrations fall below the new maximum (spec edge case).

## R-05. Camp registration submission is server-orchestrated and idempotent

- **Decision**: A `camp-submit-registration` Edge Function receives `{ camp_id, child_id, extras[], terms_accepted }` with the caller JWT. It validates caller is the active owner of `child_id`, verifies billing-profile completeness (same fields as lesson gate), calls the transactional capacity/eligibility insert, then requests invoice issuance through the F1.03 financial service. Deterministic idempotency key: `camp-registration:{registrationId}:invoice:v1` once the registration row exists; submission de-duplication uses a per-parent+child+camp partial unique index on active registrations.
- **Rationale**: The browser must not be able to bypass capacity, deadline, age, or duplicate rules (FR-010/FR-011/FR-037). Keeping orchestration server-side matches the existing `billing-issue-invoice` pattern (explicit session JWT, service-role PostgREST repo).
- **Alternatives considered**: *Client insert + follow-up invoice call* — rejected: same failure mode as legacy bookings (two-step non-transactional) and would put capacity checks in the browser. *Insert first, capacity-check later* — rejected: creates invalid chargeable registrations.

## R-06. Invoice content: Camp + extras as separate line items

- **Decision**: The Bexio invoice for a Camp registration has one line for the Camp base price and one line per selected extra, with the registration’s snapshotted prices. Total equals base + extras in CHF. `InvoiceInput` already supports `lines: Array<{ text; amount; unitPrice }>`; F1.25 adds a camp mapper that builds those lines from the registration snapshot.
- **Rationale**: FR-018/FR-029 require reproducible totals and clear line items. Using configured prices at submit time and snapshotting them keeps history stable when admins later edit Camp pricing.
- **VAT**: continue to use the discovered 0% sales tax from F1.03 config (`tax_id_sales` / `resolveSalesTaxId`); Camps do not introduce a second tax policy.

## R-07. Payment confirmation comes only from reconciliation; confirmation email is separate from invoice email

- **Decision**: Registration payment state follows the document state. When `bexio-reconcile` marks a Camp document `paid` (numeric-totals rule), it transitions `camp_registrations.status`/`payment_status` to confirmed **once** and then sends the Camp confirmation email. The confirmation send is guarded by `notifications_log` (a sent Camp-confirmation row for that registration) so reprocessing never double-sends. Invoice PDF email (existing F1.03 behaviour) remains a distinct message.
- **Rationale**: FR-031/FR-033/FR-034 require payment-confirmed-only confirmation, idempotent reprocessing, and reuse of the existing notification/email infrastructure. The reconciliation worker is the single authority that already owns payment transitions.
- **Alternatives considered**: *Send confirmation in the submit function after invoice issuance* — rejected: invoice issuance is not payment. *Poll from the frontend* — rejected: not reliable or auditable.

## R-08. Public `/camps` discovery is anonymous-safe and non-PII

- **Decision**: `/camps` reads published Camps through a public-safe projection (published only, no parent/child data). Full state is computed server-side from active registrations. Registration start requires authentication and returns the parent to the Camp (same return-to pattern as lesson booking).
- **Rationale**: FR-003/FR-004 require marketing reachability and mobile usability; XR-004 forbids public PII. A projection keeps the public surface limited to Camp configuration and availability.
- **Note**: English remains the live UI language; the specified full label `Complet / Ausgebucht` is the one intentional bilingual string for the full state.

## R-09. Children page and per-child invoices are owner-scoped reads

- **Decision**: A protected `/children` page lists `children` for the signed-in parent, allows add/edit (personal info only), archive (not delete) when history exists, and shows each child’s Camp registrations with their `billing_documents` status and a document link via the existing invoice-document function (extended to accept `camp_registration_id`).
- **Rationale**: FR-006a–d and the clarification require a durable children list plus per-child invoices without exposing other families. Owner-or-admin RLS on `children` and `camp_registrations` enforces this server-side; the UI is only a convenience.
- **Alternatives considered**: *Only show Camp registrations on My Payments* — rejected as the **sole** surface: the follow-up explicitly wants a child-centric list; mixing siblings into one lesson payment list would not satisfy per-child access. **(Amended 2026-09-09 C4)** My Payments **also** lists Camp registration invoices alongside lesson bookings. Camps remain `camp_registrations` rows (R-01); they are not folded into `bookings`. Child-profile reopen stays required.

## R-10. Admin Camp management and CSV export stay in the existing dashboard

- **Decision**: Admin gets a Camps area in the existing protected admin dashboard (tabs pattern): Camp CRUD/publish, extras, registration list (pending vs paid/confirmed, remaining places), waitlist management/conversion, and CSV export of the authorized registration fields.
- **Rationale**: F1.02 and the existing `AdminDashboardPage` composition already provide admin tabs; F1.25 adds Camp tabs rather than a separate admin app. Export is generated server-side or from an admin-scoped query, never from a public endpoint.
- **Alternatives considered**: *Standalone admin route tree* — rejected: inconsistent with the current single-dashboard pattern and adds route surface without need.

## R-11. Waitlist is Camp-scoped, deterministic, and admin-converted

- **Decision**: `camp_waitlist_entries` belong to (camp, parent, child). One active entry per parent+child+camp. Ordering is `created_at` ascending (entry time). A waitlist entry does not count toward capacity. Conversion is an admin action that re-runs the same transactional capacity/eligibility insert (R-04) and then issues the invoice.
- **Rationale**: FR-024–FR-026 require no capacity consumption, deterministic order, no API bypass, and atomic revalidation. F1.16 itself leaves notification/timeout open; V1 conversion is admin-triggered.
- **Alternatives considered**: *Automatic offer email + self-serve acceptance* — rejected for V1: F1.16 leaves that open and it adds a second state machine; admin conversion is the smallest correct slice.

## R-12. Money and time conventions follow the existing project

- **Decision**: Camp prices and extras are `numeric` (CHF), never text. Registration totals are computed and snapshotted as `numeric(10,2)`. Camp dates are `date` in the academy’s local calendar (Switzerland); daily schedule is stored as start/end time plus optional structured days text. Terms acceptance persists `terms_version` and a timestamp consistent with existing reservation conventions.
- **Rationale**: Constitution §V requires `numeric` money; `XR-001` requires CHF; spec assumptions fix age at the Camp start date in local dates. Storing the schedule as structured fields keeps `/camps` and the confirmation email reproducible without parsing free text.
- **Alternatives considered**: *Free-text price* — rejected: violates money rules and decimal-safe totals. *UTC-only age math* — rejected: academy-local dates are the business rule.

## R-13. Analytics are first-party, PII-free funnel events

- **Decision**: Four funnel events (`camps_page_view`, `camp_registration_started`, `camp_registration_completed`, `camp_payment_confirmed`) recorded in a dedicated `camp_funnel_events` table (data-model.md) whose columns are deliberately PII-free: `camp_id`, `event`, `created_at` only. `INSERT` is allowed for `anon`/`authenticated` (page view/start come from the browser); `SELECT` is admin-only. `camp_payment_confirmed` is written server-side from the reconciliation path. No analytics vendor is added; a later vendor maps these event names without Camps depending on it.
- **Rationale**: FR-039 and spec tracking section require measurable funnel steps without child/parent PII and without coupling Camps to a vendor. F1.24 will later assert these events exist.
- **Alternatives considered**: *GA4/segment now* — rejected: no existing infrastructure and would couple the domain to a vendor. *Include child age in events* — rejected: unnecessary PII.

## R-14. Edge case: unpaid cancellation, deactivation, and archived children

- **Decision**: Unpaid Camp registration cancellation by the parent cancels the registration (releasing capacity) and cancels the Bexio invoice when issued/unpaid (same rule as lesson unpaid cancel). Deactivated parents cannot register or edit children but keep read access to history (F1.04). Archived children are hidden from new Camp selection but keep invoices/registrations readable.
- **Rationale**: FR-014/FR-022 and spec edge cases require capacity release on unpaid cancel, non-destructive deactivation, and non-destructive archiving.
- **Alternatives considered**: *Paid cancellation/refund* — explicitly out of scope; *hard delete child* — forbidden because it would orphan history.

## R-15. Testing approach mirrors the project’s existing split

- **Decision**: Vitest for frontend lib/payload tests; Deno unit tests for shared billing/camp orchestration with mocked provider and in-memory repo; SQL/RLS tests in `tests/sql/` for the new tables and the transactional capacity function; manual quickstart flows against a test Supabase project and Bexio demo company.
- **Rationale**: Constitution quality gate (`npm run lint`, `npm test`, build) plus the established F1.03/F1.04 pattern. Concurrency capacity tests use two simultaneous submissions against the transactional function.
- **Alternatives considered**: *Browser-only e2e* — rejected: cannot prove atomic capacity; *no Deno tests for the new mapper* — rejected: F1.03 already unit-tests mappers and reconciliation.

---

## Resolved clarification log

| Spec reference | Resolution | Where |
|---|---|---|
| Children persistence model | Durable dependents of parent profile, not logins | R-03 |
| Second payment machine risk | Reuse `billing_*` spine with additive camp reference | R-02 |
| Last-place race | Transactional capacity function (row lock) | R-04 |
| Confirmation vs invoice email | Reconcile-driven, notification-log idempotent | R-07 |
| Analytics vendor | None; first-party PII-free events | R-13 |

All Technical Context unknowns are resolved. No remaining `NEEDS CLARIFICATION` items.
