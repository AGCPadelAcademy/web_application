# Reverse feature spec (brownfield)

Reusable prompt for reverse-engineering a Spec-Kit `spec.md` from an **already-live** feature. This is documentation, not implementation.

**Skill:** `.cursor/skills/reverse-feature-spec/SKILL.md` — agents must follow that skill when asked to reverse-spec a live feature.

Fill the placeholders, then run the prompt as-is:

| Placeholder | Meaning | Example |
|---|---|---|
| `[FEATURE_NAME]` | Human title | Lesson booking |
| `[FEATURE_ID]` | Three-digit prefix, next unused under `specs/features/` | `001` |
| `[FEATURE_SLUG]` | `kebab-case` short name | `lesson-booking` |

Target path: `specs/features/[FEATURE_ID]-[FEATURE_SLUG]/spec.md`

---

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
