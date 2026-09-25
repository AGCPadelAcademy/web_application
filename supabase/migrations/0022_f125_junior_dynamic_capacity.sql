-- ============================================================================
-- Migration: 0022_f125_junior_dynamic_capacity
-- Feature  : F1.25 Padel Camps — convergence 8 (Junior dynamic capacity)
--
-- Live project already applied 0021_f125_camp_registration_billing_on_delete,
-- so this file is 0022. Do not UPDATE camps.max_capacity.
-- Junior (camp_type) keeps the configured ceiling until one place remains
-- (active >= max_capacity - 1), then the ceiling is max_capacity + 6.
-- Public places_remaining stays 1 through that window and hits 0 at the ceiling.
-- Mini, Competition, and any other type stay on max_capacity.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.camp_registration_ceiling(
  p_camp_type text,
  p_max_capacity integer,
  p_active integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN lower(btrim(COALESCE(p_camp_type, ''))) = 'junior'
      AND p_active >= GREATEST(p_max_capacity - 1, 0)
    THEN p_max_capacity + 6
    ELSE p_max_capacity
  END;
$$;

CREATE OR REPLACE FUNCTION public.camp_places_remaining(
  p_camp_type text,
  p_max_capacity integer,
  p_active integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_active >= public.camp_registration_ceiling(p_camp_type, p_max_capacity, p_active) THEN 0
    WHEN lower(btrim(COALESCE(p_camp_type, ''))) = 'junior'
      AND p_active >= GREATEST(p_max_capacity - 1, 0)
    THEN 1
    ELSE GREATEST(p_max_capacity - p_active, 0)
  END;
$$;

REVOKE ALL ON FUNCTION public.camp_registration_ceiling(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.camp_registration_ceiling(text, integer, integer) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.camp_places_remaining(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.camp_places_remaining(text, integer, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.register_camp_child(
  p_camp_id uuid,
  p_child_id uuid,
  p_parent_id uuid,
  p_extra_ids uuid[],
  p_terms_version text,
  p_member_price_claimed boolean DEFAULT false
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
  v_extra_ids uuid[] := COALESCE(p_extra_ids, ARRAY[]::uuid[]);
  v_matched integer;
  v_extras_total numeric(10, 2) := 0;
  v_base_price numeric(10, 2);
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
  IF p_member_price_claimed IS TRUE AND v_camp.member_price_amount IS NULL THEN
    RAISE EXCEPTION 'member_price_unavailable' USING ERRCODE = 'P0001';
  END IF;
  v_base_price := CASE
    WHEN p_member_price_claimed IS TRUE AND v_camp.member_price_amount IS NOT NULL
    THEN v_camp.member_price_amount
    ELSE v_camp.price_amount
  END;

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
  IF v_active >= public.camp_registration_ceiling(v_camp.camp_type, v_camp.max_capacity, v_active) THEN
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
    terms_version, terms_accepted_at, member_price_claimed
  ) VALUES (
    p_camp_id, p_child_id, p_parent_id,
    v_child.first_name, v_child.last_name, v_child.date_of_birth,
    v_child.padel_level, v_child.allergies,
    btrim(v_child.emergency_contact_name), btrim(v_child.emergency_contact_phone),
    v_parent_name, v_parent.email, v_parent.phone,
    v_camp.name, v_camp.start_date, v_camp.end_date, v_camp.schedule_text,
    v_base_price, v_extras_total, v_base_price + v_extras_total, v_camp.currency,
    p_terms_version, now(), p_member_price_claimed IS TRUE
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

REVOKE ALL ON FUNCTION public.register_camp_child(uuid, uuid, uuid, uuid[], text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_camp_child(uuid, uuid, uuid, uuid[], text, boolean) TO service_role;


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
  IF v_active < public.camp_registration_ceiling(v_camp.camp_type, v_camp.max_capacity, v_active) THEN
    RAISE EXCEPTION 'camp_waitlist_unavailable' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

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
  public.camp_places_remaining(c.camp_type, c.max_capacity, a.n) AS places_remaining,
  (a.n >= public.camp_registration_ceiling(c.camp_type, c.max_capacity, a.n)) AS is_full,
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
  ), '[]'::jsonb) AS extras,
  c.flyer_path,
  c.member_price_amount,
  c.camp_type
FROM public.camps c
CROSS JOIN LATERAL (
  SELECT public.camp_active_registration_count(c.id) AS n
) a
WHERE c.is_published;

GRANT SELECT ON public.camp_public_list TO anon, authenticated;
