-- ============================================================================
-- Migration: 0017_f125_camp_flyers_pricing
-- Feature  : F1.25 Padel Camps — convergence 2 (flyers + dual pricing)
-- Spec     : specs/features/010-padel-camps/ (FR-001a/FR-001b/FR-017a)
--
-- 1. camps.flyer_path + camps.member_price_amount.
-- 2. camp_registrations.member_price_claimed (admin-visible claim flag).
-- 3. register_camp_child gains optional p_member_price_claimed (decision 1:
--    self-declared membership until F1.09). Drop + recreate preserves the
--    service-role-only grants.
-- 4. Private camp-flyers bucket: published camps' flyers are publicly
--    readable; unpublished are admin-only; writes are admin-only (C2 §4).
-- 5. camp_public_list gains flyer_path + member_price_amount.
-- ============================================================================

-- 1. Camp columns -------------------------------------------------------------

ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS flyer_path text;

ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS member_price_amount numeric(10, 2);

ALTER TABLE public.camps
  DROP CONSTRAINT IF EXISTS camps_member_price_nonneg;
ALTER TABLE public.camps
  ADD CONSTRAINT camps_member_price_nonneg
  CHECK (member_price_amount IS NULL OR member_price_amount >= 0);

-- 2. Claim flag ---------------------------------------------------------------

ALTER TABLE public.camp_registrations
  ADD COLUMN IF NOT EXISTS member_price_claimed boolean NOT NULL DEFAULT false;

-- 3. register_camp_child with the membership claim ----------------------------

DROP FUNCTION IF EXISTS public.register_camp_child(uuid, uuid, uuid, uuid[], text);

CREATE FUNCTION public.register_camp_child(
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
  v_age integer;
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

-- 4. camp-flyers bucket + policies --------------------------------------------

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'camp-flyers',
  'camp-flyers',
  false,
  ARRAY['image/png', 'image/jpeg', 'image/webp'],
  5242880
)
ON CONFLICT (id) DO NOTHING;

-- Reads: admin, or anyone when the flyer's Camp (first path segment) is published.
DROP POLICY IF EXISTS "camp-flyers published or admin select" ON storage.objects;
CREATE POLICY "camp-flyers published or admin select"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'camp-flyers'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.camps
        WHERE camps.is_published
          AND camps.id = (
            CASE
              WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              THEN (storage.foldername(name))[1]::uuid
              ELSE NULL
            END
          )
      )
    )
  );

DROP POLICY IF EXISTS "camp-flyers admin insert" ON storage.objects;
CREATE POLICY "camp-flyers admin insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'camp-flyers' AND public.is_admin());

DROP POLICY IF EXISTS "camp-flyers admin update" ON storage.objects;
CREATE POLICY "camp-flyers admin update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'camp-flyers' AND public.is_admin())
  WITH CHECK (bucket_id = 'camp-flyers' AND public.is_admin());

DROP POLICY IF EXISTS "camp-flyers admin delete" ON storage.objects;
CREATE POLICY "camp-flyers admin delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'camp-flyers' AND public.is_admin());

-- 5. Public projection gains flyer + member price -----------------------------

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
  ), '[]'::jsonb) AS extras,
  c.flyer_path,
  c.member_price_amount
FROM public.camps c
WHERE c.is_published;

GRANT SELECT ON public.camp_public_list TO anon, authenticated;
