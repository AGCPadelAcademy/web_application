# SDD on this brownfield project

This folder is the **entry point** for Spec-Driven Development (SDD). The brownfield baseline is complete: future work is specified as **deltas** under `specs/features/`, not as a rewrite of the live system.

Governance: `.specify/memory/constitution.md` (v1.1.0). Agent rules: `AGENTS.md` and `.cursor/rules/brownfield-project.mdc`. Spec-Kit tooling lives in `.specify/` and must not be used as a content store.

---

## Folder map

```text
docs/sdd-brownfield/          Navigation — start here
  README.md                   This file
  project-context.md          Condensed purpose, users, constraints
  prompts/
    reverse-feature-spec.md   Reusable reverse-spec prompt (live features)

specs/project-context/        Extracted context (stable)
  overview.md
  domain-model.md
  api-contracts.md
  coding-standards.md
  technical-debt.md

specs/baseline-system/        As-is system (do not treat as a backlog)
  requirements.md             What the live system does
  design.md                   How it is wired
  implementation-inventory.md Modules, dependencies, coverage, maintenance areas
  architecture.md             Deeper frontend/deployment snapshot
  supabase-backend.md         Schema, RLS, Edge Functions, storage snapshot

specs/features/               New work — one folder per feature
  README.md                   How to add a feature spec
  <feature>/                  spec.md → plan.md → tasks.md → implement

.specify/                     Spec-Kit tooling only
  memory/constitution.md      Authoritative principles
  templates/                  spec / plan / tasks / checklist templates
```

`specs/baseline-system/implementation-inventory.md` is **not** a Spec-Kit `tasks.md`. Feature work items live in `specs/features/<feature>/tasks.md` after `/speckit-tasks`.

---

## Cycle

1. **Specify** — `specs/features/<feature>/spec.md`. User approves.
2. **Plan** — `specs/features/<feature>/plan.md`. User approves.
3. **Tasks** — `specs/features/<feature>/tasks.md`. User approves.
4. **Implement** — on git branch `sdd/<feature-folder>` (never `main`); execute tasks; mark complete as they ship.

No implementation of non-trivial work begins without an approved spec and plan. Feature specs **reference requirement IDs** from `specs/baseline-system/requirements.md`; they do not restate the baseline.

---

## Before writing a feature spec

1. Read `docs/sdd-brownfield/project-context.md`.
2. Read the relevant files under `specs/project-context/` and `specs/baseline-system/`.
3. Inspect the corresponding code under `src/` (and the live Supabase project when the change touches schema, RLS, or Edge Functions).
4. **Live capability (as-is):** use the reverse-spec prompt (`docs/sdd-brownfield/prompts/reverse-feature-spec.md`) or the `reverse-feature-spec` skill. Output is `spec.md` only.
5. **New work:** open `specs/features/README.md` and create a new feature folder (specify → plan → tasks).

---

## Parallel work

- **Spec authoring** (specify / plan / tasks) can run in parallel: it is read-only against the codebase.
- **Implementation** is parallel only when features do not share files or schema. Booking / payment / invoice / membership work shares `bookings`, `invoices`, `payment_proofs`, and the same Edge Functions — sequence those. Independent surfaces (i18n, OAuth enablement, role matrices) can implement in parallel on separate branches.
