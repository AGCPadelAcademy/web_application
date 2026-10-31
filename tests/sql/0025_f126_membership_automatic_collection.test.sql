-- Static assertions for 0025_f126_membership_automatic_collection.
-- Run after an explicit apply. This file does not apply the migration.

SELECT
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.collection_subjects'::regclass) AS subjects_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.collection_methods'::regclass) AS methods_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.direct_debit_mandates'::regclass) AS mandates_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.membership_period_intents'::regclass) AS intents_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.collection_requests'::regclass) AS requests_rls,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.membership_payment_signals'::regclass) AS signals_rls;

SELECT count(*) = 0 AS no_authenticated_writes
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'collection_subjects',
    'collection_methods',
    'direct_debit_mandates',
    'membership_period_intents',
    'collection_requests',
    'membership_payment_signals'
  )
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');

SELECT count(*) = 2 AS mandate_partial_uniques
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('direct_debit_mandates_one_proposal', 'direct_debit_mandates_one_active');

SELECT pg_get_constraintdef(oid) LIKE '%membership_period_intent_id%' AS three_subject_check
FROM pg_constraint
WHERE conname = 'billing_documents_exactly_one_subject_check';

SELECT count(*) = 1 AS charge_intent_link
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'membership_period_intents'
  AND column_name = 'charge_intent_id'
  AND is_nullable = 'YES';
