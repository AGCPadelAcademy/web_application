-- SQL verification for 0021_f125_camp_registration_billing_on_delete.
-- Apply 0021, then run these assertions.

SELECT pg_get_constraintdef(oid) ILIKE '%ON DELETE CASCADE%' AS documents_cascade
FROM pg_constraint
WHERE conname = 'billing_documents_camp_registration_id_fkey';

SELECT pg_get_constraintdef(oid) ILIKE '%ON DELETE SET NULL%' AS operations_document_set_null
FROM pg_constraint
WHERE conname = 'billing_operations_billing_document_id_fkey';

SELECT pg_get_constraintdef(oid) ILIKE '%ON DELETE SET NULL%' AS operations_registration_set_null
FROM pg_constraint
WHERE conname = 'billing_operations_camp_registration_id_fkey';

SELECT pg_get_constraintdef(oid) ILIKE '%ON DELETE SET NULL%' AS events_registration_set_null
FROM pg_constraint
WHERE conname = 'billing_events_camp_registration_id_fkey';

SELECT pg_get_constraintdef(oid) ILIKE '%ON DELETE CASCADE%' AS notifications_cascade
FROM pg_constraint
WHERE conname = 'notifications_log_camp_registration_id_fkey';

SELECT pg_get_constraintdef(oid) ILIKE '%exactly one%' OR pg_get_constraintdef(oid) ILIKE '%booking_id IS NOT NULL%' AS subject_check_kept
FROM pg_constraint
WHERE conname = 'billing_documents_exactly_one_subject_check';
