-- ============================================================================
-- Migration: 0025_f126_membership_automatic_collection
-- Feature  : F1.26 membership automatic collection (issue #54)
--
-- This file is not applied until an explicit user request, and only after
-- 0024_f109_adult_memberships.sql. Confirm 0025 is still free before applying.
--
-- Copies F1.09 charge intents into an invoice inbox. It does not choose the
-- 1st, the 20th cutoff, or the 10% fee, and it does not change Membership status.
-- ============================================================================

-- 1. Operational tables ------------------------------------------------------

CREATE TABLE public.collection_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles (id),
  membership_ref uuid NOT NULL,
  display_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, membership_ref),
  UNIQUE (membership_ref)
);

CREATE TABLE public.collection_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL UNIQUE REFERENCES public.collection_subjects (id),
  method text NOT NULL CHECK (method IN ('automatic_collection', 'qr_invoice')),
  stopped_at timestamptz,
  updated_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.direct_debit_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.collection_subjects (id),
  attempt_no integer NOT NULL CHECK (attempt_no >= 1),
  status text NOT NULL CHECK (status IN (
    'not_requested', 'proposal_sent', 'active', 'rejected', 'revoked', 'failed', 'unsupported_bank'
  )),
  external_mandate_ref text,
  external_biller_ref text,
  failure_reason text,
  iban text,
  channel_status_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, attempt_no)
);

CREATE UNIQUE INDEX direct_debit_mandates_one_proposal
  ON public.direct_debit_mandates (subject_id)
  WHERE status = 'proposal_sent';

CREATE UNIQUE INDEX direct_debit_mandates_one_active
  ON public.direct_debit_mandates (subject_id)
  WHERE status = 'active';

CREATE TABLE public.membership_period_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.collection_subjects (id),
  period_key text NOT NULL,
  claim_kind text NOT NULL CHECK (claim_kind IN ('month', 'cancel_fee')),
  charge_intent_id uuid UNIQUE REFERENCES public.membership_charge_intents (id),
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'CHF' CHECK (currency = 'CHF'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'invoiced', 'collection_submitted', 'paid', 'collection_failed', 'reversed'
  )),
  paid_at timestamptz,
  duplicate_receipt boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, period_key)
);

CREATE TABLE public.collection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL UNIQUE REFERENCES public.membership_period_intents (id),
  mandate_id uuid NOT NULL REFERENCES public.direct_debit_mandates (id),
  status text NOT NULL CHECK (status IN ('submitted', 'confirmed', 'failed', 'rejected')),
  external_collection_ref text,
  failure_reason text,
  channel_status_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX collection_requests_external_ref
  ON public.collection_requests (external_collection_ref)
  WHERE external_collection_ref IS NOT NULL;

CREATE TABLE public.membership_payment_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES public.membership_period_intents (id),
  subject_id uuid NOT NULL REFERENCES public.collection_subjects (id),
  client_id uuid NOT NULL REFERENCES public.profiles (id),
  kind text NOT NULL CHECK (kind IN ('payment_confirmed', 'payment_reversed')),
  source text NOT NULL CHECK (source IN ('collection_channel', 'accounting_reconciliation')),
  occurred_at timestamptz NOT NULL,
  consumed_at timestamptz,
  UNIQUE (intent_id, kind)
);

-- 2. Billing spine -----------------------------------------------------------

ALTER TABLE public.billing_documents
  ADD COLUMN IF NOT EXISTS membership_period_intent_id uuid
    REFERENCES public.membership_period_intents (id);

ALTER TABLE public.billing_operations
  ADD COLUMN IF NOT EXISTS membership_period_intent_id uuid
    REFERENCES public.membership_period_intents (id);

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS membership_period_intent_id uuid
    REFERENCES public.membership_period_intents (id);

CREATE UNIQUE INDEX IF NOT EXISTS billing_documents_membership_period_intent_id_key
  ON public.billing_documents (membership_period_intent_id);

ALTER TABLE public.billing_documents
  DROP CONSTRAINT IF EXISTS billing_documents_exactly_one_subject_check;
ALTER TABLE public.billing_documents
  ADD CONSTRAINT billing_documents_exactly_one_subject_check
  CHECK (
    (booking_id IS NOT NULL AND camp_registration_id IS NULL AND membership_period_intent_id IS NULL)
    OR (booking_id IS NULL AND camp_registration_id IS NOT NULL AND membership_period_intent_id IS NULL)
    OR (booking_id IS NULL AND camp_registration_id IS NULL AND membership_period_intent_id IS NOT NULL)
  );

ALTER TABLE public.billing_operations
  DROP CONSTRAINT IF EXISTS billing_operations_kind_check;
ALTER TABLE public.billing_operations
  ADD CONSTRAINT billing_operations_kind_check
  CHECK (kind IN (
    'contact_sync',
    'invoice_issue',
    'invoice_cancel',
    'reconcile_check',
    'camp_invoice_issue',
    'camp_invoice_cancel',
    'membership_invoice_issue'
  ));

DROP POLICY IF EXISTS "Admins and owners can read billing documents" ON public.billing_documents;
CREATE POLICY "Admins and owners can read billing documents"
  ON public.billing_documents
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = billing_documents.booking_id
        AND bookings.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.camp_registrations
      WHERE camp_registrations.id = billing_documents.camp_registration_id
        AND camp_registrations.parent_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.membership_period_intents AS intent
      JOIN public.collection_subjects AS subject ON subject.id = intent.subject_id
      WHERE intent.id = billing_documents.membership_period_intent_id
        AND subject.client_id = (SELECT auth.uid())
    )
  );

-- 3. RLS: clients and admins may read; writes stay on the service role ------

ALTER TABLE public.collection_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_debit_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_period_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_payment_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY collection_subjects_read ON public.collection_subjects
  FOR SELECT TO authenticated
  USING (public.is_admin() OR client_id = (SELECT auth.uid()));

CREATE POLICY collection_methods_read ON public.collection_methods
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.collection_subjects AS subject
      WHERE subject.id = collection_methods.subject_id
        AND subject.client_id = (SELECT auth.uid())
    )
  );

CREATE POLICY direct_debit_mandates_read ON public.direct_debit_mandates
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.collection_subjects AS subject
      WHERE subject.id = direct_debit_mandates.subject_id
        AND subject.client_id = (SELECT auth.uid())
    )
  );

CREATE POLICY membership_period_intents_read ON public.membership_period_intents
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.collection_subjects AS subject
      WHERE subject.id = membership_period_intents.subject_id
        AND subject.client_id = (SELECT auth.uid())
    )
  );

CREATE POLICY collection_requests_read ON public.collection_requests
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.membership_period_intents AS intent
      JOIN public.collection_subjects AS subject ON subject.id = intent.subject_id
      WHERE intent.id = collection_requests.intent_id
        AND subject.client_id = (SELECT auth.uid())
    )
  );

CREATE POLICY membership_payment_signals_read ON public.membership_payment_signals
  FOR SELECT TO authenticated
  USING (public.is_admin() OR client_id = (SELECT auth.uid()));

GRANT SELECT ON public.collection_subjects TO authenticated;
GRANT SELECT ON public.collection_methods TO authenticated;
GRANT SELECT ON public.direct_debit_mandates TO authenticated;
GRANT SELECT ON public.membership_period_intents TO authenticated;
GRANT SELECT ON public.collection_requests TO authenticated;
GRANT SELECT ON public.membership_payment_signals TO authenticated;

GRANT ALL ON public.collection_subjects TO service_role;
GRANT ALL ON public.collection_methods TO service_role;
GRANT ALL ON public.direct_debit_mandates TO service_role;
GRANT ALL ON public.membership_period_intents TO service_role;
GRANT ALL ON public.collection_requests TO service_role;
GRANT ALL ON public.membership_payment_signals TO service_role;

-- 4. Hourly collection run, beside the existing reconciliation job ----------
-- The URL is the same project as 0004, with the function name replaced.
-- Schedule is hourly. The bexio-reconcile schedule is not changed.

DO $$
BEGIN
  PERFORM cron.unschedule('membership-collection-run');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

SELECT cron.schedule(
  'membership-collection-run',
  '0 * * * *',
  $cmd$
    SELECT net.http_post(
      url := 'https://jokjxpogvwxbwdaroqkc.supabase.co/functions/v1/membership-collection-run', -- pragma: allowlist secret
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scheduler-secret', public.billing_get_secret('bexio_scheduler_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cmd$
);
