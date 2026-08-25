# Feature specs

This directory holds **feature work**. Each feature is a folder with Spec-Kit artifacts. The brownfield baseline (`specs/project-context/`, `specs/baseline-system/`) is the as-is system.

How to start: `docs/sdd-brownfield/README.md`. Condensed context: `docs/sdd-brownfield/project-context.md`.

---

## Layout

```text
specs/features/
  README.md                 This file
  <kebab-case-name>/
    spec.md                 Specify — behavior, actors, requirements, out of scope
    plan.md                 Plan — design, data, APIs, risks (after spec is approved)
    tasks.md                Tasks — ordered implementation work (after plan is approved)
    checklists/             Optional quality checklists
```

Templates: `.specify/templates/` (`spec-template.md`, `plan-template.md`, `tasks-template.md`, `checklist-template.md`).

Do not pre-create empty folders. Add a folder when a spec is started.

---

## New-work specs

| Folder | Capability |
|---|---|
| `007-bexio-integration` | Bexio accounting integration |
| `008-roles-and-permissions` | F1.02 — live Coach + student isolation tightenings (delta vs `006`) |

---

## Live reverse specs (as-is)

These folders document **already-live** capabilities. Each has `spec.md` only (no `plan.md` / `tasks.md` until a change is approved):

| Folder | Capability |
|---|---|
| `001-lesson-booking` | Catalogue, availability grid, booking insert |
| `002-invoice-generation` | `generate-invoice-pdf`, numbering, recovery |
| `003-payment-proof-upload` | My Payments + proof upload |
| `004-admin-payment-verification` | Approve / reject proofs |
| `005-auth-and-profile-completion` | Signup, session, profile gate |
| `006-roles-and-permissions` | Live `student` / `admin` / `coach` matrix (F1.02 as-is after `0008`) |

---

## Naming

- Folder: `[FEATURE_ID]-[FEATURE_SLUG]` for reverse-engineered live features (`001-lesson-booking`). New-work folders may use `kebab-case` (`oauth-signin`) until an ID is assigned.
- One concern per folder. Do not mix independent features in one spec.
- `tasks.md` here is the **feature implementation backlog**. It is not `specs/baseline-system/implementation-inventory.md` (that file inventories the live codebase).

---

## Reverse-engineering a live feature

For a capability that **already exists**, do not start with `/speckit-specify` (that is for new work). Use:

- Prompt: `docs/sdd-brownfield/prompts/reverse-feature-spec.md`
- Skill: `.cursor/skills/reverse-feature-spec/SKILL.md`

That produces `specs/features/[FEATURE_ID]-[FEATURE_SLUG]/spec.md` only. No production-code changes, no `plan.md` / `tasks.md` until the reverse spec is approved.

---

## Rules

1. Read the constitution and the relevant baseline specs **before** writing.
2. **New-work** specs **delta** against `specs/baseline-system/requirements.md` IDs (`FEAT-*`, `WF-*`, `XR-*`, `ACT-*`). Do not copy the baseline into a change spec. **Reverse-engineered** live specs **may** restate observed behavior with local `FR-*` IDs plus a Baseline coverage map — that is the reverse-spec skill.
3. Mark assumptions (`> **Assumption:**`) and open questions (`> TODO:`). Do not invent APIs, schema, or business rules.
4. User review gates: spec → plan → tasks → implement. No implementation of non-trivial work without an approved spec and plan.
5. Implement on `sdd/<feature-folder>` from `origin/main`. Push that branch only. Open a PR into `main` only after quickstart verification **and** an explicit user request (not after every push). One commit per user-story phase.
6. When the feature ships, update the baseline files it actually changes (`requirements.md`, `domain-model.md`, `api-contracts.md`, inventory, etc.).

---

## Suggested next specs (from baseline TODOs)

Independent (safe to author in parallel; disjoint implementation surfaces):

- `oauth-signin` — provider enablement
- `i18n` — DeepL vs static bundles
- `coach-accounting-matrix` — permission matrix for planned roles (`006` documents live student/admin only)

Shared transactional surface (specify independently; **implement one at a time**):

- `cancel-reservation` — explicit cancel by student / admin / coach
- `invoice-lifecycle` — `Paid/` / `Refused/` storage move; `invoices.status = paid`
- `memberships-credits` — tokens from weeks-in-month and academy-open; academy redeems tokens into classes
- `class-assignment` — replace self-serve calendar/slots; place students into existing groups by skill rank
- `trips-tournaments` — product tables and booking extension
