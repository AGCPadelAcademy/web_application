-- Run after 0010_private_projection_readers.sql.
-- Read-only assertions for projection-view architecture.

DO $$
DECLARE
  view_name text;
  function_name text;
BEGIN
  FOREACH view_name IN ARRAY ARRAY[
    'booking_slots',
    'billing_public_config',
    'session_roster'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = view_name
        AND c.relkind = 'v'
        AND 'security_invoker=true' = ANY (c.reloptions)
        AND 'security_barrier=true' = ANY (c.reloptions)
    ) THEN
      RAISE EXCEPTION 'FAIL: %.% is not a security-invoker barrier view',
        'public', view_name;
    END IF;
  END LOOP;

  FOREACH function_name IN ARRAY ARRAY[
    'booking_slots_rows',
    'billing_public_config_row',
    'session_roster_rows'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'private'
        AND p.proname = function_name
        AND p.prosecdef
        AND 'search_path=""' = ANY (p.proconfig)
    ) THEN
      RAISE EXCEPTION 'FAIL: private.% is not a fixed-search-path definer function',
        function_name;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('anon', 'public.booking_slots', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.booking_slots', 'SELECT')
     OR has_table_privilege('anon', 'public.booking_slots', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: booking_slots is not read-only for expected API roles';
  END IF;

  IF has_table_privilege('anon', 'public.billing_public_config', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.billing_public_config', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: billing_public_config grants are incorrect';
  END IF;

  IF has_table_privilege('anon', 'public.session_roster', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.session_roster', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: session_roster grants are incorrect';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('bookings_duplicate', 'invoice_counters', 'invoices')
      AND policyname = 'API roles denied'
      AND permissive = 'RESTRICTIVE'
  ) <> 3 THEN
    RAISE EXCEPTION 'FAIL: explicit deny policies missing';
  END IF;
END
$$;

SELECT '0010 private projection reader assertions passed' AS status;
