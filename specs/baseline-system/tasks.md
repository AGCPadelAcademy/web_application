# Baseline Tasks — AGC Padel Academy (implementation inventory)

> Scope: **as-is implementation inventory** — what modules exist, what each one is responsible for, what it depends on, how it is tested, and where maintenance attention is needed. This document describes the **current implementation only**; it is not a backlog and contains no future work.
> Captured 2026-08-12 from `src/`, `package.json`, `vite.config.js`, `.github/workflows/ci.yml`, and the live Supabase project (via MCP). Cross-references: `requirements.md` (what it does), `design.md` (how it is wired), `api-contracts.md` (integration contracts), `technical-debt.md` (risk-ranked debt).
> Convention: ✅ tested/covered · 🔶 partial · ❌ none.

---

## 1. Module inventory

### 1.1 Application shell

| Module | Lines | Responsibility | Depends on | Tests |
|---|---|---|---|---|
| `src/main.jsx` | 12 | React root; wraps app in `HelmetProvider` | `react-helmet-async`, `App` | ❌ |
| `src/App.jsx` | 73 | All routes (central), `AppLayout` (Header/Outlet/Footer/Toaster), `AuthProvider`, `/admin` redirect, catch-all → `/` | `react-router-dom`, layout, all pages, `ProtectedRoute`, `SupabaseAuthContext` | ❌ |
| `src/index.css` | — | Tailwind base + HSL theme tokens (dark shell) | `tailwindcss` | ❌ |
| `vite.config.js` | ~60 | Plain React plugin; `define`-injects `VITE_SUPABASE_*`; **fails production build if env vars missing**; `@` alias; Vitest config | `vite`, `@vitejs/plugin-react` | ❌ (exercised by CI build) |

### 1.2 Pages (route layer — one file per route)

| Module | Lines | Responsibility | Depends on | Tests |
|---|---|---|---|---|
| `pages/HomePage.jsx` | 101 | Marketing landing; hero image, services overview | `framer-motion`, `react-router-dom` | ❌ |
| `pages/LessonsPage.jsx` | 362 | Lesson catalogue (from `lessons` table), availability grid (08:00–20:30, 30-min steps, 14:00 blocked), booking dialog, T&C acceptance, booking insert + invoice request, profile-completion gate | `lib/bookings.js`, `lib/profileService.js`, `lib/profileValidation.js`, `ui/calendar`, modals | ❌ (logic delegated to tested `lib/bookings.js`) |
| `pages/TripsPage.jsx` | 93 | Static trips marketing (Ebro Delta campus); CTA → `/contact` | `framer-motion` | ❌ |
| `pages/TournamentsPage.jsx` | 73 | Static tournaments marketing + photo gallery | `framer-motion` | ❌ |
| `pages/ContactPage.jsx` | 171 | Contact form → `submit-contact-form` Edge Function | `supabase.functions.invoke` | ❌ |
| `pages/LoginPage.jsx` | 360 | Sign-in / sign-up / forgot-password / resend-confirmation; OAuth buttons (Google — provider not yet enabled dashboard-side) | `SupabaseAuthContext`, `auth/OAuthButtons`, `auth/PasswordField` | ❌ |
| `pages/AuthCallbackPage.jsx` | 61 | Landing for email-confirmation / OAuth redirects (PKCE auto-exchange) | `SupabaseAuthContext` | ❌ |
| `pages/ResetPasswordPage.jsx` | 120 | Set new password after recovery link | `supabase.auth.updateUser` | ❌ |
| `pages/ProfileManagementPage.jsx` | 219 | View/edit own profile (name, phone, address, postal code, city, country) | `hooks/useProfile.js`, `lib/profileValidation.js` | ❌ (hook wraps tested service) |
| `pages/PaymentsPage.jsx` | 165 | List own bookings newest-first; upload payment proof; **re-download or regenerate invoice PDF** ("Get invoice") | `lib/bookings.js` (`requestInvoice`), `lib/profileService.js`, `payments/*` | ❌ |
| `pages/AdminDashboardPage.jsx` | 32 | Admin shell rendering `PaymentVerificationPanel` | `admin/PaymentVerificationPanel` | ❌ |
| `pages/TermsPage.jsx` | 267 | Static legal copy (T&C, cancellation, privacy, impressum) | — | ❌ |

### 1.3 Feature components

| Module | Lines | Responsibility | Depends on | Tests |
|---|---|---|---|---|
| `components/auth/ProtectedRoute.jsx` | 33 | Route guard: unauthenticated → `/login`; `requireAdmin`/`allowedRoles` → `/`. UX guard only (RLS is the real boundary) | `SupabaseAuthContext` | ❌ |
| `components/auth/OAuthButtons.jsx` | 64 | OAuth provider buttons (currently Google only) | `SupabaseAuthContext.signInWithOAuth` | ❌ |
| `components/auth/PasswordField.jsx` | 35 | Password input with show/hide toggle | `ui/input` | ❌ |
| `components/layout/Header.jsx` | 110 | Auth-aware top navigation; reads `profiles.full_name` | `SupabaseAuthContext`, `supabase` | ❌ |
| `components/layout/Footer.jsx` | 81 | Site footer; newsletter form shows "not implemented" toast (no persistence) | `ui/use-toast` | ❌ |
| `components/modals/ProfileCompletionModal.jsx` | 114 | Forces profile completion before booking | `lib/profileService.js` | ❌ |
| `components/modals/InvoicePreviewModal.jsx` | 96 | Inline PDF preview (base64 blob) + download + redirect to `/payments` | `ui/dialog` | ❌ |
| `components/payments/PaymentProofUpload.jsx` | 105 | Validate (PDF/JPG/PNG, ≤5 MB) + upload proof as `<booking_id>/attempt-<n>.<ext>` + insert `payment_proofs` row + stamp `bookings.proof_uploaded_at` | `supabase` (storage + DB), `ui/use-toast` | ❌ |
| `components/payments/PaymentProofPreview.jsx` | 60 | Show latest proof status to the customer; open via signed URL | `lib/storage.js` | ❌ |
| `components/admin/PaymentVerificationPanel.jsx` | 196 | Admin table: list proofs (joined bookings+profiles), filter by status, open via signed URL, approve/reject with notes, fire `notify-payment-verification` (explicit session JWT) | `supabase`, `lib/storage.js` | ❌ |

### 1.4 UI primitives (`components/ui/` — shadcn/Radix pattern)

| Module | Lines | Notes |
|---|---|---|
| `button.jsx` | 44 | `cva` variants + `cn()` + `forwardRef` (canonical pattern) |
| `calendar.jsx` | 49 | Wraps `react-day-picker` |
| `card.jsx` | 50 | |
| `checkbox.jsx` | 20 | Radix |
| `dialog.jsx` | 81 | Radix |
| `dropdown-menu.jsx` | 144 | Radix |
| `input.jsx` / `label.jsx` | 16 / 12 | |
| `tabs.jsx` | 38 | Radix |
| `toast.jsx` / `toaster.jsx` | 92 / 31 | Radix toast viewport |
| `use-toast.js` | 89 | Toast queue (the single live copy) |

All follow the shadcn convention (Radix primitive + `cva` + `cn()` + named exports). No tests — exercised indirectly through pages.

### 1.5 State, hooks, and services (`contexts/`, `hooks/`, `lib/`)

| Module | Lines | Responsibility | Depends on | Tests |
|---|---|---|---|---|
| `contexts/SupabaseAuthContext.jsx` | 274 | Session restore, `onAuthStateChange`, `ensureProfile` upsert, `role` fetch (default `student`), sign-up/in/out/reset/OAuth helpers, **PASSWORD_RECOVERY → `/reset-password` redirect** | `lib/customSupabaseClient.js` | ❌ |
| `hooks/useProfile.js` | 34 | React wrapper over profileService (get-or-create + update) | `lib/profileService.js` | ❌ |
| `lib/customSupabaseClient.js` | 23 | The only `createClient`; env-driven, fail-fast; `persistSession`/`detectSessionInUrl`/`autoRefreshToken` | `@supabase/supabase-js` 2.30.0 (pinned) | ❌ |
| `lib/bookings.js` | 81 | `fetchDayBookings` (via non-PII `booking_slots` view), `buildBookingPayload`, `createBooking`, `requestInvoice` (explicit `Authorization: Bearer <session token>` + surfaced EF error bodies) | `lib/customSupabaseClient.js` | ✅ `bookings.test.js` (163 lines, mocked client; asserts auth header + no-session guard) |
| `lib/profileService.js` | 57 | `fetchProfile`, `getOrCreateProfile`, `updateProfile`, `profileToFormData`, `EDITABLE_PROFILE_FIELDS` — single owner of profile query shapes | `lib/customSupabaseClient.js` | 🔶 (via validation tests only) |
| `lib/profileValidation.js` | 24 | `isProfileComplete`, `getProfileCompletionStatus` (pure) | — | ✅ `profileValidation.test.js` (51 lines) |
| `lib/storage.js` | 13 | `PAYMENT_PROOFS_BUCKET`, `getSignedProofUrl` (24h TTL) | `lib/customSupabaseClient.js` | ❌ |
| `lib/utils.js` | 5 | `cn()` (clsx + tailwind-merge) | `clsx`, `tailwind-merge` | ❌ |

### 1.6 Backend (Supabase project `jokjxpogvwxbwdaroqkc` — source out-of-tree)

| Module | Kind | Responsibility | Tests |
|---|---|---|---|
| Postgres + RLS | persistence | 11 tables + `booking_slots` view; owner/admin policies; `is_admin()` helper (EXECUTE granted, migration `0007`) | ✅ `invoiceNumber.integration.test.js` covers the RPC (auto-skips without test-project secrets); RLS verified manually 2026-08-10 |
| `next_invoice_number(date)` | DB function | Atomic per-day invoice sequence (`invoice_counters`, migration `0005`) | ✅ integration test above |
| `generate-invoice-pdf` (v22) | Edge Function | Branded A4 PDF + QR merge, `Pending/YYYY/MM/DD/` upload, `invoices` row, `bookings.receipt_url`; `verify_jwt: true` + ownership/admin check | 🔶 contract covered by `bookings.test.js` mock; no function-side tests |
| `notify-payment-verification` (v6) | Edge Function | Admin-only decision email (SendGrid/Resend) + `notifications_log` audit; `verify_jwt: true` + admin check | ❌ |
| `submit-contact-form` | Edge Function | Persist contact message + emails via GoTrue admin mailer | ❌ |
| `cleanup-pending-bookings` | Edge Function | Dormant; time-based auto-cancel **rejected** — do not schedule | ❌ |
| `upload-invoice-to-storage`, `merge-invoice-qr`, `verify-invoice-generation`, `upload-logo-once` | Edge Functions | Utilities without frontend callers (annotated for the future invoice-lifecycle feature) | ❌ |

### 1.7 Tooling

| Module | Responsibility |
|---|---|
| `tools/generate-llms.js` | Pre-build step (`npm run build`); generates `llms.txt`; failure-tolerant (`\|\| true`) |
| `tools/find-dead-code.mjs` | Import-graph analyzer used for the 2026-08-10 dead-code cleanup (kept as a utility) |
| `.github/workflows/ci.yml` | Lint → Vitest unit tests → production build on `main` pushes and PRs; integration tests auto-skip without secrets |

---

## 2. Dependency map

### 2.1 Runtime (`dependencies`)

| Package | Used by |
|---|---|
| `react`, `react-dom` 18 | everything |
| `react-router-dom` 6 | `App.jsx`, pages, `ScrollToTop` |
| `@supabase/supabase-js` **2.30.0 (pinned)** | `customSupabaseClient` → all services/pages |
| `@radix-ui/react-{checkbox,dialog,dropdown-menu,label,slot,tabs,toast}` | matching `ui/` primitives only |
| `class-variance-authority`, `clsx`, `tailwind-merge` | `ui/` pattern, `lib/utils.js` |
| `tailwindcss-animate` | Tailwind config |
| `framer-motion` | marketing pages (Home, Trips, Tournaments, Contact) |
| `lucide-react` | icons across pages/components |
| `date-fns`, `react-day-picker` | `ui/calendar`, date formatting in payments/admin |
| `react-helmet-async` | per-page `<title>` (12 pages) + `HelmetProvider` |
| `terser` | Vite build minification |

### 2.2 Development (`devDependencies`)

`vite` 7, `@vitejs/plugin-react`, `vitest` 4, `eslint` 9 (+ react/react-hooks/import plugins, alias resolver, globals), `postcss`, `autoprefixer`, `tailwindcss` 3, `@types/{node,react,react-dom}` (editor-only; no TS compiled).

### 2.3 External services

| Service | Consumed from |
|---|---|
| Supabase Auth / Postgres / Storage / Edge Functions | `customSupabaseClient` (browser), service role (functions) |
| SendGrid / Resend | `notify-payment-verification` |
| Supabase GoTrue admin mailer (SMTP) | `submit-contact-form` |
| Hostinger Horizons CDN | static marketing images on Home/Trips/Tournaments/Contact (content hosting only — no code dependency) |
| Vercel | hosting + previews |
| GitHub Actions | CI |

---

## 3. Test coverage

| Suite | File | Covers | Status |
|---|---|---|---|
| Unit | `src/lib/profileValidation.test.js` (51 lines) | `isProfileComplete`, `getProfileCompletionStatus` | ✅ 2026-08-10 |
| Unit | `src/lib/bookings.test.js` (163 lines) | `fetchDayBookings` (view query shape), `buildBookingPayload`, `createBooking`, `requestInvoice` (explicit Bearer header, EF error surfacing, no-session guard) — mocked Supabase client | ✅ 2026-08-10 |
| Integration | `src/lib/invoiceNumber.integration.test.js` (43 lines) | `next_invoice_number` RPC atomicity/monotonicity against a **test** Supabase project | ✅ auto-skips without `SUPABASE_TEST_URL`/`SUPABASE_TEST_SERVICE_KEY` |

**Coverage summary:** the tested surface is deliberately the `lib/` service layer — the code paths where a regression breaks money (invoice numbering, booking insert, invoice invoke auth). Everything else (pages, components, context, Edge Function bodies) is **untested**; CI enforces lint + unit tests + build only. Component/E2E testing (Testing Library, Playwright) is not adopted.

---

## 4. Maintenance areas

Areas of the **current implementation** that need attention when touched (not a backlog — see `technical-debt.md` for risk-ranked detail):

| Area | Why it needs care |
|---|---|
| `pages/LessonsPage.jsx` (362 lines) | Largest live module; orchestrates catalogue + grid + dialog + booking + invoice. Booking/invoice logic is extracted to `lib/bookings.js` — keep it that way when editing. |
| `pages/LoginPage.jsx` (360 lines) | Four auth flows in one file (sign-in, sign-up, reset request, resend). Spanish/English copy mixed in toasts (`SupabaseAuthContext` also has Spanish sign-up toasts). |
| `contexts/SupabaseAuthContext.jsx` (274 lines) | Single auth chokepoint: session, profile ensure, role, recovery redirect. Any change here affects every authenticated flow — verify against the PASSWORD_RECOVERY redirect and `ensureProfile` upsert. |
| Edge Function auth pattern | The two hardened functions require **explicit** token passing on both sides (`Authorization` header from the client, `auth.getUser(token)` inside). The implicit-header variant fails on the pinned Deno `supabase-js@2.39.3` runtime — do not "simplify" this. |
| `bookings` state fields | `status` / `payment_status` / `verification_status` overlap; `price` is stored as **text**. Touch only via a spec'd migration. |
| `invoices` lifecycle | `Pending/` prefix is static; `Paid/`/`Refused/` moves and `invoices.status = 'paid'` on approval are **not implemented** — admin approval updates only `bookings`/`payment_proofs`. |
| Storage buckets | No bucket-level size/MIME limits; validation is client-side only (`PaymentProofUpload`). |
| Marketing images | Hosted on the former Horizons CDN; if that CDN is retired, Home/Trips/Tournaments/Contact lose their images. |
| `tools/generate-llms.js` | Failure-tolerant pre-build (`\|\| true`) — a broken run never fails the build, so check its output manually if `llms.txt` matters. |
| `npm audit` | 3 remaining advisories (1 low esbuild dev-only, 2 moderate react-router) — the react-router ones need the Router 7 major upgrade. |
| `src/utils/` | Empty directory — no purpose. |

---

## 5. Relationship to other specs

| Spec | Role vs. this file |
|---|---|
| `requirements.md` | What the system does (features, actors, workflows) |
| `design.md` | How it is wired (architecture, data flows, integrations) |
| `tasks.md` (this file) | What exists to maintain (modules, responsibilities, dependencies, coverage) |
| `technical-debt.md` | Risk-ranked problems in the above, with remediation status |
| `api-contracts.md` | Exact request/response contracts for every integration point |
