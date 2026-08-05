-- ============================================================================
-- Migration: 0001_add_roles_and_admin_rls
-- Purpose  : Add an application role column to `profiles`, seed the existing
--            admin user, and enforce admin-only writes on the tables the
--            PaymentVerificationPanel mutates (server-side authorization).
--
-- Review notes
--   - This file is for review. Apply it via the Supabase MCP `apply_migration`
--     tool or the Supabase dashboard SQL editor once you have reviewed it.
--   - All statements are idempotent where practical (IF NOT EXISTS, etc.).
--   - The previous "Service Role Full Access Payment Proofs" policy on the
--     `public` role is dropped because it bypasses RLS for everyone (Supabase
--     advisor warning 0024).
-- ============================================================================

-- 1. Add `role` column to `profiles` ---------------------------------------
-- Allowed values: student (default), coach, accounting, admin.
-- Use TEXT + CHECK instead of an enum so future role additions don't need
-- ALTER TYPE statements.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'coach', 'accounting', 'admin'));

-- 2. Seed the admin user -------------------------------------------------
-- Backward compatibility: the legacy client-side check treated
-- `admin@agcpadelacademy.com` as the admin, but that user never existed in
-- auth.users. The actual project owner is josep.barbera.reverte.1999@gmail.com.
-- Match by auth.users email (the profiles.email column was left NULL by the
-- old session-sync code, so an email match on profiles would miss the row).
UPDATE public.profiles
  SET role = 'admin'
  WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'josep.barbera.reverte.1999@gmail.com'
  );

-- 3. Helper function: is_admin() ------------------------------------------
-- Used by RLS policies. Wraps auth.uid() in a SELECT to avoid the planner
-- caching the per-row value (Supabase advisor perf warning).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

-- Revoke execute from anon/authenticated — only RLS policies should call this.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;

-- 4. payment_proofs: admin-only UPDATE ------------------------------------
-- Drop the permissive "Service Role Full Access Payment Proofs" policy that
-- was applied to the `public` role (it effectively disabled RLS for everyone).
DROP POLICY IF EXISTS "Service Role Full Access Payment Proofs" ON public.payment_proofs;

-- Allow admins to update any payment proof (approve/reject).
DROP POLICY IF EXISTS "Admins can update any payment proof" ON public.payment_proofs;
CREATE POLICY "Admins can update any payment proof"
  ON public.payment_proofs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Keep existing per-user SELECT (users see proofs for their own bookings).
-- If a per-user SELECT policy already exists, this is a no-op due to IF NOT
-- EXISTS being unsupported for CREATE POLICY — we DROP + CREATE to be safe.
-- Review the existing SELECT policies on payment_proofs before running this
-- section if you want to preserve a custom-named one.
DROP POLICY IF EXISTS "Users can view their own payment proofs" ON public.payment_proofs;
CREATE POLICY "Users can view their own payment proofs"
  ON public.payment_proofs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = payment_proofs.booking_id
        AND bookings.user_id = (SELECT auth.uid())
    ) OR public.is_admin()
  );

-- Keep users able to INSERT their own payment proofs.
DROP POLICY IF EXISTS "Users can insert their own payment proofs" ON public.payment_proofs;
CREATE POLICY "Users can insert their own payment proofs"
  ON public.payment_proofs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = payment_proofs.booking_id
        AND bookings.user_id = (SELECT auth.uid())
    )
  );

-- 5. bookings: admin can update any row (verify payment, mark confirmed) --
-- The PaymentVerificationPanel updates booking status when approving/rejecting
-- proofs. Without an admin bypass, that UPDATE would fail because the existing
-- policy only allows `auth.uid() = user_id`.
DROP POLICY IF EXISTS "Admins can update any booking" ON public.bookings;
CREATE POLICY "Admins can update any booking"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. profiles: users can read their own role (already covered by public
--    SELECT in the current schema, kept here explicitly for clarity) ------
DROP POLICY IF EXISTS "Users can read own profile role" ON public.profiles;
CREATE POLICY "Users can read own profile role"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());

-- 7. Index for role lookups (optional, small table) -----------------------
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- ============================================================================
-- Post-migration checklist
--   1. In the Supabase Auth dashboard, make sure these redirect URLs are in
--      the "Allowed Redirect URLs" list:
--        - http://localhost:3000/auth/callback
--        - http://localhost:3000/reset-password
--        - https://agcpadelacademy.com/auth/callback
--        - https://agcpadelacademy.com/reset-password
--   2. Decide whether to keep "Confirm email" enabled. The frontend expects
--      it (toasts say "check your email"). If you disable it, sign-up will
--      log the user in immediately and onAuthStateChange will also fire.
--   3. Enable "Leaked password protection" (HaveIBeenPwned) in Auth settings.
--   4. (Optional) Add the coach role's per-user policies when you implement
--      the coach dashboard (e.g. coaches can update bookings where
--      bookings.trainer_id = auth.uid()).
-- ============================================================================
