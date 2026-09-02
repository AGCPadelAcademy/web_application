# Coding Standards — AGC Padel Academy

> Inferred 2026-08-10 from the repository itself. This document describes **what the codebase already does** — every rule cites the files it was observed in. Nothing here is aspirational; where the codebase is inconsistent, the inconsistency is documented instead of a rule being invented.
> Audience: future feature specs (`specs/features/`) and anyone writing code for this repo.

---

## 1. Architectural Conventions

### 1.1 Application shape

- **Client-only React SPA.** No custom backend server; all backend capability is Supabase (PostgREST, Auth, Storage, Edge Functions). See `api-contracts.md §0`.
- **Plain JavaScript, no TypeScript.** All source is `.jsx`/`.js`. `jsconfig.json` exists only to provide the `@/` path alias to editors. `components.json` confirms `tsx: false`. @types/react packages exist in devDependencies but no `.ts`/`.tsx` files are compiled.
- **ESM everywhere** (`"type": "module"` in `package.json`; `import`/`export` syntax in all files; the sole exception is `tailwind.config.js` using CommonJS `module.exports`/`require`, which Tailwind expects).
- **Build:** Vite 7 (`vite.config.js`), `@vitejs/plugin-react`. Build script chains a tolerant pre-step: `node tools/generate-llms.js || true && vite build` — the pre-build script is allowed to fail without breaking the build.
- **Deploy target:** Vercel (`vercel.json`). Dev server runs on port 3000 (`vite --host :: --port 3000`).
- **Unit tests:** Vitest 4 (`npm test`), `environment: 'node'`, files matching `src/**/*.test.{js,jsx}`. Pure `lib/` functions are unit-tested with a mocked Supabase client (`src/lib/bookings.test.js`, `src/lib/profileValidation.test.js`); an RPC integration suite exists (`src/lib/invoiceNumber.integration.test.js`) and **auto-skips** unless `SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_KEY` are set. CI runs lint + unit tests + production build on `main` pushes and PRs (`.github/workflows/ci.yml`).



### 1.2 Routing

- `react-router-dom` v6. **All routes are declared centrally in** `src/App.jsx` — no nested route files.
- A single layout route renders `AppLayout` (Header / `<Outlet/>` / Footer / `<Toaster/>`); every page nests under it.
- Route protection is done by **wrapping elements** in `<ProtectedRoute>` (`src/components/auth/ProtectedRoute.jsx`), with `requireAdmin` or `allowedRoles` props. The guard is documented in-code as *not* a security boundary — real authorization is Supabase RLS.

```jsx
<Route path="payments" element={
  <ProtectedRoute>
    <PaymentsPage />
  </ProtectedRoute>
} />
```



### 1.3 State management

- **One React Context** for auth/session: `src/contexts/SupabaseAuthContext.jsx` exposes `<AuthProvider>` and a `useAuth()` hook (`user`, `role`, `loading`, sign-in/out helpers). It subscribes to `supabase.auth.onAuthStateChange` and upserts/reads `profiles` on every auth event.
- **Everything else is local component state** (`useState`/`useEffect`). No Redux/Zustand/React Query — do not introduce a state library without a spec decision.



### 1.4 Data access

- **Single shared Supabase client singleton**: `src/lib/customSupabaseClient.js` (exported as both `default` and named `supabase`/`customSupabaseClient`). Never call `createClient` elsewhere in the frontend.
- **No service/repository layer as a blanket rule, but shared query/mutation logic is centralized in `src/lib/` services** once more than one component needs it: `profileService.js` (profiles), `bookings.js` (booking create + invoice invoke), `storage.js` (signed proof URLs), plus the `useProfile` hook wrapping the profile service. One-off reads may still be inline in pages (e.g. `PaymentsPage.jsx`).
- **Server-side logic lives in Supabase Edge Functions** (Deno + TypeScript, `Deno.serve`, shared `cors.ts` per function). Frontend invokes them via `supabase.functions.invoke('<slug>', { body })`.
- Env config: only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, read via `import.meta.env`. Both the client (`customSupabaseClient.js`) and the Vite config (`resolveSupabaseEnv`) **fail fast with explicit errors** when they're missing; `vite.config.js` `define`-injects them so production builds can't silently inline empty strings.



### 1.5 UI architecture

- **shadcn/ui** (`components.json`: style `new-york`, base color `neutral`, CSS variables enabled, lucide icons). Pre-built primitives live in `src/components/ui/` and follow the shadcn pattern: Radix UI primitive + `cva` variants + `cn()` class merging + `React.forwardRef` + named exports:

```jsx
// src/components/ui/button.jsx — the canonical ui/ pattern
const buttonVariants = cva('...', { variants: { ... }, defaultVariants: { ... } });
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
export { Button, buttonVariants };
```

- `cn()` from `src/lib/utils.js` (clsx + tailwind-merge) is the only sanctioned way to compose conditional class names.
- **Styling is Tailwind-only** with theme tokens mapped to HSL CSS variables (`tailwind.config.js`: `bg-primary`, `text-muted-foreground`, etc.; `darkMode: ['class']`). The app shell is dark (`bg-black text-white` in `AppLayout`).
- Icons: `lucide-react` exclusively. Dates: `date-fns` `format`. Page titles: `react-helmet-async` `<Helmet><title>…</title></Helmet>` per page (replaced unmaintained `react-helmet` on 2026-08-10; `<HelmetProvider>` wraps the app in `main.jsx`).
- Notifications: shadcn toast system — `useToast()` from `@/components/ui/use-toast` + `<Toaster/>` mounted once in `AppLayout`. (`sonner` and its `next-themes` dependency were removed on 2026-08-10.)



### 1.6 Directory layout

```
src/
  App.jsx                  # all routes
  main.jsx                 # React root, StrictMode
  index.css                # Tailwind + CSS variables
  pages/                   # route-level components
  components/
    ui/                    # shadcn primitives (generated style, kebab-case files)
    layout/                # Header, Footer
    auth/                  # ProtectedRoute, PasswordField, OAuthButtons
    modals/                # ProfileCompletionModal, InvoicePreviewModal
    admin/                 # PaymentVerificationPanel
    payments/              # PaymentProofUpload, PaymentProofPreview
  contexts/                # SupabaseAuthContext
  hooks/                   # useProfile
  lib/                     # customSupabaseClient, utils (cn), profileValidation,
                           # profileService, bookings, storage
tools/                     # Node build-time scripts (generate-llms.js)
```

- There is no `plugins/` directory: the dev-only Hostinger Horizons Vite plugins were **removed 2026-08-12** along with their Babel runtime dependencies. `vite.config.js` now registers only `@vitejs/plugin-react`.

---



## 2. Naming Conventions


| Thing             | Convention                      | Examples                                                      | Notes                                                |
| ----------------- | ------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Page components   | `PascalCase` + `Page` suffix    | `HomePage.jsx`, `AdminDashboardPage.jsx`                      |                                                      |
| Domain components | `PascalCase.jsx`                | `Header.jsx`, `PaymentProofUpload.jsx`                        |                                                      |
| `ui/` primitives  | `kebab-case.jsx`                | `alert-dialog.jsx`, `button.jsx`                              | shadcn convention — keep it for generated components |
| Hooks             | `kebab-case`, `use-` prefix     | `use-toast.js`, `use-mobile.jsx`                              |                                                      |
| Contexts          | `PascalCase` + `Context` suffix | `SupabaseAuthContext.jsx`                                     |                                                      |
| `lib/` modules    | lower/camelCase                 | `customSupabaseClient.js`, `utils.js`, `profileValidation.js` |                                                      |
| Edge Functions    | `kebab-case` slugs              | `generate-invoice-pdf`                                        |                                                      |
| Database objects  | `snake_case`                    | `payment_proofs`, `lesson_code`                               |                                                      |
| CSS theme tokens  | CSS variables, kebab-case       | `--primary`, `--muted-foreground`                             | consumed via Tailwind mapping                        |


**Exports:** pages and domain components use `export default`; `ui/` primitives and `lib/` utilities use named exports. The Supabase client deliberately exports both (`default` and `customSupabaseClient`/`supabase` named).

**Imports:** always use the `@/` alias for anything under `src/` (`import { Button } from '@/components/ui/button'`). The alias is configured in three places that must stay in sync: `vite.config.js` (`resolve.alias`), `jsconfig.json` (`paths`), `eslint.config.mjs` (`import/resolver` alias).

---



## 3. Patterns Already in Use

- **Data fetching:** `useEffect` + async helper + local `loading` state; errors surface as `toast({ title: 'Error', description, variant: 'destructive' })` after `console.error`. Canonical example: `PaymentsPage.jsx` (`fetchData`).
- **Multi-step mutations:** sequential awaits with early `throw` on each `error` — e.g. `PaymentProofUpload.jsx` (storage upload → `payment_proofs` insert → `bookings` update) and `LessonsPage.jsx` (booking insert → Edge Function invoice generation).
- **Auth gating:** pages read `const { user } = useAuth()` and return early when absent; route-level gating via `ProtectedRoute`.
- **Profile completion invariant in UI:** `isProfileComplete(profile)` from `@/lib/profileValidation` gates booking (`LessonsPage.jsx`) — enforcement is UI-only by design (DB columns stay nullable).
- **Forms:** controlled `useState` objects per form (`ProfileCompletionModal`, `ContactPage`). `react-hook-form` is installed and `ui/form.jsx` exists, but hand-rolled controlled state is what pages actually use today.
- **Optimistic vs server truth:** none — server responses drive state; lists are refetched after mutations (`onUploadSuccess={fetchData}`).
- **Comments:** JSDoc blocks only where intent is non-obvious (see `ProtectedRoute.jsx` explaining the guard is not a security boundary, and the env-resolution note in `vite.config.js`). Code is otherwise comment-light.
- **Formatting:** **2-space indentation everywhere.** Standardized 2026-08-10 (the shadcn-generated files and configs previously used tabs). There is no Prettier config; keep new code at 2 spaces.
- `React` **import:** files do **not** import `React` unless they reference the `React` namespace directly (e.g. `React.forwardRef`, `React.StrictMode`). The automatic JSX runtime makes the import unnecessary (`react/react-in-jsx-scope` is off in ESLint). Cleaned up 2026-08-10.

---



## 4. Testing Conventions

- **Framework:** Vitest 4 (devDependency), configured in `vite.config.js` (`test.environment: 'node'`, `include: ['src/**/*.test.{js,jsx}']`). Run with `npm test` (`vitest run`).
- **Unit tests** target pure / service-layer `lib/` functions and mock the Supabase client (e.g. `src/lib/bookings.test.js` asserts the explicit `Authorization: Bearer <session.access_token>` header required by the hardened invoice Edge Function; `src/lib/profileValidation.test.js` covers profile completeness).
- **Integration tests** (`*.integration.test.js`) hit a **separate test Supabase project** and must **auto-skip when `SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_KEY` are not set** — never let them fail a local/CI run without secrets, and never point them at production.
- **CI:** `.github/workflows/ci.yml` runs lint → unit tests → production build on `main` pushes and PRs; integration tests run only when the secrets exist.
- Component/UI testing (Testing Library, Playwright) is **not adopted yet** — the first feature spec that needs it must choose and set it up.

---



## 5. Dependency Rules

- **Runtime deps in** `dependencies`**, tooling in** `devDependencies` — the split is respected.
- **Versions use caret ranges**, with one deliberate pin: `@supabase/supabase-js` is exactly `2.30.0` (backend client stability). Match this conservatism for data-layer dependencies.
- **Server-only packages must not leak into the client bundle:** server-side libraries belong in the Edge Function, not imported from `src/`. (`pdf-lib`, `pdfkit`, and `qrcode` — legacy Edge-Function authoring leftovers — were removed from `package.json` on 2026-08-10; the `@babel/*` packages used by the removed Horizons dev plugins were removed on 2026-08-12.)
- **Radix UI** is consumed one package per primitive (`@radix-ui/react-`*) as required by shadcn components — add a Radix package only together with the `ui/` component that needs it.
- **ESLint flat config** (`eslint.config.mjs`) is the dependency/import gatekeeper: `no-undef: error`, `import/no-self-import: error`, with the `@` alias resolver registered. Several stylistic rules are deliberately **off** with recorded rationale ("non-critical…" comments) — e.g. `react/prop-types`, `no-unused-vars`, `import/no-cycle` (performance). Treat the config's inline comments as the source of truth for what's enforced; `npm run lint` runs with `--quiet`, so only errors surface.
- **Adding a dependency:** prefer packages already in the tree (e.g. reach for `date-fns`, `lucide-react`, `framer-motion`, `recharts` before introducing alternatives). Duplicated-purpose libraries in the tree (`react-hook-form` vs the controlled-state pattern pages actually use) are legacy inventory, not an invitation to use both.

