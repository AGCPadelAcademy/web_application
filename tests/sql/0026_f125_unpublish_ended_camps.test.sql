-- SQL verification for 0026_f125_unpublish_ended_camps (F1.25).
-- The end date stays published. The next Europe/Zurich day clears is_published.
-- Does not update camp rows; the migration already runs the function once.

SELECT
  position('end_date < v_today' in pg_get_functiondef('public.unpublish_ended_camps(date)'::regprocedure)) > 0 AS unpublishes_after_end_date,
  position('Europe/Zurich' in pg_get_functiondef('public.unpublish_ended_camps(date)'::regprocedure)) > 0 AS uses_zurich_calendar,
  has_function_privilege('service_role', 'public.unpublish_ended_camps(date)', 'EXECUTE') AS service_can_run,
  NOT has_function_privilege('anon', 'public.unpublish_ended_camps(date)', 'EXECUTE') AS anon_denied,
  NOT has_function_privilege('authenticated', 'public.unpublish_ended_camps(date)', 'EXECUTE') AS authenticated_denied;

SELECT count(*) = 0 AS no_published_camp_past_end_date
FROM public.camps
WHERE is_published
  AND end_date < (timezone('Europe/Zurich', now()))::date;
