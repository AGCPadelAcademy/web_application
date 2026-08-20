---
name: reverse-feature-spec
description: >-
  Reverse-engineers a Spec-Kit spec.md from an already-live brownfield feature
  (as-is behavior, not a wishlist). Use when the user asks for a reverse spec,
  reverse-engineered feature spec, as-is feature specification, or to document a
  live capability under specs/features/ without writing plan.md or tasks.md.
---

# Reverse feature spec

Create a reverse-engineered Spec-Kit feature spec for an already-live brownfield feature. Canonical prompt: `docs/sdd-brownfield/prompts/reverse-feature-spec.md`. Keep that file and this skill in sync.

## When invoked

1. Resolve `[FEATURE_NAME]`, `[FEATURE_ID]`, `[FEATURE_SLUG]` from the user. If ID is missing, list `specs/features/` and use the next unused three-digit prefix (`001`, `002`, …). Slug is `kebab-case`.
2. Execute the prompt below **verbatim** with those values filled in.
3. Write **only** `specs/features/[FEATURE_ID]-[FEATURE_SLUG]/spec.md`. Do not modify production code. Do not create `plan.md` or `tasks.md`.

## Prompt

Create a reverse-engineered Spec-Kit feature spec for an already-live brownfield feature.

Feature:
[FEATURE_NAME]

Target file:
specs/features/[FEATURE_ID]-[FEATURE_SLUG]/spec.md

Read first:
- .specify/memory/constitution.md
- docs/sdd-brownfield/project-context.md
- specs/project-context/*
- specs/baseline-system/*
- relevant source files in src/
- relevant Supabase/backend documentation

Rules:
- Do not modify production code.
- Do not create plan.md or tasks.md yet.
- This is an as-is reverse spec, not a future wishlist.
- Separate current observed behavior from intended behavior.
- Mark bugs, risks, and gaps explicitly.
- Do not convert current bugs into intended behavior.
- Every technical claim must cite exact files, components, routes, tables, policies, Edge Functions, or existing baseline docs.
- Use stable requirement IDs.
- Include user stories, functional requirements, acceptance criteria, edge cases, data impact, auth/security impact, UI impact, non-goals, known gaps, and open questions.
- At the end, list which baseline requirements from specs/baseline-system/requirements.md this feature covers.

## Output file

Start from `.specify/templates/spec-template.md`, then add the reverse-spec sections the prompt requires. Required sections:

- User stories (with acceptance criteria)
- Functional requirements (stable IDs, e.g. `FR-001`)
- Edge cases
- Data impact
- Auth / security impact
- UI impact
- Non-goals
- Known gaps (bugs, risks, missing behavior — **not** restated as intended)
- Open questions
- Baseline coverage (map to `FEAT-*` / `WF-*` / `XR-*` in `specs/baseline-system/requirements.md`)

Label each behavioral claim as **observed** (cited from code or baseline docs) or **intended** (stated in docs/copy but not implemented). Never treat a bug as a requirement.
