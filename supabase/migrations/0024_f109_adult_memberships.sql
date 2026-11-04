-- ============================================================================
-- Migration: 0024_f109_adult_memberships
-- Feature  : F1.09 adult memberships (issue #14)
--
-- This file is not applied until an explicit user request. Confirm the
-- remote migration head is still 0023 before applying.
--
-- Adds the Group anchor, the membership lifecycle, the 20th cutoff in
-- Europe/Zurich, and the 1st-of-month charge intents. It does not call
-- Bexio and does not send email.
-- ============================================================================

-- 1. Groups anchor (owned long-term by F1.08; no Group CRUD UI here) --------

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL CHECK (end_time > start_time),
  capacity integer CHECK (capacity > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY groups_admin_select ON public.groups
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY groups_admin_insert ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY groups_admin_update ON public.groups
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

-- 2. Evolve memberships (legacy columns retained) ---------------------------

ALTER TABLE public.memberships
  ADD COLUMN group_id uuid,
  ADD COLUMN status text NOT NULL DEFAULT 'pending_payment',
  ADD COLUMN monthly_price_amount numeric(10, 2),
  ADD COLUMN cancellation_effective_on date,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_status_check
    CHECK (status IN ('pending_payment', 'active', 'paused', 'cancelled', 'expired')),
  ADD CONSTRAINT memberships_monthly_price_amount_check
    CHECK (monthly_price_amount > 0),
  ADD CONSTRAINT memberships_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES public.groups (id) ON DELETE RESTRICT;

-- The live table has 0 rows. New rows must name a Group and a price.
ALTER TABLE public.memberships
  ALTER COLUMN group_id SET NOT NULL,
  ALTER COLUMN monthly_price_amount SET NOT NULL;

ALTER TABLE public.memberships
  ALTER COLUMN start_date SET DEFAULT now();

COMMENT ON COLUMN public.memberships.plan_id IS
  'Legacy. Superseded by group_id and status. Do not read or write.';
COMMENT ON COLUMN public.memberships.active IS
  'Legacy boolean. Superseded by status. Do not read or write.';
COMMENT ON COLUMN public.memberships.next_charge_date IS
  'Legacy. The 1st job writes membership_charge_intents instead.';

CREATE UNIQUE INDEX memberships_one_live_per_client_group
  ON public.memberships (user_id, group_id)
  WHERE status IN ('pending_payment', 'active', 'paused');

CREATE INDEX IF NOT EXISTS memberships_user_id_idx ON public.memberships (user_id);
CREATE INDEX IF NOT EXISTS memberships_group_id_idx ON public.memberships (group_id);

DROP POLICY IF EXISTS "Users can view own membership" ON public.memberships;

CREATE POLICY memberships_admin_select ON public.memberships
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY memberships_admin_insert ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY memberships_admin_update ON public.memberships
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY groups_member_read ON public.groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships AS m
      WHERE m.group_id = groups.id
        AND m.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY memberships_owner_read ON public.memberships
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY memberships_owner_cancel ON public.memberships
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'cancelled'
  );

-- 3. Audit ------------------------------------------------------------------

CREATE TABLE public.membership_state_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.memberships (id) ON DELETE RESTRICT,
  from_status text CHECK (
    from_status IS NULL
    OR from_status IN ('pending_payment', 'active', 'paused', 'cancelled', 'expired')
  ),
  to_status text NOT NULL CHECK (
    to_status IN ('pending_payment', 'active', 'paused', 'cancelled', 'expired')
  ),
  actor_id uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_state_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY membership_state_events_admin_read ON public.membership_state_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.membership_state_events TO authenticated;
GRANT ALL ON public.membership_state_events TO service_role;

-- 4. Transition guard and audit writer --------------------------------------

CREATE OR REPLACE FUNCTION public.guard_membership_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_is_admin boolean := false;
  charge_job boolean := coalesce(current_setting('agc.membership_charge_job', true), '') = 'on';
  owner_cancel boolean := false;
  zurich_today date;
  allowed boolean := false;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  caller_is_admin := public.is_admin();
  owner_cancel := caller_id IS NOT NULL
    AND caller_id = OLD.user_id
    AND NEW.status = 'cancelled'
    AND OLD.status IN ('pending_payment', 'active', 'paused');

  allowed :=
    (OLD.status = 'pending_payment' AND NEW.status IN ('active', 'cancelled', 'expired'))
    OR (OLD.status = 'active' AND NEW.status IN ('paused', 'cancelled'))
    OR (OLD.status = 'paused' AND NEW.status IN ('active', 'cancelled'))
    OR (OLD.status = 'cancelled' AND NEW.status = 'expired');

  IF NOT allowed THEN
    RAISE EXCEPTION 'membership transition is not allowed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'expired' THEN
    IF NOT caller_is_admin OR charge_job THEN
      RAISE EXCEPTION 'membership expire is not permitted'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'cancelled' AND (
      OLD.cancellation_effective_on IS NULL
      OR OLD.cancellation_effective_on > (timezone('Europe/Zurich', now()))::date
    ) THEN
      RAISE EXCEPTION 'membership cannot expire before the effective date'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.status = 'cancelled' AND charge_job THEN
    IF NEW.cancellation_effective_on IS NULL THEN
      RAISE EXCEPTION 'membership charge job must set the effective date'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.status = 'cancelled' AND (caller_is_admin OR owner_cancel) THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.monthly_price_amount IS DISTINCT FROM OLD.monthly_price_amount THEN
      RAISE EXCEPTION 'membership cancel cannot change other fields'
        USING ERRCODE = '42501';
    END IF;
    zurich_today := (timezone('Europe/Zurich', now()))::date;
    IF extract(day FROM zurich_today) <= 20 THEN
      NEW.cancellation_effective_on :=
        (date_trunc('month', zurich_today::timestamp) + interval '1 month' - interval '1 day')::date;
    ELSE
      NEW.cancellation_effective_on :=
        (date_trunc('month', zurich_today::timestamp) + interval '2 months' - interval '1 day')::date;
    END IF;
  ELSIF NOT caller_is_admin OR charge_job THEN
    RAISE EXCEPTION 'membership transition is not permitted'
      USING ERRCODE = '42501';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_membership_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'membership create is not permitted'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.user_id AND is_active
  ) THEN
    RAISE EXCEPTION 'client is inactive'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = NEW.group_id AND is_active
  ) THEN
    RAISE EXCEPTION 'group is inactive'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending_payment' THEN
    RAISE EXCEPTION 'membership must be created as pending payment'
      USING ERRCODE = '42501';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER: membership_state_events has no write policy, so an
-- invoker insert would be rejected by RLS. The function only inserts the
-- audit row for the triggering membership.
CREATE OR REPLACE FUNCTION public.record_membership_state_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.membership_state_events (
      membership_id, from_status, to_status, actor_id
    ) VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_membership_create ON public.memberships;
CREATE TRIGGER trg_guard_membership_create
  BEFORE INSERT ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_membership_create();

DROP TRIGGER IF EXISTS trg_guard_membership_status_transition ON public.memberships;
CREATE TRIGGER trg_guard_membership_status_transition
  BEFORE UPDATE OF status ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_membership_status_transition();

DROP TRIGGER IF EXISTS trg_record_membership_state_event ON public.memberships;
CREATE TRIGGER trg_record_membership_state_event
  AFTER INSERT OR UPDATE OF status ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.record_membership_state_event();

REVOKE EXECUTE ON FUNCTION public.guard_membership_status_transition() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_membership_create() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_membership_state_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_membership_status_transition() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_membership_create() TO authenticated;

-- 5. Charge intents ---------------------------------------------------------

CREATE TABLE public.membership_charge_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.memberships (id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('month', 'cancel_fee')),
  period_key text NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'CHF' CHECK (currency = 'CHF'),
  source_period_key text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, period_key)
);

ALTER TABLE public.membership_charge_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY membership_charge_intents_admin_read ON public.membership_charge_intents
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY membership_charge_intents_owner_read ON public.membership_charge_intents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships AS m
      WHERE m.id = membership_charge_intents.membership_id
        AND m.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.membership_charge_intents TO authenticated;
GRANT ALL ON public.membership_charge_intents TO service_role;

CREATE OR REPLACE FUNCTION public.create_membership_charges(p_on date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  membership_row record;
  prev_key text;
  month_key text;
  prev_end date;
  prev_amount numeric(10, 2);
  prev_paid timestamptz;
  inserted_count integer := 0;
BEGIN
  IF p_on IS NULL OR extract(day FROM p_on) <> 1 THEN
    RETURN 0;
  END IF;

  month_key := to_char(p_on, 'YYYY-MM');
  prev_key := to_char((p_on - interval '1 month')::date, 'YYYY-MM');
  prev_end := (p_on - 1);

  PERFORM set_config('agc.membership_charge_job', 'on', true);

  FOR membership_row IN
    SELECT id, status, monthly_price_amount, cancellation_effective_on
    FROM public.memberships
  LOOP
    prev_amount := NULL;
    prev_paid := NULL;
    SELECT amount, paid_at
      INTO prev_amount, prev_paid
      FROM public.membership_charge_intents
     WHERE membership_id = membership_row.id
       AND period_key = prev_key
       AND kind = 'month';

    IF prev_amount IS NOT NULL AND prev_paid IS NULL THEN
      INSERT INTO public.membership_charge_intents (
        membership_id, kind, period_key, amount, currency, source_period_key
      ) VALUES (
        membership_row.id,
        'cancel_fee',
        prev_key || ':fee',
        round(prev_amount * 0.10, 2),
        'CHF',
        prev_key
      )
      ON CONFLICT (membership_id, period_key) DO NOTHING;

      IF FOUND THEN
        inserted_count := inserted_count + 1;
      END IF;

      IF membership_row.status = 'active' THEN
        UPDATE public.memberships
           SET status = 'cancelled',
               cancellation_effective_on = prev_end
         WHERE id = membership_row.id
           AND status = 'active';
      END IF;

      CONTINUE;
    END IF;

    IF membership_row.status = 'active'
       OR (
         membership_row.status = 'cancelled'
         AND membership_row.cancellation_effective_on IS NOT NULL
         AND membership_row.cancellation_effective_on >= p_on
       ) THEN
      INSERT INTO public.membership_charge_intents (
        membership_id, kind, period_key, amount, currency
      ) VALUES (
        membership_row.id,
        'month',
        month_key,
        membership_row.monthly_price_amount,
        'CHF'
      )
      ON CONFLICT (membership_id, period_key) DO NOTHING;

      IF FOUND THEN
        inserted_count := inserted_count + 1;
      END IF;
    END IF;
  END LOOP;

  PERFORM set_config('agc.membership_charge_job', 'off', true);
  RETURN inserted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_membership_charges(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_membership_charges(date) TO service_role;

-- Supabase cron.schedule runs in GMT. 23:05 UTC is 00:05 Europe/Zurich in
-- winter and 01:05 in summer, which is still the Zurich 1st when the previous
-- UTC date was the last day of the month. The function ignores every other day.
DO $$
BEGIN
  PERFORM cron.unschedule('membership-charges');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

SELECT cron.schedule(
  'membership-charges',
  '5 23 * * *',
  $cmd$SELECT public.create_membership_charges((timezone('Europe/Zurich', now()))::date);$cmd$
);

-- 6. Fixed-place view -------------------------------------------------------

CREATE VIEW public.membership_fixed_places
WITH (security_invoker = true) AS
SELECT id AS membership_id, user_id, group_id
FROM public.memberships
WHERE status = 'active'
   OR (
     status = 'cancelled'
     AND cancellation_effective_on >= (timezone('Europe/Zurich', now()))::date
   );

GRANT SELECT ON public.membership_fixed_places TO authenticated;
REVOKE ALL ON public.membership_fixed_places FROM anon;
