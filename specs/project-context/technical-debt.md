# Technical Debt — AGC Padel Academy

> Captured 2026-08-10 from repository analysis (after the 2026-08-10 convention cleanup). Every item cites observed evidence. Risk levels: **High** = can cause data loss, security exposure, or payment/booking breakage · **Medium** = slows development or hides bugs · **Low** = cosmetic or housekeeping.
> Scope note: DB-level schema debt is inventoried in `baseline-system/supabase-backend.md §2` and summarized here only where it drives application debt. Security findings are in `baseline-system/supabase-backend.md §6` and `api-contracts.md §7.1`.
> **Remediation pass executed 2026-08-10 (PM)** — statuses below. ✅ resolved · 🔶 partially resolved · ⏸️ intentionally deferred · 🧑 owner action required.
> **Refreshed 2026-08-19:** Edge Function versions aligned to live `generate-invoice-pdf` v22 and `notify-payment-verification` v6.

## Summary

| # | Item | Category | Risk | Status (2026-08-10 PM) |
|---|---|---|---|---|
| 1 | Zero automated tests on payment/booking/auth flows | Missing tests | **High** | 🔶 Vitest + 23 unit tests on `lib/` (`profileValidation`, `bookings`); auth/RLS/E2E coverage still open |
| 2 | `bookings` public-read RLS policy exposes PII; availability grid depends on it | Coupling | **High** | ✅ Migration `0006`: `booking_slots` non-PII view + owner/admin SELECT policies; grid switched to the view |
| 3 | All Edge Functions run `verify_jwt: false` with service-role keys | Coupling | **High** | 🔶 `generate-invoice-pdf` v22 + `notify-payment-verification` v6: `verify_jwt: true` + in-function JWT/ownership/admin checks. 6 utility functions still `verify_jwt: false` |
| 4 | Business workflow orchestration inside `LessonsPage` | Coupling / Large module | Medium | ✅ Extracted to `src/lib/bookings.js` (`fetchDayBookings`, `buildBookingPayload`, `createBooking`, `requestInvoice`) — unit-tested |
| 5 | UI coupled to DB schema via inline `select('*')` and join strings | Coupling | Medium | 🔶 `profiles` + booking write/read paths centralized (`profileService.js`, `bookings.js`); admin panel join string remains in `PaymentVerificationPanel` |
| 6 | `use-toast` duplicated; `src/hooks/` entirely dead | Duplication | Medium | ✅ Dead copy deleted; `src/hooks/` now holds live `useProfile.js` |
| 7 | Dead shadcn inventory + dead backing dependencies | Deprecated patterns | Medium | ✅ 44 files deleted; 30 packages uninstalled (recharts, react-hook-form, embla, cmdk, vaul, input-otp, resizable-panels, 22 unused Radix, zod, @hookform/resolvers) |
| 8 | Profile fetch/update logic triplicated | Duplication | Medium | ✅ `src/lib/profileService.js` + `src/hooks/useProfile.js`; 3 call sites migrated |
| 9 | Hardcoded admin email fallback in `ProtectedRoute` | Coupling | Medium | ✅ Removed (verified `profiles.role = 'admin'` on the owner account first) |
| 10 | `npm audit` reports 12 vulnerabilities (11 high) | Deprecated patterns | Medium | 🔶 12 → 3 (1 low esbuild dev-only, 2 moderate react-router — fixing needs the React Router 7 major upgrade, deferred to a feature spec) |
| 11 | Signed-URL helper duplicated across admin/customer proof viewers | Duplication | Low | ✅ `src/lib/storage.js` (`getSignedProofUrl`); both call sites migrated |
| 12 | `react-helmet` unmaintained | Deprecated patterns | Low | ✅ Replaced by `react-helmet-async` (12 pages + `HelmetProvider` in `main.jsx`) |
| 13 | `vite.config.js` embeds ~200 lines of inline plugin scripts | Large module | Low | ✅ Fully removed 2026-08-12 — Horizons plugins, scripts, and Babel deps deleted; config is now ~60 lines of plain React setup |
| 14 | Company identity hardcoded in two places (TermsPage + invoice EF) | Duplication | Low | ⏸️ Documented pairing kept (different runtimes); revisit with a settings table |
| 15 | DB schema debt (text price, unconstrained statuses, duplicate email columns, orphan `time_slot_id`) | Deprecated patterns | Medium | ⏸️ Deferred — each item is a migration to ship with the feature that owns the table |
| 16 | Local Node 20.9 below Vite 7's required 20.19 | Environment | Low | 🧑 Owner: upgrade local Node to ≥ 20.19 (build works today with an engine warning) |

---

## 1. Duplicated Code

### 1.1 `use-toast` exists twice — one copy is dead (Medium) — ✅ RESOLVED 2026-08-10
- `src/components/ui/use-toast.js` (89 lines) — the **live** implementation; imported by every consumer (13 files) and by `toaster.jsx` itself.
- ~~`src/hooks/use-toast.js` (131 lines)~~ — **deleted 2026-08-10**. It had zero imports and carried an absurd `TOAST_REMOVE_DELAY = 1000000` (~16.7 minutes), which would have kept dismissed toasts in the DOM.

### 1.2 Profile fetch/update triplicated (Medium) — ✅ RESOLVED 2026-08-10
- All profile reads/writes now go through `src/lib/profileService.js` (`fetchProfile`, `getOrCreateProfile`, `updateProfile`, `profileToFormData`); `src/hooks/useProfile.js` backs `ProfileManagementPage`; `ProfileCompletionModal` and `LessonsPage` use the service directly.

### 1.3 Payment-proof signed URLs duplicated (Low) — ✅ RESOLVED 2026-08-10
- `PaymentVerificationPanel.jsx` and `PaymentProofPreview.jsx` both use `getSignedProofUrl()` from `src/lib/storage.js` (bucket name + 24h TTL as named constants).

### 1.4 Company identity in two places (Low) — ⏸️ DEFERRED (documented pairing)
- Legal name/address/email are hardcoded in `TermsPage.jsx` **and** in the `generate-invoice-pdf` Edge Function (`CO_NAME`, `CO_ADDR1`, …). Both MUST stay **CAG Padel Academy GmbH** (Decision 2026-08-19 dual identity). Product UI stays **AGC Padel Academy**. A legal-address change still means editing two runtimes.
- **Refactor:** acceptable as-is; optional later: a DB settings table for the GmbH block only — do not collapse AGC and CAG into one string.

---

## 2. Coupling Issues

### 2.1 Public-read bookings RLS ↔ availability grid (High) — ✅ RESOLVED 2026-08-10 (migration `0006`)
- Exactly the planned safe path was executed: non-PII `booking_slots` view created and granted to `anon`/`authenticated`; `src/lib/bookings.js` (`fetchDayBookings`) switched to it; `bookings` public-read policy dropped in favor of `Users can view own bookings` + `Admins can view all bookings`. `isMine` slot styling was vestigial (never rendered) and removed with the `user_id` projection.

### 2.2 Edge Functions: no gateway auth, full service role (High) — 🔶 PARTIALLY RESOLVED 2026-08-10
- `generate-invoice-pdf` **v22** and `notify-payment-verification` **v6** now run with `verify_jwt: true` at the gateway **and** verify the caller's JWT in-function: the invoice function requires booking ownership or `profiles.role = 'admin'`; the notification function is admin-only. Both return proper 401/403/404 responses. (v21/v5 used the implicit-header JWT check, which failed in this Deno `supabase-js` pin; v22/v6 pass the token explicitly — `api-contracts.md` §1.1.)
- **Remaining:** the 6 utility functions (`submit-contact-form`, `enable-notifications`, `cleanup-pending-bookings`, `merge-invoice-qr`, `upload-invoice-to-storage`, `verify-invoice-generation`, `upload-logo-once`) still run `verify_jwt: false`. `submit-contact-form`/`enable-notifications` must stay anonymous (public forms); the dormant/admin utilities should be hardened when they get real callers.

### 2.3 UI coupled to schema via raw query strings (Medium) — 🔶 PARTIALLY RESOLVED 2026-08-10
- Profile query shapes are centralized in `src/lib/profileService.js`; booking insert/availability/invoice invocation in `src/lib/bookings.js`; storage signed URLs in `src/lib/storage.js`. **Remaining:** the admin panel's embedded join string in `PaymentVerificationPanel.jsx` and `select('*')` habits in a few pages. The rename-breakage risk is now concentrated in one admin file.

### 2.4 Business workflow inside a page component (Medium) — ✅ RESOLVED 2026-08-10
- Booking creation + invoice invocation extracted to `src/lib/bookings.js` with 12 unit tests; `LessonsPage.jsx` is composition + state again.

### 2.5 Hardcoded admin email fallback (Medium) — ✅ RESOLVED 2026-08-10
- Fallback removed from `ProtectedRoute.jsx` after verifying the owner account has `profiles.role = 'admin'`. `role === 'admin'` is now the only path.

---

## 3. Missing Tests

### 3.1 Zero coverage on the money path (High) — 🔶 PARTIALLY RESOLVED 2026-08-10
**Done:** Vitest wired into the project (`npm test`, config in `vite.config.js`, `@/` alias inherited). 23 unit tests green across `src/lib/profileValidation.test.js` and `src/lib/bookings.test.js` (payload shape, availability query contract, booking insert, invoice invocation success/failure paths).

**Still untested:** admin payment verification flow (`PaymentVerificationPanel`), auth flows, RLS policies, and the `next_invoice_number` RPC race-safety. Next suites to add when those areas are touched: verification-flow test with mocked Supabase, and a DB integration test for the RPC (needs a Supabase test project or local stack).

---

## 4. Large Modules — ✅ RESOLVED 2026-08-10

Post-cleanup state: the two largest files were **dead code** (`sidebar.jsx` 577 lines, `chart.jsx` 279 lines — both deleted); `vite.config.js` dropped from 343 to ~60 lines (Horizons inline scripts were first extracted to `plugins/horizons/scripts/`, then the whole Horizons toolchain was removed 2026-08-12). Largest live modules now: `LessonsPage.jsx` (~370 lines after the `lib/bookings.js` extraction), `LoginPage.jsx` (360), `ProfileManagementPage.jsx` (~250 after the `useProfile` migration), `TermsPage.jsx` (267, static legal text — fine), `SupabaseAuthContext.jsx` (267 — watch it growing into a profile service; `useProfile` now exists for new work).

---

## 5. Deprecated Patterns

### 5.1 Dead UI inventory and its dependency cascade (Medium) — ✅ RESOLVED 2026-08-10
Deleted the full dead closure (verified via an import-graph script, `tools/find-dead-code.mjs`): 42 `ui/` components + 2 dead `hooks/` files — 44 files total. Surviving primitives: `button`, `calendar`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `tabs`, `toast`, `toaster`, `use-toast`. Uninstalled 30 packages with no live consumer: `recharts`, `react-hook-form`, `@hookform/resolvers`, `zod`, `embla-carousel-react`, `cmdk`, `vaul`, `input-otp`, `react-resizable-panels`, `@radix-ui/react-icons`, and 21 unused `@radix-ui/*` packages (324 packages removed from the tree overall).
**Form strategy note:** `react-hook-form` + `ui/form` (the shadcn form path) was removed because no page used it. The convention is now: hand-rolled controlled inputs + `Input`/`Label`. If complex forms appear, re-add via shadcn (`npx shadcn add form`) rather than hand-reviving.

### 5.2 Vulnerability exposure (Medium) — 🔶 PARTIALLY RESOLVED 2026-08-10
`npm audit fix` applied: **12 → 3** (1 low: esbuild dev-server file read, Windows dev only; 2 moderate: `react-router` 6.x advisories). Both remainders require breaking upgrades (React Router 7 major; esbuild beyond Vite 7's pin). Defer to a feature spec that owns the router upgrade; re-audit then.

### 5.3 `react-helmet` (Low) — ✅ RESOLVED 2026-08-10
Replaced with `react-helmet-async` (`HelmetProvider` in `main.jsx`; 12 page imports rewritten).

### 5.4 Dormant Edge Functions with stale contracts (Medium)
- `upload-invoice-to-storage` writes `invoices.status = 'completed'`, a value **outside** the CHECK constraint — it would fail if invoked today. Kept intentionally as the future flag-driven status-transition helper (decision 2026-08-07, `api-contracts.md §1.2`) — the debt is tracked, the fix is scheduled with that feature.
- `cleanup-pending-bookings` — dormant by decision; must never be scheduled (would cancel legitimate pending bank-transfer bookings). Consider deleting it rather than keeping a hazard around.

### 5.5 Database schema debt carried from the baseline (Medium)
From `supabase-backend.md §2` (not repeated in detail): `bookings.price` stored as `text` while `amount_paid` is `numeric`; `verification_status` has no CHECK constraint; `email` vs `client_email` duplicate columns; `time_slot` / `time_slot_id` / `start_time`+`end_time` triple representation (`time_slot_id` is an orphan with no target table); `invoices` has RLS enabled with zero policies.

### 5.6 Leftover platform artifacts (Low)
- ✅ **Hostinger Horizons dev plugins** — **removed 2026-08-12**: `plugins/` directory deleted, `vite.config.js` reduced to a plain React config, `@babel/*` runtime deps uninstalled, generator meta tag removed from `index.html`.
- ✅ **Stripe secrets** removed from Edge Function secrets (2026-08-10). Only remaining manual step: delete the webhook endpoint in the Stripe dashboard (harmless while it exists — the target function is gone).

### 5.7 Local toolchain (Low)
Node 20.9.0 vs Vite 7's required `^20.19 || >=22.12` — builds work today with an engine warning; upgrade Node to silence and de-risk.

---

## 6. Remaining Work (post-remediation, 2026-08-10 PM)

The prioritized list this document originally proposed has been **executed**. What remains:

1. **(Medium, spec-required)** DB debt cleanup (§5.5): numeric `price`, CHECK on `verification_status`, drop `time_slot_id`, resolve `email`/`client_email`. Each is a migration + code-touch — schedule with the feature that owns the table.
2. **(Medium)** React Router 7 upgrade to clear the 2 moderate advisories (§5.2); re-run `npm audit` after.
3. **(Medium)** Next test suites (§3.1): admin verification flow, auth flows, `next_invoice_number` RPC integration test.
4. **(Medium)** Harden the dormant/admin-only Edge Functions (`verify_jwt` or in-function checks) when they get real callers (§2.2).
5. **(Low)** `profiles` public SELECT tightening + `invoices` own-read policy — remaining steps of the RLS rollout (`api-contracts.md §7.1`).
6. ~~**🧑 Owner actions (outside repo reach):** upgrade local Node to ≥ 20.19; confirm/remove Stripe secrets in Edge Function secrets~~ — Stripe secrets confirmed removed (2026-08-10); Node `engines` pin added to `package.json` (`>=20.19`). Only remaining manual step: delete the stale webhook endpoint in the Stripe dashboard (harmless — the target function is deleted).

## 7. What Is *Not* Debt (deliberate decisions, do not "fix")

- `bookings` staying the lesson↔client pairing while `memberships`/`credits` await their feature spec (decision 2026-08-07).
- `upload-invoice-to-storage` kept with a known-wrong status value, annotated for the invoice-lifecycle feature.
- `merge-invoice-qr`, `verify-invoice-generation`, `upload-logo-once` retained as utilities despite no frontend caller.
- `invoices` and `payment-proofs` as separate buckets (privacy boundary, decision 2026-08-07).
