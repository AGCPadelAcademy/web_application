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
Prefer small, reversible, single-concern changes over large rewrites. Preserve backward compatibility for existing users, bookings, and stored data. **Never delete functionality, tables, columns, or files unless explicitly instructed by the user.** Deprecated code paths are flagged in specs, not silently removed.

### IV. Security-First (NON-NEGOTIABLE)
Given the critical findings already documented in `specs/baseline-system/`, security remediation takes priority over feature work when conflicts arise. Specifically:
- No hardcoded secrets in source — Supabase URL/keys and any credentials must come from environment variables (`VITE_*` for the frontend).
- Row Level Security (RLS) policies must be explicit and least-privilege. No `true` policies on user-scoped tables. No public-read on booking or payment data (public availability goes through the non-PII `booking_slots` view).
- Admin-only routes must be guarded by a real role check (`profiles.role`), never an email comparison.
- Edge Functions that act on user data run with `verify_jwt: true` plus in-function JWT validation and authorization (booking ownership / admin role). The caller's session token is passed explicitly (`auth.getUser(token)`), and the frontend attaches it in the `Authorization` header.

### V. Data Integrity & Migration Discipline
Schema changes are tracked as numbered migrations applied via Supabase MCP (migrations `0001`–`0007` applied 2026-08-06/10; the `supabase_migrations` tracking table remains empty — see `specs/baseline-system/supabase-backend.md §8`). Going forward:
- Every schema change (table, column, policy, function, trigger) is captured as a numbered SQL migration before it is applied.
- Migrations are forward-only and reversible-by-compensation, not by destructive rollback.
- `price` / monetary values are stored as `numeric`, never `text`. (Known debt: `bookings.price` is still `text` — to be migrated with the owning feature.)
- Enum-style columns use CHECK constraints or Postgres enums, not free text.
- Existing schema debt (`bookings.email` vs `client_email`, redundant time-slot representations, orphan `time_slot_id`) is documented in `baseline-system` and addressed via dedicated spec'd migrations — not fixed opportunistically inside feature work.

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
- **Payments:** Stripe is **removed** (code, DB artifacts, secrets — 2026-08-07/10). All payments are manual bank transfer + payment-proof verification. New payment flows must not depend on Stripe.
- **PDF / QR:** invoice PDF and QR generation is **server-side only** (Edge Functions). No PDF/QR libraries exist in the frontend dependencies.

### Deployment
- Production host: **Vercel** (`vercel.json`; production deploys from `main`, automatic preview deployments per branch/PR). This is the long-term production host.
- Domain: `agcpadelacademy.com`.
- Node runtime pinned via `engines: node >= 20.19` in `package.json`.
- CI: `.github/workflows/ci.yml` runs lint, Vitest unit tests, and the production build on `main` pushes and PRs.
- `public/.htaccess` is a leftover from the pre-Vercel Apache setup and is not used; it may be deleted.

### Legal & Compliance
- The academy operates in **Switzerland** — be mindful of Swiss data protection (revFADP / nDSG) when handling customer PII (name, email, phone, address).
- Legal copy in `TermsPage.jsx` must stay consistent with the actual payment method (bank transfer — Stripe references were removed 2026-08-07).

---

## Development Workflow & Quality Gates

### SDD cycle (enforced by Spec-Kit workflow)
1. **Specify** — produce `specs/features/<feature>/spec.md` from a prompt. Review gate: user approves.
2. **Plan** — produce `specs/features/<feature>/plan.md`. Review gate: user approves.
3. **Tasks** — produce `specs/features/<feature>/tasks.md`. Review gate: user approves.
4. **Implement** — execute tasks one by one, marking each complete as it ships.

### Testing
- **Runner:** Vitest 4 (`npm test`), configured in `vite.config.js` (`environment: 'node'`, `src/**/*.test.{js,jsx}`). Unit tests cover `src/lib/` services with a mocked Supabase client.
- **Integration tests** (`*.integration.test.js`) run against a separate test Supabase project and must auto-skip when `SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_KEY` are unset — never against production.
- **Quality gate:** `npm run lint` + `npm test` + `npm run build` must pass (enforced by `.github/workflows/ci.yml` on `main` pushes and PRs).
- RLS policy changes and Edge Function contract changes are **always** required to have a written verification checklist in the plan.

### Lint gate
`npm run lint` (`eslint . --quiet`) must pass before any change is considered complete. New lint rules require a spec amendment.

### Secrets gate
No PR may add a hardcoded credential. Reviews must reject any commit that introduces one. Supabase keys are read from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars (`.env.example` documents them); the production build fails fast if they're missing.

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
| 2026-08-12 | 1.1.0 | Deployment moved to Vercel (long-term production host, replacing Apache); Hostinger Horizons and Stripe removed from constraints; testing (Vitest + CI), secrets, role-system, and RLS/Edge Function auth open decisions resolved to their implemented state. | SDD session |

**Version**: 1.1.0 | **Ratified**: 2026-07-01 | **Last Amended**: 2026-08-12

---

## Open Decisions (TODO — require user input)

These are explicitly flagged so they can be resolved into the constitution or into dedicated specs:

- ~~**Testing strategy**~~ — **resolved 2026-08-10**: Vitest adopted; unit tests for `src/lib/` services, integration suite auto-skipping without test-project secrets; enforced via CI.
- ~~**Role system storage**~~ — **resolved 2026-08-06/10**: `profiles.role` column is the source of truth; `is_admin()` DB function + RLS policies enforce it server-side; `ProtectedRoute` uses `useAuth().role`.
- **i18n / multilingual support** — UI is English-only today; Swiss market may require DE/FR/IT. DeepL integration is noted as "planned" in `architecture.md`. Affects how copy is authored in components.
- ~~**CI/CD**~~ — **resolved 2026-08-10**: GitHub Actions CI (`.github/workflows/ci.yml`) runs lint + tests + build; Vercel handles production (from `main`) and preview deployments.
- **Migration tooling** — whether to adopt the Supabase CLI (`supabase migration new`) for forward migration tracking, given the empty `supabase_migrations` table (migrations `0001`–`0007` were applied via MCP, not tracked).
