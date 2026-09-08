-- ============================================================================
-- Migration: 0014_f125_padel_camps
-- Feature  : F1.25 Padel Camps / Camps Registration
-- Spec     : specs/features/010-padel-camps/
--
-- T001 numbering: remote project last applied migration is
-- 0013_f104_inactive_auth_email_sync (20260907115850). Next file is 0014.
-- Additive only: new Camp/child/registration tables plus camp_registration_id
-- on billing_* (and notifications_log for invoice/confirmation idempotency).
-- ============================================================================

-- 1. Camps ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.camps (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                      text NOT NULL UNIQUE,
  name                      text NOT NULL,
  description               text,
  start_date                date NOT NULL,
  end_date                  date NOT NULL,
  daily_start_time          time,
  daily_end_time            time,
  schedule_text             text,
  min_age                   smallint,
  max_age                   smallint,
  eligibility_text          text,
  price_amount              numeric(10, 2) NOT NULL,
  currency                  text NOT NULL DEFAULT 'CHF',
  max_capacity              integer NOT NULL,
  registration_opens_at     timestamptz,
  registration_deadline_at  timestamptz,
  is_published              boolean NOT NULL DEFAULT false,
  waitlist_enabled          boolean NOT NULL DEFAULT false,
  practical_info            text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT camps_end_date_gte_start CHECK (end_date >= start_date),
  CONSTRAINT camps_min_age_nonneg CHECK (min_age IS NULL OR min_age >= 0),
  CONSTRAINT camps_max_age_gte_min CHECK (max_age IS NULL OR min_age IS NULL OR max_age >= min_age),
  CONSTRAINT camps_price_nonneg CHECK (price_amount >= 0),
  CONSTRAINT camps_capacity_positive CHECK (max_capacity > 0),
  CONSTRAINT camps_currency_chf CHECK (currency = 'CHF')
);

CREATE TABLE IF NOT EXISTS public.camp_extras (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id       uuid NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  price_amount  numeric(10, 2) NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT camp_extras_price_nonneg CHECK (price_amount >= 0)
);

CREATE INDEX IF NOT EXISTS camp_extras_camp_id_idx ON public.camp_extras(camp_id);

-- 2. Children (parent-owned dependents; never logins) -----------------------

CREATE TABLE IF NOT EXISTS public.children (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id                uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  first_name               text NOT NULL,
  last_name                text NOT NULL,
  date_of_birth            date,
  padel_level              text,
  allergies                text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  archived_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT children_dob_not_future CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE)
);

CREATE INDEX IF NOT EXISTS children_parent_id_idx ON public.children(parent_id);

-- 3. Registrations + extras snapshots ---------------------------------------

CREATE TABLE IF NOT EXISTS public.camp_registrations (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id                      uuid NOT NULL REFERENCES public.camps(id) ON DELETE RESTRICT,
  child_id                     uuid NOT NULL REFERENCES public.children(id) ON DELETE RESTRICT,
  parent_id                    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status                       text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'confirmed', 'cancelled')),
  payment_status               text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'confirmed', 'cancelled')),
  child_first_name             text NOT NULL,
  child_last_name              text NOT NULL,
  child_date_of_birth          date,
  padel_level                  text,
  allergies                    text,
  emergency_contact_name       text,
  emergency_contact_phone      text,
  parent_full_name             text NOT NULL,
  parent_email                 text NOT NULL,
  parent_phone                 text,
  camp_name                    text NOT NULL,
  camp_start_date              date NOT NULL,
  camp_end_date                date NOT NULL,
  camp_schedule_text           text,
  base_price                   numeric(10, 2) NOT NULL,
  extras_total                 numeric(10, 2) NOT NULL DEFAULT 0,
  total_amount                 numeric(10, 2) NOT NULL,
  currency                     text NOT NULL DEFAULT 'CHF',
  terms_version                text,
  terms_accepted_at            timestamptz,
  payment_confirmation_source  text CHECK (payment_confirmation_source IS NULL OR payment_confirmation_source = 'bexio_reconciliation'),
  payment_confirmed_at         timestamptz,
  cancelled_at                 timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT camp_registrations_currency_chf CHECK (currency = 'CHF'),
  CONSTRAINT camp_registrations_totals_nonneg CHECK (
    base_price >= 0 AND extras_total >= 0 AND total_amount >= 0
  )
);

CREATE INDEX IF NOT EXISTS camp_registrations_camp_status_idx
  ON public.camp_registrations(camp_id, status);
CREATE INDEX IF NOT EXISTS camp_registrations_parent_idx
  ON public.camp_registrations(parent_id);
CREATE INDEX IF NOT EXISTS camp_registrations_child_idx
  ON public.camp_registrations(child_id);

CREATE UNIQUE INDEX IF NOT EXISTS camp_registrations_active_duplicate_idx
  ON public.camp_registrations(parent_id, child_id, camp_id)
  WHERE status IN ('pending_payment', 'confirmed');

CREATE TABLE IF NOT EXISTS public.camp_registration_extras (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_registration_id  uuid NOT NULL REFERENCES public.camp_registrations(id) ON DELETE CASCADE,
  camp_extra_id         uuid REFERENCES public.camp_extras(id) ON DELETE SET NULL,
  name                  text NOT NULL,
  price_amount          numeric(10, 2) NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT camp_registration_extras_price_nonneg CHECK (price_amount >= 0)
);

CREATE INDEX IF NOT EXISTS camp_registration_extras_reg_idx
  ON public.camp_registration_extras(camp_registration_id);

-- 4. Waitlist + funnel ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.camp_waitlist_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id     uuid NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  child_id    uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  parent_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'converted', 'removed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS camp_waitlist_active_unique_idx
  ON public.camp_waitlist_entries(parent_id, child_id, camp_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS camp_waitlist_camp_created_idx
  ON public.camp_waitlist_entries(camp_id, created_at);

CREATE TABLE IF NOT EXISTS public.camp_funnel_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  camp_id     uuid REFERENCES public.camps(id) ON DELETE SET NULL,
  event       text NOT NULL
    CHECK (event IN (
      'camps_page_view',
      'camp_registration_started',
      'camp_registration_completed',
      'camp_payment_confirmed'
    )),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 5. Additive billing + notification columns --------------------------------

ALTER TABLE public.billing_documents
  ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE public.billing_documents
  ADD COLUMN IF NOT EXISTS camp_registration_id uuid
    REFERENCES public.camp_registrations(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'billing_documents_camp_registration_id_key'
      AND conrelid = 'public.billing_documents'::regclass
  ) THEN
    ALTER TABLE public.billing_documents
      ADD CONSTRAINT billing_documents_camp_registration_id_key UNIQUE (camp_registration_id);
  END IF;
END $$;

ALTER TABLE public.billing_documents
  DROP CONSTRAINT IF EXISTS billing_documents_exactly_one_subject_check;
ALTER TABLE public.billing_documents
  ADD CONSTRAINT billing_documents_exactly_one_subject_check
  CHECK (
    (booking_id IS NOT NULL AND camp_registration_id IS NULL)
    OR (booking_id IS NULL AND camp_registration_id IS NOT NULL)
  );

ALTER TABLE public.billing_operations
  ADD COLUMN IF NOT EXISTS camp_registration_id uuid
    REFERENCES public.camp_registrations(id);

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
    'camp_invoice_cancel'
  ));

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS camp_registration_id uuid
    REFERENCES public.camp_registrations(id);

ALTER TABLE public.notifications_log
  ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE public.notifications_log
  ADD COLUMN IF NOT EXISTS camp_registration_id uuid
    REFERENCES public.camp_registrations(id) ON DELETE RESTRICT;

ALTER TABLE public.notifications_log
  DROP CONSTRAINT IF EXISTS notifications_log_exactly_one_subject_check;
ALTER TABLE public.notifications_log
  ADD CONSTRAINT notifications_log_exactly_one_subject_check
  CHECK (
    (booking_id IS NOT NULL AND camp_registration_id IS NULL)
    OR (booking_id IS NULL AND camp_registration_id IS NOT NULL)
  );

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
  );

-- 6. Occupancy helper (count only; no PII) for the public view --------------

CREATE OR REPLACE FUNCTION public.camp_active_registration_count(p_camp_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::integer
  FROM public.camp_registrations
  WHERE camp_id = p_camp_id
    AND status IN ('pending_payment', 'confirmed');
$$;

REVOKE ALL ON FUNCTION public.camp_active_registration_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.camp_active_registration_count(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.camp_public_list
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.description,
  c.start_date,
  c.end_date,
  c.daily_start_time,
  c.daily_end_time,
  c.schedule_text,
  c.min_age,
  c.max_age,
  c.eligibility_text,
  c.price_amount,
  c.currency,
  c.registration_opens_at,
  c.registration_deadline_at,
  c.waitlist_enabled,
  GREATEST(c.max_capacity - public.camp_active_registration_count(c.id), 0) AS places_remaining,
  (public.camp_active_registration_count(c.id) >= c.max_capacity) AS is_full,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'description', e.description,
        'price_amount', e.price_amount,
        'sort_order', e.sort_order
      )
      ORDER BY e.sort_order, e.name
    )
    FROM public.camp_extras e
    WHERE e.camp_id = c.id AND e.is_active
  ), '[]'::jsonb) AS extras
FROM public.camps c
WHERE c.is_published;

GRANT SELECT ON public.camp_public_list TO anon, authenticated;

-- 7. Waitlist join guard (direct PostgREST inserts) -------------------------

CREATE OR REPLACE FUNCTION public.guard_camp_waitlist_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_camp public.camps%ROWTYPE;
  v_active integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_camp FROM public.camps WHERE id = NEW.camp_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'camp_waitlist_unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_camp.is_published OR NOT v_camp.waitlist_enabled THEN
    RAISE EXCEPTION 'camp_waitlist_unavailable' USING ERRCODE = 'P0001';
  END IF;

  v_active := public.camp_active_registration_count(NEW.camp_id);
  IF v_active < v_camp.max_capacity THEN
    RAISE EXCEPTION 'camp_waitlist_unavailable' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_camp_waitlist_join ON public.camp_waitlist_entries;
CREATE TRIGGER guard_camp_waitlist_join
  BEFORE INSERT ON public.camp_waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_camp_waitlist_join();

-- 8. Transactional capacity + cancel (service-role only) --------------------

CREATE OR REPLACE FUNCTION public.register_camp_child(
  p_camp_id uuid,
  p_child_id uuid,
  p_parent_id uuid,
  p_extra_ids uuid[],
  p_terms_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_camp public.camps%ROWTYPE;
  v_child public.children%ROWTYPE;
  v_parent public.profiles%ROWTYPE;
  v_active integer;
  v_age integer;
  v_extra_ids uuid[] := COALESCE(p_extra_ids, ARRAY[]::uuid[]);
  v_matched integer;
  v_extras_total numeric(10, 2) := 0;
  v_reg_id uuid;
  v_parent_name text;
BEGIN
  SELECT * INTO v_camp FROM public.camps WHERE id = p_camp_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'camp_not_published' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_camp.is_published THEN
    RAISE EXCEPTION 'camp_not_published' USING ERRCODE = 'P0001';
  END IF;
  IF v_camp.registration_opens_at IS NOT NULL AND now() < v_camp.registration_opens_at THEN
    RAISE EXCEPTION 'camp_closed' USING ERRCODE = 'P0001';
  END IF;
  IF v_camp.registration_deadline_at IS NOT NULL AND now() > v_camp.registration_deadline_at THEN
    RAISE EXCEPTION 'camp_closed' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_child FROM public.children WHERE id = p_child_id;
  IF NOT FOUND OR v_child.parent_id IS DISTINCT FROM p_parent_id THEN
    RAISE EXCEPTION 'child_not_owned' USING ERRCODE = 'P0001';
  END IF;
  IF v_child.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'child_archived' USING ERRCODE = 'P0001';
  END IF;
  IF btrim(COALESCE(v_child.emergency_contact_name, '')) = ''
     OR btrim(COALESCE(v_child.emergency_contact_phone, '')) = '' THEN
    RAISE EXCEPTION 'emergency_contact_required' USING ERRCODE = 'P0001';
  END IF;

  IF v_camp.min_age IS NOT NULL OR v_camp.max_age IS NOT NULL THEN
    IF v_child.date_of_birth IS NULL THEN
      RAISE EXCEPTION 'age_out_of_range' USING ERRCODE = 'P0001';
    END IF;
    v_age := EXTRACT(YEAR FROM age(v_camp.start_date, v_child.date_of_birth))::integer;
    IF v_camp.min_age IS NOT NULL AND v_age < v_camp.min_age THEN
      RAISE EXCEPTION 'age_out_of_range' USING ERRCODE = 'P0001';
    END IF;
    IF v_camp.max_age IS NOT NULL AND v_age > v_camp.max_age THEN
      RAISE EXCEPTION 'age_out_of_range' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT * INTO v_parent FROM public.profiles WHERE id = p_parent_id;
  IF NOT FOUND OR v_parent.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'profile_inactive' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(btrim(v_parent.email), '') = '' THEN
    RAISE EXCEPTION 'profile_incomplete' USING ERRCODE = 'P0001';
  END IF;
  v_parent_name := COALESCE(
    NULLIF(btrim(v_parent.full_name), ''),
    NULLIF(btrim(concat_ws(' ', v_parent.first_name, v_parent.last_name)), ''),
    v_parent.email
  );

  v_active := public.camp_active_registration_count(p_camp_id);
  IF v_active >= v_camp.max_capacity THEN
    RAISE EXCEPTION 'camp_full' USING ERRCODE = 'P0001';
  END IF;

  v_extra_ids := ARRAY(
    SELECT DISTINCT x FROM unnest(v_extra_ids) AS x WHERE x IS NOT NULL
  );
  IF array_length(v_extra_ids, 1) IS NOT NULL THEN
    SELECT count(*)::integer, COALESCE(sum(price_amount), 0)
      INTO v_matched, v_extras_total
    FROM public.camp_extras
    WHERE camp_id = p_camp_id
      AND is_active
      AND id = ANY (v_extra_ids);
    IF v_matched IS DISTINCT FROM array_length(v_extra_ids, 1) THEN
      RAISE EXCEPTION 'extras_invalid' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.camp_registrations (
    camp_id, child_id, parent_id,
    child_first_name, child_last_name, child_date_of_birth,
    padel_level, allergies, emergency_contact_name, emergency_contact_phone,
    parent_full_name, parent_email, parent_phone,
    camp_name, camp_start_date, camp_end_date, camp_schedule_text,
    base_price, extras_total, total_amount, currency,
    terms_version, terms_accepted_at
  ) VALUES (
    p_camp_id, p_child_id, p_parent_id,
    v_child.first_name, v_child.last_name, v_child.date_of_birth,
    v_child.padel_level, v_child.allergies,
    btrim(v_child.emergency_contact_name), btrim(v_child.emergency_contact_phone),
    v_parent_name, v_parent.email, v_parent.phone,
    v_camp.name, v_camp.start_date, v_camp.end_date, v_camp.schedule_text,
    v_camp.price_amount, v_extras_total, v_camp.price_amount + v_extras_total, v_camp.currency,
    p_terms_version, now()
  )
  RETURNING id INTO v_reg_id;

  IF array_length(v_extra_ids, 1) IS NOT NULL THEN
    INSERT INTO public.camp_registration_extras (
      camp_registration_id, camp_extra_id, name, price_amount
    )
    SELECT v_reg_id, e.id, e.name, e.price_amount
    FROM public.camp_extras e
    WHERE e.id = ANY (v_extra_ids);
  END IF;

  RETURN v_reg_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'duplicate_registration' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_camp_registration(p_registration_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reg public.camp_registrations%ROWTYPE;
BEGIN
  SELECT * INTO v_reg FROM public.camp_registrations WHERE id = p_registration_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_reg.status = 'cancelled' THEN
    RETURN v_reg.id;
  END IF;
  IF v_reg.status = 'confirmed' OR v_reg.payment_status = 'confirmed' THEN
    RAISE EXCEPTION 'refund_agreement_required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.camp_registrations
     SET status = 'cancelled',
         payment_status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   WHERE id = p_registration_id;

  RETURN p_registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_camp_child(uuid, uuid, uuid, uuid[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_camp_registration(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_camp_child(uuid, uuid, uuid, uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_camp_registration(uuid) TO service_role;

-- 9. RLS --------------------------------------------------------------------

ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_registration_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS camps_select_published_or_admin ON public.camps;
CREATE POLICY camps_select_published_or_admin
  ON public.camps FOR SELECT
  TO anon, authenticated
  USING (is_published OR public.is_admin());

DROP POLICY IF EXISTS camps_admin_write ON public.camps;
CREATE POLICY camps_admin_write
  ON public.camps FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS camp_extras_select_published_or_admin ON public.camp_extras;
CREATE POLICY camp_extras_select_published_or_admin
  ON public.camp_extras FOR SELECT
  TO anon, authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.camps
      WHERE camps.id = camp_extras.camp_id AND camps.is_published
    )
  );

DROP POLICY IF EXISTS camp_extras_admin_write ON public.camp_extras;
CREATE POLICY camp_extras_admin_write
  ON public.camp_extras FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS children_select_owner_or_admin ON public.children;
CREATE POLICY children_select_owner_or_admin
  ON public.children FOR SELECT
  TO authenticated
  USING (parent_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS children_insert_active_owner_or_admin ON public.children;
CREATE POLICY children_insert_active_owner_or_admin
  ON public.children FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      parent_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.is_active
      )
    )
  );

DROP POLICY IF EXISTS children_update_active_owner_or_admin ON public.children;
CREATE POLICY children_update_active_owner_or_admin
  ON public.children FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      parent_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.is_active
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR parent_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS camp_registrations_select_owner_or_admin ON public.camp_registrations;
CREATE POLICY camp_registrations_select_owner_or_admin
  ON public.camp_registrations FOR SELECT
  TO authenticated
  USING (parent_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS camp_registration_extras_select_owner_or_admin ON public.camp_registration_extras;
CREATE POLICY camp_registration_extras_select_owner_or_admin
  ON public.camp_registration_extras FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.camp_registrations r
      WHERE r.id = camp_registration_extras.camp_registration_id
        AND r.parent_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS camp_waitlist_select_owner_or_admin ON public.camp_waitlist_entries;
CREATE POLICY camp_waitlist_select_owner_or_admin
  ON public.camp_waitlist_entries FOR SELECT
  TO authenticated
  USING (parent_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS camp_waitlist_insert_active_owner ON public.camp_waitlist_entries;
CREATE POLICY camp_waitlist_insert_active_owner
  ON public.camp_waitlist_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_active
    )
    AND EXISTS (
      SELECT 1 FROM public.children c
      WHERE c.id = child_id AND c.parent_id = (SELECT auth.uid()) AND c.archived_at IS NULL
    )
  );

DROP POLICY IF EXISTS camp_waitlist_update_owner_or_admin ON public.camp_waitlist_entries;
CREATE POLICY camp_waitlist_update_owner_or_admin
  ON public.camp_waitlist_entries FOR UPDATE
  TO authenticated
  USING (parent_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (parent_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS camp_funnel_insert ON public.camp_funnel_events;
CREATE POLICY camp_funnel_insert
  ON public.camp_funnel_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (camp_id IS NULL AND event = 'camps_page_view')
    OR (
      camp_id IS NOT NULL
      AND event IN (
        'camps_page_view',
        'camp_registration_started',
        'camp_registration_completed'
      )
      AND EXISTS (SELECT 1 FROM public.camps WHERE id = camp_funnel_events.camp_id)
    )
  );

DROP POLICY IF EXISTS camp_funnel_select_admin ON public.camp_funnel_events;
CREATE POLICY camp_funnel_select_admin
  ON public.camp_funnel_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 10. Grants ----------------------------------------------------------------

GRANT SELECT ON public.camps TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camps TO authenticated;

GRANT SELECT ON public.camp_extras TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camp_extras TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.children TO authenticated;
REVOKE DELETE ON public.children FROM authenticated, anon, PUBLIC;

GRANT SELECT ON public.camp_registrations TO authenticated;
GRANT SELECT ON public.camp_registration_extras TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.camp_waitlist_entries TO authenticated;

GRANT INSERT ON public.camp_funnel_events TO anon, authenticated;
GRANT SELECT ON public.camp_funnel_events TO authenticated;

DO $$
DECLARE seq text;
BEGIN
  seq := pg_get_serial_sequence('public.camp_funnel_events', 'id');
  IF seq IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon, authenticated', seq);
  END IF;
END $$;
