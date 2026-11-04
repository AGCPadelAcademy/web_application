-- SQL / RLS verification for 0024_f109_adult_memberships.
--
-- Static assertions. Run them after the migration is applied on an explicit
-- request. Do not apply the migration from this file.
-- Behavioral checks below are commented and must ROLLBACK.

SELECT
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.groups'::regclass) AS groups_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.memberships'::regclass) AS memberships_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.membership_state_events'::regclass) AS events_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.membership_charge_intents'::regclass) AS charges_rls;

SELECT
  (SELECT data_type = 'numeric' AND is_nullable = 'NO'
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memberships'
      AND column_name = 'monthly_price_amount') AS price_contract,
  (SELECT data_type = 'text' AND is_nullable = 'NO'
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memberships'
      AND column_name = 'status') AS status_contract,
  (SELECT count(*) = 5
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memberships'
      AND column_name IN ('plan_id', 'active', 'next_charge_date', 'start_date', 'user_id')) AS legacy_kept;

SELECT count(*) = 0 AS no_membership_delete_policy
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'memberships' AND cmd = 'DELETE';

SELECT count(*) = 5 AS membership_policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'memberships';

SELECT
  position('Europe/Zurich' IN pg_get_functiondef('public.guard_membership_status_transition()'::regprocedure)) > 0 AS cutoff_uses_zurich,
  position('0.10' IN pg_get_functiondef('public.create_membership_charges(date)'::regprocedure)) > 0 AS fee_is_ten_percent,
  position('cancel_fee' IN pg_get_functiondef('public.create_membership_charges(date)'::regprocedure)) > 0 AS fee_kind,
  NOT has_function_privilege('authenticated', 'public.create_membership_charges(date)', 'EXECUTE') AS clients_cannot_run_charges,
  has_function_privilege('service_role', 'public.create_membership_charges(date)', 'EXECUTE') AS service_can_run_charges;

SELECT reloptions @> ARRAY['security_invoker=true'] AS fixed_places_invoker
FROM pg_class
WHERE oid = 'public.membership_fixed_places'::regclass;

SELECT indexdef ILIKE '%WHERE%pending_payment%' AS one_live_place
FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'memberships_one_live_per_client_group';

-- Actor and calendar checks (always ROLLBACK):
--
-- On the 20th in Europe/Zurich, owner cancel sets cancellation_effective_on
-- to the last day of that month and the next 1st does not insert the next month.
-- On the 21st, the effective date is the last day of the next month and
-- create_membership_charges(first of next month) inserts that month once.
-- A second call the same day inserts nothing.
-- CHF 200 unpaid on the following 1st inserts one cancel_fee of 20.00,
-- no new month, and an Active row becomes Cancelled through the unpaid month.
-- Setting paid_at after the fee exists does not delete the fee.
-- A client cannot insert a membership or update another client's row.
