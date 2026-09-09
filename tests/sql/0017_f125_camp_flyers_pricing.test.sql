-- SQL / RLS verification checklist for 0017_f125_camp_flyers_pricing (F1.25 C2).
--
-- 2026-09-09 round-2 decisions: self-declared membership at registration
-- (admin-visible claim flag), flyer storage gated by camp publication.
--
-- Apply 0017 on the project, then run the static assertions below.

-- camps gains flyer_path and a non-negative nullable member_price_amount.
SELECT count(*) = 2 AS camp_c2_columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'camps'
  AND column_name IN ('flyer_path', 'member_price_amount');

SELECT pg_get_constraintdef(oid) ILIKE '%member_price_amount >=%' AS member_price_check
FROM pg_constraint
WHERE conrelid = 'public.camps'::regclass AND conname = 'camps_member_price_nonneg';

-- Registrations carry the claim flag, defaulting to false.
SELECT count(*) = 1 AS claim_flag
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'camp_registrations'
  AND column_name = 'member_price_claimed'
  AND is_nullable = 'NO' AND column_default = 'false';

-- register_camp_child: 6-parameter signature, service-role only.
SELECT
  has_function_privilege('service_role', 'public.register_camp_child(uuid,uuid,uuid,uuid[],text,boolean)', 'EXECUTE') AS service_register_v2,
  NOT has_function_privilege('authenticated', 'public.register_camp_child(uuid,uuid,uuid,uuid[],text,boolean)', 'EXECUTE') AS auth_register_v2_denied,
  NOT has_function_privilege('anon', 'public.register_camp_child(uuid,uuid,uuid,uuid[],text,boolean)', 'EXECUTE') AS anon_register_v2_denied;

-- Old 5-parameter overload is gone (single canonical signature).
SELECT count(*) = 1 AS single_register_signature
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'register_camp_child';

-- camp-flyers bucket: private, images only, 5 MB.
SELECT
  NOT public AS bucket_private,
  allowed_mime_types @> ARRAY['image/png', 'image/jpeg', 'image/webp'] AS images_only,
  file_size_limit = 5242880 AS five_mb_limit
FROM storage.buckets
WHERE id = 'camp-flyers';

-- Policies: four (select/insert/update/delete); only the select one may
-- reference publication; writes must be admin-only.
SELECT count(*) = 4 AS camp_flyer_policy_count
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'camp-flyers%';

SELECT count(*) = 3 AS admin_only_write_policies
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'camp-flyers admin%'
  AND COALESCE(with_check, qual, '') ILIKE '%is_admin%';

-- Public projection exposes flyer_path and member_price_amount.
SELECT count(*) = 2 AS public_list_c2_columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'camp_public_list'
  AND column_name IN ('flyer_path', 'member_price_amount');

-- Actor matrix (execute with real JWT claims in a live check, always ROLLBACK):
--
-- Anon / visitor:
-- * signed-url read of a published camp's flyer → succeeds
-- * signed-url read of an unpublished camp's flyer → refused
-- * upload/delete in camp-flyers → refused (no policies for non-admin)
-- Admin:
-- * upload/replace/delete flyer under {camp_id}/... → succeeds
-- register_camp_child (service_role RPC):
-- * p_member_price_claimed=true on a camp with member_price_amount → base_price = member price, member_price_claimed = true
-- * p_member_price_claimed=true on a camp without member price → member_price_unavailable
-- * omitted claim → base price and flag false (unchanged pre-C2 behavior)
