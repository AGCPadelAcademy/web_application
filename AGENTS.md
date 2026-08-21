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
- Create that branch before `/speckit-implement` (or before the first code/migration change). Push the feature branch only; merge to `main` only after verification and an explicit user request.

When documentation is missing:
- infer from code
- mark assumptions
- create TODO sections

Documentation rules:
- diagrams in Mermaid
- use markdown
- document uncertainty explicitly