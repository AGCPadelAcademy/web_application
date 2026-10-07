-- ============================================================================
-- Migration: 0024_f106_coach_management
-- Feature  : F1.06 Coach management
--
-- A new or changed bookings.coach_id must name an active coach. Leaving
-- coach_id unchanged is allowed after that coach is deactivated, and
-- deactivation does not rewrite bookings. Confirmed unused on the remote
-- history that ends at 0023_f125_junior_places_countdown (2026-10-07).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_non_admin_coach_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  assignment_changed boolean := TRUE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    assignment_changed := NEW.coach_id IS DISTINCT FROM OLD.coach_id;
  END IF;

  IF NOT assignment_changed OR NEW.coach_id IS NULL THEN
    IF TG_OP = 'UPDATE'
      AND assignment_changed
      AND COALESCE(auth.role(), '') IN ('authenticated', 'anon')
      AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'only an administrator can change coach assignment'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'only an administrator can change coach assignment'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = NEW.coach_id
      AND role = 'coach'
  ) THEN
    RAISE EXCEPTION 'coach_id must reference a profile with role coach'
      USING ERRCODE = '23514';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = NEW.coach_id
      AND role = 'coach'
      AND is_active
  ) THEN
    RAISE EXCEPTION 'coach_id must reference an active coach'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_non_admin_coach_assignment() IS
  'F1.06: admin-only coach_id changes. A new non-null coach must be active. Unchanged coach_id stays after deactivation.';

REVOKE EXECUTE ON FUNCTION public.prevent_non_admin_coach_assignment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_non_admin_coach_assignment() TO authenticated;

NOTIFY pgrst, 'reload schema';
