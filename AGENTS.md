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

## Cursor Cloud specific instructions

This is a **Vite + React 18 SPA (JavaScript/JSX, no TypeScript)** whose entire backend is a **hosted Supabase Cloud project** (Postgres + RLS, Auth, Storage, Deno Edge Functions). There is **no local Supabase stack** in this repo (no `supabase/config.toml`), and Docker is **not** available on the Cloud Agent VM, so `supabase start` is not an option here. Package manager is **npm** (`package-lock.json`); Node **22** (`.nvmrc`).

Standard commands live in `package.json` `scripts`: `npm run dev` (Vite on port 3000), `npm run lint` (eslint), `npm test` (vitest), `npm run build`.

Non-obvious caveats:
- **Client requires Supabase env vars or it throws at import.** `src/lib/customSupabaseClient.js` throws if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing, and `vite.config.js` throws the same for a **production `npm run build`**. Provide them as env vars (Cloud Agent secrets) or a git-ignored `.env.local` (see `.env.example`). `vite.config.js` reads `process.env` first, then `.env*`, so injected secrets override any placeholder `.env.local`. Without a **real** project URL + anon key, the SPA renders (marketing pages, login form) but any auth/data action fails with a network error (`Failed to fetch`) — a genuine sign-up/login/booking demo needs real credentials.
- **Tests:** frontend unit tests are Vitest (`src/**/*.test.{js,jsx}`). Integration suites auto-skip unless `SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_ROLE_KEY` are set (`npm test` passes with them unset). Edge Functions under `supabase/functions/` are **Deno/TypeScript** and tested with `deno test` (see `supabase/functions/deno.json`); **Deno is not installed by default** and is a separate toolchain from the npm/Vite frontend.
- Edge Functions (`billing-*`, `bexio-*`) run only against a deployed Supabase project and need server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, `BEXIO_*`, optional `RESEND_API_KEY`/`SENDGRID_API_KEY`); they are not exercisable purely locally here.