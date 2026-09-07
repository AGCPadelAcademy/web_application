-- ============================================================================
-- Migration: 0011_f104_client_management
-- Feature  : F1.04 client profile lifecycle and least-privilege management
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.date_of_birth IS
  'Optional client-controlled date of birth. Must not be in the future.';
COMMENT ON COLUMN public.profiles.is_active IS
  'Non-destructive academy lifecycle flag. Inactive profiles retain read access to their history.';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
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
      AND is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS boolean
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
      AND is_active
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_coach() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coach() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text := COALESCE(auth.role(), '');
  caller_is_admin boolean := false;
  signed_email text := auth.jwt() ->> 'email';
  active_admin_count integer;
BEGIN
  IF NEW.date_of_birth IS NOT NULL AND NEW.date_of_birth > CURRENT_DATE THEN
    RAISE EXCEPTION 'date of birth cannot be in the future'
      USING ERRCODE = '22007';
  END IF;

  -- Trusted maintenance and service-role operations are outside the browser
  -- field contract, but remain subject to the DOB invariant above.
  IF caller_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  caller_is_admin := public.is_admin();

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profile id cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email AND NOT (
    caller_id = OLD.id
    AND signed_email IS NOT NULL
    AND NEW.email = signed_email
    AND NEW.first_name IS NOT DISTINCT FROM OLD.first_name
    AND NEW.last_name IS NOT DISTINCT FROM OLD.last_name
    AND NEW.full_name IS NOT DISTINCT FROM OLD.full_name
    AND NEW.phone IS NOT DISTINCT FROM OLD.phone
    AND NEW.address IS NOT DISTINCT FROM OLD.address
    AND NEW.postal_code IS NOT DISTINCT FROM OLD.postal_code
    AND NEW.city IS NOT DISTINCT FROM OLD.city
    AND NEW.country IS NOT DISTINCT FROM OLD.country
    AND NEW.country_code IS NOT DISTINCT FROM OLD.country_code
    AND NEW.date_of_birth IS NOT DISTINCT FROM OLD.date_of_birth
    AND NEW.role IS NOT DISTINCT FROM OLD.role
    AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
  ) THEN
    RAISE EXCEPTION 'profile email is managed by authentication'
      USING ERRCODE = '42501';
  END IF;

  IF caller_is_admin THEN
    IF caller_id = OLD.id AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'an administrator cannot change their own role'
        USING ERRCODE = '42501';
    END IF;
    IF caller_id = OLD.id AND OLD.is_active AND NOT NEW.is_active THEN
      RAISE EXCEPTION 'an administrator cannot deactivate their own profile'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role AND NEW.role = 'accounting' THEN
      RAISE EXCEPTION 'accounting is managed in Bexio'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF caller_id IS NULL OR caller_id <> OLD.id THEN
      RAISE EXCEPTION 'profile update is not permitted'
        USING ERRCODE = '42501';
    END IF;
    IF NOT OLD.is_active THEN
      RAISE EXCEPTION 'client profile is inactive'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'protected profile field cannot be changed'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF OLD.role = 'admin'
     AND OLD.is_active
     AND (NEW.role <> 'admin' OR NOT NEW.is_active) THEN
    PERFORM pg_advisory_xact_lock(hashtext('f104-active-admin-invariant'));
    SELECT count(*)
      INTO active_admin_count
      FROM public.profiles
     WHERE role = 'admin'
       AND is_active;
    IF active_admin_count <= 1 THEN
      RAISE EXCEPTION 'at least one active administrator is required'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_service ON public.profiles;
DROP TRIGGER IF EXISTS trg_guard_profile_mutation ON public.profiles;
CREATE TRIGGER trg_guard_profile_mutation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_mutation();

REVOKE EXECUTE ON FUNCTION public.guard_profile_mutation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_profile_mutation() TO authenticated;

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Active users can update own profile" ON public.profiles;
CREATE POLICY "Active users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND is_active
  )
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Active admins can update profiles" ON public.profiles;
CREATE POLICY "Active admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users insert own bookings" ON public.bookings;
CREATE POLICY "Users insert own bookings"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_active
    )
  );

DROP POLICY IF EXISTS "Users update own bookings" ON public.bookings;
CREATE POLICY "Users update own bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_active
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_active
    )
  );

DROP VIEW IF EXISTS public.session_roster;
DROP FUNCTION IF EXISTS private.session_roster_rows();

CREATE FUNCTION private.session_roster_rows()
RETURNS TABLE (
  booking_id uuid,
  booking_date date,
  start_time time without time zone,
  end_time time without time zone,
  lesson_name text,
  participant_id uuid,
  participant_full_name text,
  participant_phone text,
  coach_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    b.id AS booking_id,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.lesson_name,
    b.user_id AS participant_id,
    COALESCE(NULLIF(p.full_name, ''), 'Student') AS participant_full_name,
    p.phone AS participant_phone,
    b.coach_id
  FROM public.bookings b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE public.is_admin()
     OR (
       public.is_coach()
       AND b.coach_id = (SELECT auth.uid())
     );
$$;

REVOKE ALL ON FUNCTION private.session_roster_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.session_roster_rows()
  TO authenticated, service_role;

CREATE VIEW public.session_roster
WITH (security_barrier = true, security_invoker = true)
AS
SELECT * FROM private.session_roster_rows();

REVOKE ALL ON public.session_roster FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.session_roster TO authenticated;

COMMENT ON VIEW public.session_roster IS
  'F1.04 assignment-scoped coach/admin roster. Exposes current participant identity and phone only.';

NOTIFY pgrst, 'reload schema';
