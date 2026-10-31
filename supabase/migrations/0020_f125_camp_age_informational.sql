-- ============================================================================
-- Migration: 0020_f125_camp_age_informational
-- Feature  : F1.25 Padel Camps — convergence 7 (age range is informational)
-- Spec     : specs/features/010-padel-camps/ (FR-009 amended 2026-09-24)
--
-- CREATE OR REPLACE register_camp_child from the 0017 six-argument body
-- WITHOUT the min_age / max_age / missing-DOB age_out_of_range block.
-- Member price, capacity, window, extras, and the child snapshot (including
-- date of birth when present) stay. Do not drop children.date_of_birth,
-- camp_registrations.child_date_of_birth, or camps.min_age / max_age.
-- Apply only when the user asks.
-- ============================================================================

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
