# Quickstart: Validating Padel Camps / Camps Registration (F1.25)

**Feature**: `specs/features/010-padel-camps/spec.md` | **Date**: 2026-09-08
**Artifacts**: [research.md](research.md) · [data-model.md](data-model.md) · [contracts/edge-functions.md](contracts/edge-functions.md) · [contracts/camp-billing.md](contracts/camp-billing.md)

This guide proves the feature end-to-end after implementation (from `tasks.md`). Use a Supabase test project and the Bexio demo company; never production data.

---

## 0. Prerequisites

1. F1.03 Bexio integration connected and initialized on the test project (see `007-bexio-integration/quickstart.md`).
2. Migration `0014_f125_padel_camps.sql` applied (tables, RLS, view, transactional function).
3. Edge Functions deployed: `camp-submit-registration`, `camp-cancel-registration`, `camp-admin`, updated `billing-invoice-document` and `bexio-reconcile`.
4. Test users: one admin, two parents (A and B), each with a complete billing profile.
5. Seed one published open Camp (e.g. Junior Camp, capacity 2, one extra “Lunch” CHF 25) and one unpublished Camp.

## 1. Admin publishes a Camp (US1)

| Step | Action | Expected |
|---|---|---|
| 1.1 | Admin opens Admin → Camps, creates a Camp with dates, schedule, age range, price, capacity, extras, practical info, publishes | Camp saved; appears on `/camps` |
| 1.2 | Visitor opens `/camps` | Published Camp shows name, dates, hours, ages, price, description, deadline, CTA; unpublished Camp absent |
| 1.3 | Admin unpublishes | Camp no longer bookable; existing registrations still attached |
| 1.4 | Non-admin calls `camp-admin` | `403` |

## 2. Children page (US3)

| Step | Action | Expected |
|---|---|---|
| 2.1 | Parent A opens `/children` | Empty list |
| 2.2 | Add child X (name, DOB, level, allergies, emergency contact) | Child listed |
| 2.3 | Add child Y; edit Y’s allergies | Both listed; Y updated |
| 2.4 | Parent B opens `/children` | Sees only B’s children; A’s children invisible |
| 2.5 | Direct request for A’s child id as B | Denied |

## 3. Registration + invoice (US4/US5)

| Step | Action | Expected |
|---|---|---|
| 3.1 | Parent A opens Camp → Register → select child X → select Lunch → accept terms → submit | One registration, total = base + 25 |
| 3.2 | Retry submit (double-click/reload) | Still one registration; no duplicate invoice |
| 3.3 | In Bexio | One contact for A; one issued invoice with Camp + Lunch lines, correct CHF total, 0% VAT |
| 3.4 | Registration status | `pending_payment` / awaiting payment — not paid |
| 3.5 | Parent A opens `/children` → child X | Camp invoice listed; PDF opens via invoice-document |
| 3.6 | Register child Y on same Camp | Second registration, second invoice |

## 4. Capacity (US6)

| Step | Action | Expected |
|---|---|---|
| 4.1 | Set Camp capacity to 2 (X and Y already registered) | `/camps` shows `Complet / Ausgebucht` |
| 4.2 | Parent B tries to register | Refused; no chargeable registration |
| 4.3 | With capacity 1, submit two valid registrations concurrently | At most one place-holding registration |
| 4.4 | Parent A cancels X’s unpaid registration | Capacity released; invoice cancelled in Bexio |

## 5. Payment confirmation + email (US7)

| Step | Action | Expected |
|---|---|---|
| 5.1 | In Bexio demo, record full payment on Y’s invoice | — |
| 5.2 | Run reconciliation (or wait for schedule) | Registration Y `confirmed`; `payment_confirmation_source='bexio_reconciliation'` |
| 5.3 | Check email | One Camp confirmation email to parent A with child name, Camp, dates, schedule, total, extras, practical info |
| 5.4 | Re-run reconciliation | No second confirmation email |
| 5.5 | Partial payment case | Registration stays pending; no confirmation email |

## 6. Waitlist (US8)

| Step | Action | Expected |
|---|---|---|
| 6.1 | Full Camp with waitlist enabled; parent B joins for child Z | One active entry; capacity unchanged |
| 6.2 | B tries duplicate active entry for Z | Refused |
| 6.3 | Release one place; admin converts B’s entry | Revalidation passes; normal registration + invoice created |
| 6.4 | Convert again for same place | Fails (full or already converted) |

## 7. Admin registrations + export (US9)

| Step | Action | Expected |
|---|---|---|
| 7.1 | Admin opens Camp registrations | Sees Camp, child, age, parent, phone, email, level, extras, total, payment status, registration date, remaining places |
| 7.2 | Pending vs paid rows | Clearly distinguished |
| 7.3 | Export CSV | File contains only the authorized fields |
| 7.4 | Non-admin list/export | Denied |

## 8. Analytics (US10)

| Step | Action | Expected |
|---|---|---|
| 8.1 | Visit `/camps`, start registration, complete registration, confirm payment | Four funnel events recorded |
| 8.2 | Inspect payloads | No child/parent names, emails, phones, DOB, allergies, or emergency contacts |

## 9. Failure drills

| Step | Action | Expected |
|---|---|---|
| 9.1 | Block Bexio, submit registration | Registration succeeds; invoice enqueued in `billing_operations`; admin sees pending operation |
| 9.2 | Restore Bexio, run worker | Invoice issued once; operation `succeeded` |
| 9.3 | Registration after deadline / before opening / unpublished | Refused |
| 9.4 | Deactivated parent tries to register or add a child | Refused; existing history still readable |

## Acceptance mapping

Scenarios 1–9 cover SC-001…SC-012 and the spec’s user-story acceptance criteria. Traceability is maintained in `tasks.md` per requirement (FR-001…FR-040).
