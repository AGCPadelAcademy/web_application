-- ============================================================================
-- Migration: 0018_f125_camp_type_filters
-- Feature  : F1.25 Padel Camps — convergence 3 (camp type filters)
-- Spec     : specs/features/010-padel-camps/ (FR-001/FR-002/FR-003)
--
-- 1. camps.camp_type (nullable text — not a Mini/Junior/Competition enum).
-- 2. camp_public_list gains camp_type.
-- 3. One-time data backfill of current Herbstferien name prefixes into type
--    labels (data only; the SPA still derives filters from distinct values).
-- ============================================================================

ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS camp_type text;

UPDATE public.camps
SET camp_type = CASE
  WHEN name ILIKE 'Mini Camp%' THEN 'Mini'
  WHEN name ILIKE 'Junior Camp%' THEN 'Junior'
  WHEN name ILIKE 'Competition Camp%' THEN 'Competition'
  ELSE camp_type
END
WHERE camp_type IS NULL;

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
  c.member_price_amount,
  c.camp_type
FROM public.camps c
WHERE c.is_published;

GRANT SELECT ON public.camp_public_list TO anon, authenticated;
