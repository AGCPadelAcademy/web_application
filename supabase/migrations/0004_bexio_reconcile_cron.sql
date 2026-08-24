-- ============================================================================
-- Migration: 0004_bexio_reconcile_cron
-- Purpose  : Register the scheduled reconciliation worker for the Bexio
--            integration (spec: specs/features/007-bexio-integration,
--            research R-09). Every 15 minutes pg_cron invokes the
--            `bexio-reconcile` Edge Function via pg_net with a shared secret.
--
-- Review notes
--   - Requires migration 0003 (billing_put_secret / billing_get_secret RPCs).
--   - The scheduler secret is generated per environment and lives ONLY in
--     Vault; the cron command reads it at run time, so it never appears in
--     this file.
--   - ENVIRONMENT: the function URL below targets the production project
--     (jokjxpogvwxbwdaroqkc). Adjust the project ref if applying to a
--     branch/staging project.
--   - Idempotent: an existing job with the same name is unscheduled first.
--   - Hosted Supabase: the migrator role cannot SELECT/UPDATE cron.job
--     (permission denied for table job). Use cron.unschedule / cron.schedule
--     only — those are SECURITY DEFINER. The job is created active because
--     bexio-reconcile is deployed with this story (T038).
--   - pg_net's default HTTP collector timeout is 5s; a full run against
--     several Bexio invoices takes longer. timeout_milliseconds := 60000
--     records the HTTP result. Closing the collector does not abort the
--     Edge Function (verified: reconciliation.run still persisted).
-- ============================================================================

-- Cron (and this migration) must be able to read the Vault-backed secret.
GRANT EXECUTE ON FUNCTION public.billing_get_secret(text) TO postgres;

-- 1. Scheduler shared secret (Vault only) ------------------------------------
-- Do not rotate an existing secret on re-apply.

DO $$
BEGIN
  IF public.billing_get_secret('bexio_scheduler_secret') IS NULL THEN
    PERFORM public.billing_put_secret(
      'bexio_scheduler_secret',
      gen_random_uuid()::text || gen_random_uuid()::text
    );
  END IF;
END;
$$;

-- 2. (Re)register the cron job ------------------------------------------------
-- cron.unschedule(name) raises if the job is absent; ignore that case.

DO $$
BEGIN
  PERFORM cron.unschedule('bexio-reconcile');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

SELECT cron.schedule(
  'bexio-reconcile',
  '*/15 * * * *',
  $cmd$
    SELECT net.http_post(
      url := 'https://jokjxpogvwxbwdaroqkc.supabase.co/functions/v1/bexio-reconcile',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scheduler-secret', public.billing_get_secret('bexio_scheduler_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cmd$
);

-- Verify afterwards (may require the dashboard SQL editor if cron.job is
-- not selectable by the current role):
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'bexio-reconcile';
--   SELECT status, return_message, start_time FROM cron.job_run_details
--     ORDER BY start_time DESC LIMIT 5;
