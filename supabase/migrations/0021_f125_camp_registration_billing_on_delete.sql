-- ============================================================================
-- Migration: 0021_f125_camp_registration_billing_on_delete
-- Feature  : F1.25 Padel Camps
--
-- Deleting a camp_registrations row was blocked by
-- billing_documents_camp_registration_id_fkey (ON DELETE RESTRICT).
-- SET NULL is not possible: billing_documents_exactly_one_subject_check
-- requires camp_registration_id when booking_id is null.
-- ON DELETE CASCADE removes that registration's billing_documents row.
-- Sibling references that would raise the next 23503 are updated so the
-- registration delete can finish. Issued Bexio invoices are not cancelled
-- by this constraint change.
-- ============================================================================

ALTER TABLE public.billing_documents
  DROP CONSTRAINT billing_documents_camp_registration_id_fkey;

ALTER TABLE public.billing_documents
  ADD CONSTRAINT billing_documents_camp_registration_id_fkey
  FOREIGN KEY (camp_registration_id)
  REFERENCES public.camp_registrations(id)
  ON DELETE CASCADE;

-- An operation may point at the document. Null the pointer when the
-- document row is removed so the operation audit row can remain.
ALTER TABLE public.billing_operations
  DROP CONSTRAINT billing_operations_billing_document_id_fkey;

ALTER TABLE public.billing_operations
  ADD CONSTRAINT billing_operations_billing_document_id_fkey
  FOREIGN KEY (billing_document_id)
  REFERENCES public.billing_documents(id)
  ON DELETE SET NULL;

ALTER TABLE public.billing_operations
  DROP CONSTRAINT billing_operations_camp_registration_id_fkey;

ALTER TABLE public.billing_operations
  ADD CONSTRAINT billing_operations_camp_registration_id_fkey
  FOREIGN KEY (camp_registration_id)
  REFERENCES public.camp_registrations(id)
  ON DELETE SET NULL;

ALTER TABLE public.billing_events
  DROP CONSTRAINT billing_events_camp_registration_id_fkey;

ALTER TABLE public.billing_events
  ADD CONSTRAINT billing_events_camp_registration_id_fkey
  FOREIGN KEY (camp_registration_id)
  REFERENCES public.camp_registrations(id)
  ON DELETE SET NULL;

-- notifications_log has the same exactly-one-subject check, so SET NULL
-- would fail. Remove the log row with the registration.
ALTER TABLE public.notifications_log
  DROP CONSTRAINT notifications_log_camp_registration_id_fkey;

ALTER TABLE public.notifications_log
  ADD CONSTRAINT notifications_log_camp_registration_id_fkey
  FOREIGN KEY (camp_registration_id)
  REFERENCES public.camp_registrations(id)
  ON DELETE CASCADE;
