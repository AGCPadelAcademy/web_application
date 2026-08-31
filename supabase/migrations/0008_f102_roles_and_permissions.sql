-- ============================================================================
-- Migration: 0008_f102_roles_and_permissions
-- Feature : 008 F1.02 — student isolation leaks + live Coach assignment/roster
--
-- Live MCP sequence already used 0001–0007 (see constitution / supabase-backend.md).
-- This checkout only contains 0001–0002 in git; do not reuse 0003.
--
-- Apply via Supabase SQL editor (or MCP apply_migration). This project has no
-- separate test database; payment-proof storage is unused in the live SPA.
--
-- Storage: DROP all existing storage.objects policies whose expression
-- mentions payment-proofs, then recreate owner-path-or-admin policies.
--
-- T002 — live storage.objects policy names (MCP list was unavailable in the
-- implement environment; names vary). Observed shapes from 006 / baseline:
--   * authenticated SELECT on the whole payment-proofs bucket
--   * INSERT without a booking-id path check
--   * ALL granted on the public role
-- The DO block drops every policy whose USING/WITH CHECK mentions
-- 'payment-proofs', so DROP statements do not depend on exact titles.
-- ============================================================================

-- 1. GRANT EXECUTE on is_admin() (0001 revoked it; live 0007 restored it)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. is_coach() — same shape as is_admin()
CREATE OR REPLACE FUNCTION public.is_coach()
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
      AND role = 'coach'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_coach() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach() TO authenticated;

-- 3. bookings.coach_id
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS coach_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_coach_id_idx ON public.bookings(coach_id);

COMMENT ON COLUMN public.bookings.coach_id IS
  'F1.02 coach assignment. Null = unassigned. Target must have profiles.role = coach. Not availability.trainer_id.';

-- 4. Role immutability via PostgREST (FR-003)
CREATE OR REPLACE FUNCTION public.prevent_role_self_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(auth.role(), '') IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'role cannot be changed via the application'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_service ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_service
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_service();

-- Trigger functions must be executable by the role performing the UPDATE
-- (JWT `authenticated`). RETURNS trigger is not exposed as a PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.prevent_role_self_service() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_role_self_service() TO authenticated;

-- 5. coach_id: admin-only change; target must be role = coach (FR-007)
CREATE OR REPLACE FUNCTION public.prevent_non_admin_coach_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.coach_id IS NOT NULL THEN
      IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'only an administrator can change coach assignment'
          USING ERRCODE = '42501';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = NEW.coach_id AND role = 'coach'
      ) THEN
        RAISE EXCEPTION 'coach_id must reference a profile with role coach'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.coach_id IS DISTINCT FROM OLD.coach_id THEN
    IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'only an administrator can change coach assignment'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.coach_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.coach_id AND role = 'coach'
    ) THEN
      RAISE EXCEPTION 'coach_id must reference a profile with role coach'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_non_admin_coach_assignment ON public.bookings;
CREATE TRIGGER trg_prevent_non_admin_coach_assignment
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_non_admin_coach_assignment();

REVOKE EXECUTE ON FUNCTION public.prevent_non_admin_coach_assignment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_non_admin_coach_assignment() TO authenticated;

-- 6. Drop public profile SELECT (FR-004)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Keep own-or-admin SELECT (recreate idempotently)
DROP POLICY IF EXISTS "Users can read own profile role" ON public.profiles;
CREATE POLICY "Users can read own profile role"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin());

-- 7. session_roster — operational columns only (FR-008)
-- security_invoker = false: view owner reads bookings/profiles; filter uses JWT auth.uid().
DROP VIEW IF EXISTS public.session_roster;
CREATE VIEW public.session_roster
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  b.id AS booking_id,
  b.booking_date,
  b.start_time,
  b.end_time,
  b.lesson_name,
  COALESCE(NULLIF(p.full_name, ''), 'Student') AS participant_full_name,
  b.coach_id
FROM public.bookings b
JOIN public.profiles p ON p.id = b.user_id
WHERE public.is_admin()
   OR (
     public.is_coach()
     AND b.coach_id = (SELECT auth.uid())
   );

REVOKE ALL ON public.session_roster FROM PUBLIC, anon;
GRANT SELECT ON public.session_roster TO authenticated;

COMMENT ON VIEW public.session_roster IS
  'F1.02 coach/admin operational roster. No price, payment, email, or proof columns.';

-- 8. payment-proofs storage: drop leaked policies, owner-path-or-admin
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%payment-proofs%'
        OR COALESCE(with_check, '') ILIKE '%payment-proofs%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "payment-proofs owner or admin select" ON storage.objects;
DROP POLICY IF EXISTS "payment-proofs owner insert" ON storage.objects;

CREATE POLICY "payment-proofs owner or admin select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.id = (
          CASE
            WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN (storage.foldername(name))[1]::uuid
            ELSE NULL
          END
        )
        AND b.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "payment-proofs owner insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.id = (
          CASE
            WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN (storage.foldername(name))[1]::uuid
            ELSE NULL
          END
        )
        AND b.user_id = (SELECT auth.uid())
      )
    )
  );

-- Reload PostgREST so `coach_id` / `session_roster` are visible without a restart.
NOTIFY pgrst, 'reload schema';
