-- ============================================================================
-- Migration: 0026_f125_unpublish_ended_camps
-- Feature  : F1.25 Padel Camps
--
-- A camp stays published through its inclusive end_date. The next
-- Europe/Zurich calendar day, is_published is set false so an admin does
-- not have to unpublish it. Historical registrations are left in place.
--
-- Production already applied 0025_f126_membership_automatic_collection, so
-- this file is 0026.
--
-- pg_cron runs in UTC. 23:05 UTC is 00:05 Europe/Zurich in winter and
-- 01:05 in summer, which is the Zurich day after end_date.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unpublish_ended_camps(p_on date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today date := COALESCE(p_on, (timezone('Europe/Zurich', pg_catalog.now()))::date);
  v_count integer;
BEGIN
  UPDATE public.camps
  SET is_published = false,
      updated_at = pg_catalog.now()
  WHERE is_published
    AND end_date < v_today;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.unpublish_ended_camps(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_ended_camps(date) TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('unpublish-ended-camps');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

SELECT cron.schedule(
  'unpublish-ended-camps',
  '5 23 * * *',
  $cmd$SELECT public.unpublish_ended_camps();$cmd$
);

SELECT public.unpublish_ended_camps();
