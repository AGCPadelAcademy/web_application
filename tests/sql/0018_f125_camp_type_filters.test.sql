-- SQL / RLS verification checklist for 0018_f125_camp_type_filters (F1.25 C3).
--
-- Apply 0018 on the project, then run the static assertions below.

-- camps gains nullable camp_type with no Mini/Junior/Competition enum/CHECK.
SELECT count(*) = 1 AS camp_type_column
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'camps'
  AND column_name = 'camp_type'
  AND data_type = 'text'
  AND is_nullable = 'YES';

SELECT count(*) = 0 AS no_camp_type_enum_check
FROM pg_constraint
WHERE conrelid = 'public.camps'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%camp_type%'
  AND (
    pg_get_constraintdef(oid) ILIKE '%mini%'
    OR pg_get_constraintdef(oid) ILIKE '%junior%'
    OR pg_get_constraintdef(oid) ILIKE '%competition%'
  );

-- Public projection exposes camp_type.
SELECT count(*) = 1 AS public_list_camp_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'camp_public_list'
  AND column_name = 'camp_type';

-- C2 columns remain on the view.
SELECT count(*) = 2 AS public_list_c2_columns_remain
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'camp_public_list'
  AND column_name IN ('flyer_path', 'member_price_amount');
