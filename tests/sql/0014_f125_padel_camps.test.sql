-- SQL / RLS verification checklist for 0014_f125_padel_camps (F1.25).
--
-- T001: remote last applied migration is 0013_f104_inactive_auth_email_sync;
-- this file is 0014.
--
-- T009: MCP list_projects exposes only production
-- (`jokjxpogvwxbwdaroqkc` / AGC Padel Academy DDBB). Constitution forbids
-- applying DDL to production. Apply 0014 on an isolated test project, then
-- run the static assertions below. Do not run actor-matrix writes on production.
--
-- T011 capacity concurrency (quickstart §4.3): run on the test project after
-- apply. Recorded result: NOT RUN here — no isolated test project is linked
-- to this agent. Procedure:
--   1. Seed a published Camp with max_capacity = 1 and an open window.
--   2. As service_role, fire two concurrent register_camp_child calls for
--      distinct eligible children of the same or different parents.
--   3. Expect exactly one active registration (pending_payment/confirmed)
--      and the other call to raise camp_full.
--
-- The statements below are intentionally read-only by default. Replace actor
-- placeholders and execute each commented transaction with real JWT claims in
-- an isolated environment.

-- Schema/defaults and RLS remain present.
SELECT
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.camps'::regclass) AS camps_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.camp_extras'::regclass) AS extras_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.children'::regclass) AS children_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.camp_registrations'::regclass) AS registrations_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.camp_registration_extras'::regclass) AS registration_extras_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.camp_waitlist_entries'::regclass) AS waitlist_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.camp_funnel_events'::regclass) AS funnel_rls;

-- Public projection exists and is granted.
SELECT
  has_table_privilege('anon', 'public.camp_public_list', 'SELECT') AS anon_public_list,
  has_table_privilege('authenticated', 'public.camp_public_list', 'SELECT') AS auth_public_list;

SELECT array_agg(column_name ORDER BY ordinal_position) @> ARRAY[
  'slug', 'name', 'description', 'start_date', 'end_date',
  'daily_start_time', 'daily_end_time', 'schedule_text',
  'min_age', 'max_age', 'eligibility_text', 'price_amount', 'currency',
  'registration_opens_at', 'registration_deadline_at', 'waitlist_enabled',
  'is_full', 'places_remaining', 'extras'
]::name[] AS public_list_columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'camp_public_list';

-- Transactional functions are service-role only.
SELECT
  has_function_privilege('service_role', 'public.register_camp_child(uuid,uuid,uuid,uuid[],text)', 'EXECUTE') AS service_register,
  has_function_privilege('service_role', 'public.cancel_camp_registration(uuid)', 'EXECUTE') AS service_cancel,
  NOT has_function_privilege('authenticated', 'public.register_camp_child(uuid,uuid,uuid,uuid[],text)', 'EXECUTE') AS auth_register_denied,
  NOT has_function_privilege('anon', 'public.register_camp_child(uuid,uuid,uuid,uuid[],text)', 'EXECUTE') AS anon_register_denied,
  NOT has_function_privilege('authenticated', 'public.cancel_camp_registration(uuid)', 'EXECUTE') AS auth_cancel_denied;

-- No children DELETE policy (FR-006d).
SELECT count(*) = 0 AS no_children_delete_policy
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'children' AND cmd = 'DELETE';

-- Duplicate-active-registration partial unique index exists.
SELECT count(*) = 1 AS active_registration_unique
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'camp_registrations_active_duplicate_idx';

-- Waitlist active uniqueness + join-guard trigger.
SELECT count(*) = 1 AS waitlist_active_unique
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'camp_waitlist_active_unique_idx';

SELECT count(*) = 1 AS waitlist_guard_trigger
FROM pg_trigger
WHERE tgname = 'guard_camp_waitlist_join'
  AND tgrelid = 'public.camp_waitlist_entries'::regclass;

-- Billing spine: camp_registration_id + exactly-one-subject CHECK + kind CHECK.
SELECT
  (SELECT count(*) = 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_documents'
      AND column_name = 'camp_registration_id') AS documents_camp_col,
  (SELECT count(*) = 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_operations'
      AND column_name = 'camp_registration_id') AS operations_camp_col,
  (SELECT count(*) = 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_events'
      AND column_name = 'camp_registration_id') AS events_camp_col,
  (SELECT pg_get_constraintdef(oid) LIKE '%camp_invoice_issue%'
     FROM pg_constraint
    WHERE conrelid = 'public.billing_operations'::regclass
      AND conname = 'billing_operations_kind_check') AS operations_kind_extended;

-- Funnel table has no PII columns.
SELECT count(*) = 0 AS funnel_has_no_pii_columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'camp_funnel_events'
  AND column_name IN (
    'parent_id', 'child_id', 'email', 'phone', 'full_name', 'first_name',
    'last_name', 'date_of_birth', 'allergies', 'emergency_contact_name',
    'emergency_contact_phone'
  );

-- Actor matrix (execute with actual ids and always ROLLBACK):
--
-- BEGIN;
-- SET LOCAL ROLE authenticated;
-- SELECT set_config('request.jwt.claim.role', 'authenticated', true);
-- SELECT set_config('request.jwt.claim.sub', ':parent_a', true);
-- SELECT set_config('request.jwt.claims',
--   '{"sub":":parent_a","role":"authenticated"}', true);
-- SELECT * FROM public.children WHERE parent_id = ':parent_a';  -- own rows
-- SELECT * FROM public.children WHERE parent_id = ':parent_b';  -- zero rows
-- INSERT INTO public.children (parent_id, first_name, last_name)
--   VALUES (':parent_a', 'X', 'A');                             -- succeeds when active
-- DELETE FROM public.children WHERE parent_id = ':parent_a';    -- denied (no DELETE policy)
-- SELECT * FROM public.camp_public_list;                        -- published only
-- ROLLBACK;
--
-- As parent B:
-- * cannot SELECT parent A's children or registrations
--
-- As anon:
-- * SELECT camp_public_list (published Camps, derived is_full / places_remaining)
-- * cannot SELECT children / camp_registrations
--
-- As active admin:
-- * INSERT/UPDATE/DELETE camps and extras
-- * SELECT all children/registrations
--
-- As inactive parent:
-- * SELECT own children/registrations remains available
-- * INSERT/UPDATE children and waitlist join fail
--
-- register_camp_child refusals (service_role RPC):
-- * window not open → camp_closed
-- * deadline passed → camp_closed
-- * unpublished → camp_not_published
-- * archived child → child_archived
-- * age out of range at start_date → age_out_of_range
-- * extras not belonging to the Camp / inactive → extras_invalid
-- * missing emergency contact → emergency_contact_required
-- * duplicate active (parent, child, camp) → duplicate_registration
-- * last place taken concurrently → camp_full
--
-- guard_camp_waitlist_join:
-- * join refused when Camp is not full, unpublished, or waitlist_enabled = false
--   (error camp_waitlist_unavailable)
-- * duplicate active entry refused by camp_waitlist_active_unique_idx
