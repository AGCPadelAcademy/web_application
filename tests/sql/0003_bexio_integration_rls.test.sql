-- ============================================================================
-- RLS / schema assertions for migration 0003_bexio_integration (T005).
--
-- The repo has no SQL test runner, so this file uses DO blocks that RAISE
-- EXCEPTION on failure — run it via MCP `execute_sql` or the dashboard SQL
-- editor after applying 0003. It is read-only (catalog assertions only).
--
-- Note: "no INSERT/UPDATE/DELETE policies" is verified by counting pg_policies
-- rows; service-role write access bypasses RLS by design and needs no policy.
-- ============================================================================

DO $$
DECLARE
  t text;
  billing_tables text[] := ARRAY[
    'billing_integrations', 'billing_contacts', 'billing_documents',
    'billing_operations', 'billing_events'
  ];
  policy_count int;
BEGIN
  -- 1. All billing tables exist and have RLS enabled.
  FOREACH t IN ARRAY billing_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'FAIL: % missing or RLS not enabled', t;
    END IF;
  END LOOP;

  -- 2. Each billing table has exactly one SELECT policy and no write policies.
  FOREACH t IN ARRAY billing_tables LOOP
    SELECT count(*) INTO policy_count FROM pg_policies
    WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT';
    IF policy_count <> 1 THEN
      RAISE EXCEPTION 'FAIL: % should have exactly 1 SELECT policy, found %', t, policy_count;
    END IF;

    SELECT count(*) INTO policy_count FROM pg_policies
    WHERE schemaname = 'public' AND tablename = t AND cmd <> 'SELECT';
    IF policy_count <> 0 THEN
      RAISE EXCEPTION 'FAIL: % has % write policies (expected none)', t, policy_count;
    END IF;
  END LOOP;

  -- 3. billing_documents SELECT policy covers owner-or-admin.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_documents'
      AND qual LIKE '%is_admin%' AND qual LIKE '%auth.uid()%'
  ) THEN
    RAISE EXCEPTION 'FAIL: billing_documents SELECT policy is not owner-or-admin';
  END IF;

  -- 4. Vault RPCs are not executable by API roles.
  IF EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name IN ('billing_get_secret', 'billing_put_secret', 'billing_delete_secret')
      AND grantee IN ('anon', 'authenticated', 'PUBLIC')
  ) THEN
    RAISE EXCEPTION 'FAIL: vault RPCs are executable by anon/authenticated/PUBLIC';
  END IF;

  -- 5. bookings gained the additive payment-confirmation columns.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings'
      AND column_name = 'payment_confirmation_source'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings'
      AND column_name = 'payment_confirmed_at'
  ) THEN
    RAISE EXCEPTION 'FAIL: bookings payment confirmation columns missing';
  END IF;

  -- 6. billing_public_config view exists and is selectable by authenticated.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'billing_public_config'
  ) THEN
    RAISE EXCEPTION 'FAIL: billing_public_config view missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema = 'public' AND table_name = 'billing_public_config'
      AND grantee = 'authenticated' AND privilege_type = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'FAIL: billing_public_config not granted to authenticated';
  END IF;

  RAISE NOTICE 'PASS: all 0003_bexio_integration assertions succeeded';
END;
$$;
