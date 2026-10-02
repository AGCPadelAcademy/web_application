-- ============================================================================
-- Migration: 0023_f125_junior_places_countdown
-- Feature  : F1.25 Padel Camps — convergence 9
--
-- Supersedes the C8 display trigger in 0022. Stored max_capacity is unchanged.
-- Junior window opens at 3 places remaining (active >= max_capacity - 3).
-- Ceiling stays max_capacity + 6. Display holds at 3 through
-- (ceiling - 3) active, then counts down (2, 1) and is full at the ceiling.
-- For a stored limit of 10: show 3 from 7 through 13, 2 at 14, 1 at 15,
-- waitlist at 16. Mini and Competition stay on max_capacity.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.camp_registration_ceiling(
  p_camp_type text,
  p_max_capacity integer,
  p_active integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN lower(btrim(COALESCE(p_camp_type, ''))) = 'junior'
      AND p_active >= GREATEST(p_max_capacity - 3, 0)
    THEN p_max_capacity + 6
    ELSE p_max_capacity
  END;
$$;

CREATE OR REPLACE FUNCTION public.camp_places_remaining(
  p_camp_type text,
  p_max_capacity integer,
  p_active integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_active >= public.camp_registration_ceiling(p_camp_type, p_max_capacity, p_active) THEN 0
    WHEN lower(btrim(COALESCE(p_camp_type, ''))) = 'junior'
      AND p_active >= GREATEST(p_max_capacity - 3, 0)
    THEN CASE
      WHEN p_active <= (p_max_capacity + 6) - 3 THEN 3
      ELSE GREATEST((p_max_capacity + 6) - p_active, 0)
    END
    ELSE GREATEST(p_max_capacity - p_active, 0)
  END;
$$;

REVOKE ALL ON FUNCTION public.camp_registration_ceiling(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.camp_registration_ceiling(text, integer, integer) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.camp_places_remaining(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.camp_places_remaining(text, integer, integer) TO anon, authenticated, service_role;
