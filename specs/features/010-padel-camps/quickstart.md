# Quickstart: Validating Padel Camps / Camps Registration (F1.25)

**Feature**: `specs/features/010-padel-camps/spec.md` | **Date**: 2026-09-08
**Artifacts**: [research.md](research.md) · [data-model.md](data-model.md) · [contracts/edge-functions.md](contracts/edge-functions.md) · [contracts/camp-billing.md](contracts/camp-billing.md)

This guide proves the feature end-to-end after implementation (from `tasks.md`). As of constitution 1.2.0 (2026-09-08) there is a single Supabase project (production), which is also the live-verification target; mark and clean up any test data you create.

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
| 1.2 | Visitor opens `/camps`, including at a 375px-wide mobile viewport | Published Camp shows name, dates, hours, ages, price, description, deadline, CTA; unpublished Camp absent; layout readable with no horizontal-only desktop chrome |
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
| 3.1 | Parent A opens Camp → Register → select child X → select Lunch → accept terms → submit (repeat at a 375px-wide mobile viewport) | One registration, total = base + 25; fields, validation, extras, and CTAs usable on mobile |
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

## 10. Children evolution (2026-09-09 decisions)

| Step | Action | Expected |
|---|---|---|
| 10.1 | Open `/children` | Create form and its title are centered; labels are capitalized; **no padel level field**; DOB is a manual DD.MM.YYYY text input (no calendar picker); emergency phone is prefix + national number |
| 10.2 | Add a child with an image | Child listed with the image; stored in private `child-avatars` under the parent's folder; displayed via signed URL |
| 10.3 | Open the child (click or Edit) | Child profile view: all information incl. padel level, image replace/delete, default initials avatar when no image, the child's Camp invoices |
| 10.4 | Replace then remove the image | Image replaced; after removal the default avatar shows |
| 10.5 | Remove a child without history | Confirmation modal appears; child is deleted only after confirming |
| 10.6 | Remove a child with registrations/invoices | Refused with an explanation; history intact |
| 10.7 | During registration, open Terms, then go back | Return lands on the same `/camps/:slug` registration (never home) with selected child, extras, and terms state intact |
| 10.8 | During registration, choose `+ Add new Child`, create the child | Return to the same registration with the draft restored and the new child pre-selected |
| 10.9 | Register two children | Two separate registrations, one invoice per child (FR-012) |

## Acceptance mapping

Scenarios 1–9 cover SC-001…SC-012 and the spec’s user-story acceptance criteria. Traceability is maintained in `tasks.md` per requirement (FR-001…FR-040).

## Validation log (2026-09-08)

| Check | Result |
|---|---|
| T001 migration number vs remote | PASS — remote last is `0013_f104_inactive_auth_email_sync`; file is `0014_f125_padel_camps.sql` |
| T009 apply migration | PASS (2026-09-08) — `0014` applied to the single (production) project per constitution 1.2.0; 23/23 static assertions from `tests/sql/0014_f125_padel_camps.test.sql` pass. Follow-up `0015` granted anon `EXECUTE` on `is_admin()` (0014's public policies reference it; anon reads returned 42501 before the grant) |
| T011 last-place concurrency | NOT RUN — requires seeded camp/children data; left for manual live testing (§4.3) |
| T057 lint / vitest / build / deno unit tests | PASS — `npm run lint`, `npm test` (76 passed, 2 skipped), `npm run build`, `deno test --allow-env --allow-net=none supabase/functions` (86 passed) |
| T060 deploy + auth smoke | PASS (2026-09-08) — `camp-submit-registration` / `camp-cancel-registration` / `camp-admin` v1, `billing-invoice-document` v10, `bexio-reconcile` v10 (verify_jwt unchanged: on for camp-*/invoice-document, off for reconcile's scheduler secret). Unauthenticated calls → 401; anon `camp_public_list` → 200; anon `children` → empty; `register_camp_child` not callable by anon |
| Browser `/camps` `/trips` `/children` | PASS against local Vite — routes, 375px layout, `return_to` on `/children` |
| T058 live registration → Bexio invoice → reconcile → confirmation email | NOT RUN by the agent — manual acceptance by the user per the updated verification rule |
| 0016 children evolution apply (2026-09-09) | PASS — `0016_f125_children_evolution` applied to production on explicit user request; 5/5 static assertions from `tests/sql/0016_f125_children_evolution.test.sql` pass (avatar column, private bucket + 4 policies, children DELETE policy, FK RESTRICT guard) |
