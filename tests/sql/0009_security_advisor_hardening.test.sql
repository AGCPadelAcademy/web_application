-- Run after 0009_security_advisor_hardening.sql.
-- Read-only assertions: raises on any unintended API privilege.

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: handle_new_user remains callable through PostgREST';
  END IF;

  IF has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: rls_auto_enable remains callable through PostgREST';
  END IF;

  IF NOT has_table_privilege('anon', 'public.booking_slots', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.booking_slots', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: booking_slots public read was removed';
  END IF;

  IF has_table_privilege('anon', 'public.booking_slots', 'INSERT')
     OR has_table_privilege('anon', 'public.booking_slots', 'UPDATE')
     OR has_table_privilege('anon', 'public.booking_slots', 'DELETE')
     OR has_table_privilege('authenticated', 'public.booking_slots', 'INSERT')
     OR has_table_privilege('authenticated', 'public.booking_slots', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.booking_slots', 'DELETE') THEN
    RAISE EXCEPTION 'FAIL: booking_slots remains writable by an API role';
  END IF;

  IF has_table_privilege('anon', 'public.billing_public_config', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.billing_public_config', 'SELECT')
     OR has_table_privilege('authenticated', 'public.billing_public_config', 'INSERT')
     OR has_table_privilege('authenticated', 'public.billing_public_config', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.billing_public_config', 'DELETE') THEN
    RAISE EXCEPTION 'FAIL: billing_public_config grants are not authenticated read-only';
  END IF;

  IF has_table_privilege('anon', 'public.session_roster', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.session_roster', 'SELECT')
     OR has_table_privilege('authenticated', 'public.session_roster', 'INSERT')
     OR has_table_privilege('authenticated', 'public.session_roster', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.session_roster', 'DELETE') THEN
    RAISE EXCEPTION 'FAIL: session_roster grants are not authenticated read-only';
  END IF;

  IF has_table_privilege('anon', 'public.invoices', 'SELECT')
     OR has_table_privilege('authenticated', 'public.invoices', 'SELECT')
     OR has_table_privilege('anon', 'public.invoice_counters', 'SELECT')
     OR has_table_privilege('authenticated', 'public.invoice_counters', 'SELECT')
     OR has_table_privilege('anon', 'public.bookings_duplicate', 'SELECT')
     OR has_table_privilege('authenticated', 'public.bookings_duplicate', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: service-role-only table retains API SELECT';
  END IF;
END
$$;

SELECT '0009 security advisor hardening assertions passed' AS status;
