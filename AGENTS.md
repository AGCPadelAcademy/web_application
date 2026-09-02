# Repository Instructions

You are working on a brownfield codebase.

Objectives:
1. Understand before modifying.
2. Prefer incremental changes.
3. Preserve backward compatibility.
4. Never delete functionality unless explicitly instructed.

Architecture process:
Read:
/docs/sdd-brownfield
/specs
/src

Git workflow:
- Never implement a feature spec on `main`. Use `sdd/<feature-folder>` (e.g. `sdd/007-bexio-integration`).
- Create that branch before `/speckit-implement` (or before the first code/migration change).
- Push the feature branch only during specify / plan / tasks / implement.
- Do **not** open a pull request into `main` until the feature’s implementation and quickstart verification are complete **and** the user asks for a PR. Do not auto-open a draft PR after every push.
- One commit per completed user-story phase (not per task).
- Merge to `main` only after verification and an explicit user request.

When documentation is missing:
- infer from code
- mark assumptions
- create TODO sections

Documentation rules:
- diagrams in Mermaid
- use markdown
- document uncertainty explicitly

## Agent Operating Model

Agents must respect the SDD stage they were assigned.

### Specification Agent

Responsible only for:

- reading the GitHub Issue
- understanding the Brownfield system
- executing `/speckit-specify`
- validating `spec.md`
- allowing configured post-specification hooks to execute

The Specification Agent must not:

- implement application code
- execute `/speckit-plan`
- execute `/speckit-tasks`
- execute `/speckit-implement`
- open an implementation PR

### Planning Agent

Responsible for:

- `/speckit-plan`
- architecture decisions
- implementation strategy
- dependency analysis

### Task Agent

Responsible for:

- `/speckit-tasks`
- task decomposition
- dependency ordering
- identifying parallelizable work

### Implementation Agent

Responsible for executing approved tasks only.