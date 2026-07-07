# AGC Padel Academy — Project Constitution

> This constitution governs all development on the AGC Padel Academy web application.
> It supersedes ad-hoc practices and is the authoritative reference for spec, plan, and task generation via Spec-Kit.
> Aligned with `AGENTS.md` and `.cursor/rules/brownfield-project.mdc` (brownfield SDD rules).

---

## Core Principles

### I. Understand Before Modifying (NON-NEGOTIABLE)
Every change starts by reading the relevant parts of `/specs` and `/src`. No code is edited before its current behavior, callers, and data dependencies are understood. When documentation is missing, infer from code, **mark assumptions explicitly**, and create TODO sections. Document uncertainty rather than hiding it.

### II. Spec-Driven Development (NON-NEGOTIABLE)
All non-trivial work follows the SDD cycle: `specify → plan → tasks → implement`, with explicit review gates between stages. No implementation begins without an approved spec and plan in `specs/`. Brownfield documentation work (`project-context`, `baseline-system`) precedes new `features/` specs.

### III. Incremental & Backward-Compatible Changes
Prefer small, reversible, single-concern changes over large rewrites. Preserve backward compatibility for existing users, bookings, and stored data. **Never delete functionality, tables, columns, or files unless explicitly instructed by the user.** Deprecated code paths (e.g. legacy `AuthContext.jsx`, Stripe Edge Functions) are flagged in specs, not silently removed.

### IV. Security-First (NON-NEGOTIABLE)
Given the critical findings already documented in `specs/baseline-system/`, security remediation takes priority over feature work when conflicts arise. Specifically:
- No hardcoded secrets in source — Supabase URL/keys, Stripe keys, and any credentials must come from environment variables (`VITE_*` for the frontend).
- Row Level Security (RLS) policies must be explicit and least-privilege. No `true` policies on user-scoped tables. No public-read on booking or payment data.
- Admin-only routes must be guarded by a real role check, never a commented-out email comparison.
- New Edge Functions must declare their auth model; `verify_jwt: false` requires an in-function auth check.

### V. Data Integrity & Migration Discipline
The Supabase project currently has **no tracked migration history** (`supabase_migrations` is empty — see `specs/baseline-system/supabase-backend.md §8`). Going forward:
- Every schema change (table, column, policy, function, trigger) is captured as a numbered SQL migration before it is applied.
- Migrations are forward-only and reversible-by-compensation, not by destructive rollback.
- `price` / monetary values are stored as `numeric`, never `text`.
- Enum-style columns use CHECK constraints or Postgres enums, not free text.
- Existing schema debt (duplicate `users`/`profiles` tables, `bookings.email` vs `client_email`, three time-slot representations) is documented in `baseline-system` and addressed via dedicated spec'd migrations — not fixed opportunistically inside feature work.

### VI. Documentation Discipline
- Diagrams in **Mermaid**, prose in **Markdown**.
- Specs live under `specs/`; the `.specify/` folder is tooling only and must not be edited manually except for this constitution and config files.
- Every spec states what is confirmed from source vs. what is inferred. Assumptions are marked `> **Assumption:**` and open questions are marked `> TODO:`.
- Cross-references between specs use relative paths and section anchors (e.g. `specs/baseline-system/architecture.md §5`).

### VII. Simplicity & YAGNI
Start with the smallest change that satisfies the spec. Defer generalization until a second concrete use case appears. No speculative abstractions, no premature service/repository layers — but flag where they would help in the relevant spec's "Observations" section for future consideration.

---

## Additional Constraints

### Technology Stack
- **Frontend:** React 18 + Vite 7, Tailwind CSS 3, Radix UI / shadcn-style components, React Router 6. No new UI framework may be introduced without a spec.
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions in Deno). No custom Node.js API server.
- **Language:** JavaScript (JSX). TypeScript migration is **not** authorized unless a dedicated spec is approved.
- **Payments:** Stripe is **deprecated** and being replaced by manual bank-transfer + payment-proof verification. New payment flows must not depend on Stripe.
- **PDF / QR:** `pdf-lib`, `pdfkit`, `qrcode` are **server-side only** (Edge Functions). They must not be imported into frontend code.

### Deployment
- Production target: **Apache** serving the Vite build output (`dist/`).
- Domain: `agcpadelacademy.com`.
- The `plugins/` folder (visual-editor, selection-mode, iframe-route-restoration) is **Hostinger Horizons dev tooling** and must remain excluded from production builds (guarded by `isDev` in `vite.config.js`). Do not depend on these plugins at runtime.

### Legal & Compliance
- The academy operates in **Switzerland** — be mindful of Swiss data protection (revFADP / nDSG) when handling customer PII (name, email, phone, address).
- Legal copy in `TermsPage.jsx` must stay consistent with the actual payment processor. Currently it still references Stripe — this is tracked as a known issue, not a TODO for every PR.

---

## Development Workflow & Quality Gates

### SDD cycle (enforced by Spec-Kit workflow)
1. **Specify** — produce `specs/features/<feature>/spec.md` from a prompt. Review gate: user approves.
2. **Plan** — produce `specs/features/<feature>/plan.md`. Review gate: user approves.
3. **Tasks** — produce `specs/features/<feature>/tasks.md`. Review gate: user approves.
4. **Implement** — execute tasks one by one, marking each complete as it ships.

### Testing
> **Assumption / Open Decision:** No test runner is currently installed (`jest`, `vitest`, `playwright`, `cypress` — none present in `package.json`). The project therefore cannot enforce TDD today.
>
> - **Until a test runner is introduced** via a dedicated spec, the quality gate is: manual verification of the affected flow + lint passes (`npm run lint`).
> - **When a test runner is introduced**, the gate becomes: Red-Green-Refactor for new logic; integration tests for Edge Function contract changes and RLS policy changes.
> - RLS policy changes and Edge Function contract changes are **always** required to have a written verification checklist in the plan, even before a test runner exists.

### Lint gate
`npm run lint` (`eslint . --quiet`) must pass before any change is considered complete. New lint rules require a spec amendment.

### Secrets gate
No PR may add a hardcoded credential. Reviews must reject any commit that introduces one. The Supabase anon key currently hardcoded in `src/lib/customSupabaseClient.js` is tracked as critical debt and will be migrated to env vars via a dedicated spec.

---

## Governance

- This constitution **supersedes** all other practices when conflicts arise. `AGENTS.md` and `.cursor/rules/brownfield-project.mdc` are aligned with it and remain in force for brownfield-specific guidance.
- **Amendments** require: (a) a written proposal in a spec or PR, (b) explicit user approval, (c) a migration note in this file's history below, and (d) updates to any downstream specs that reference the amended principle.
- **Compliance verification:** every spec, plan, and task list generated by Spec-Kit must be checkable against the Core Principles above. Any waiver of a NON-NEGOTIABLE principle (I, II, IV) must be recorded explicitly in the spec with the user's approval.
- **Runtime development guidance** for AI agents is provided by `AGENTS.md` and `.cursor/rules/brownfield-project.mdc`; this constitution is the higher-level governance layer.

### Amendment history
| Date | Version | Change | Author |
|---|---|---|---|
| 2026-07-01 | 1.0.0 | Initial constitution drafted from brownfield rules + baseline-system findings. | SDD session |

**Version**: 1.0.0 | **Ratified**: 2026-07-01 | **Last Amended**: 2026-07-01

---

## Open Decisions (TODO — require user input)

These are explicitly flagged so they can be resolved into the constitution or into dedicated specs:

- **Testing strategy** — which runner (`vitest` is the natural fit for Vite), and whether TDD becomes NON-NEGOTIABLE once introduced. Currently framed as a staged adoption above.
- **Role system storage** — `profiles.role` column vs. `user_roles` join table vs. Supabase Auth custom claims (JWT). Affects principle IV's admin guard remediation. Tracked in `specs/baseline-system/supabase-backend.md §8`.
- **i18n / multilingual support** — UI is English-only today; Swiss market may require DE/FR/IT. DeepL integration is noted as "planned" in `architecture.md`. Affects how copy is authored in components.
- **CI/CD** — no pipeline exists today; deployment appears manual. Whether to introduce one (and on which platform) is an open decision.
- **Migration tooling** — whether to adopt the Supabase CLI (`supabase migration new`) for forward migration tracking, given the empty `supabase_migrations` table.
