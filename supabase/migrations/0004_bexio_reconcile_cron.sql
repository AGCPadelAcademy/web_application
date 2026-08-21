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
--   - Idempotent: an existing job with the same name is replaced.
-- ============================================================================

-- 1. Scheduler shared secret (Vault only) ------------------------------------

SELECT public.billing_put_secret(
  'bexio_scheduler_secret',
  gen_random_uuid()::text || gen_random_uuid()::text
);

-- 2. (Re)register the cron job ------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bexio-reconcile') THEN
    PERFORM cron.unschedule('bexio-reconcile');
  END IF;
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
      body := '{}'::jsonb
    );
  $cmd$
);

-- The bexio-reconcile Edge Function is deployed in Phase 5 (T034). Until then
-- the job stays inactive so it does not log 404 failures every 15 minutes.
-- Activate with: UPDATE cron.job SET active = true WHERE jobname = 'bexio-reconcile';
UPDATE cron.job SET active = false WHERE jobname = 'bexio-reconcile';

-- Verify afterwards with:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'bexio-reconcile';
--   SELECT status, return_message, start_time FROM cron.job_run_details
--     ORDER BY start_time DESC LIMIT 5;
