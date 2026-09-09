-- SQL / RLS verification checklist for 0016_f125_children_evolution (F1.25 evolution).
--
-- 2026-09-09 decisions: avatar image on children, guarded Remove (hard delete
-- only without history), private child-avatars bucket.
--
-- Apply 0016 on the project, then run the static assertions below.
-- Actor-matrix transactions stay commented placeholders like in 0014.

-- children.avatar_path exists and is nullable.
SELECT count(*) = 1 AS avatar_path_column
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'children'
  AND column_name = 'avatar_path' AND is_nullable = 'YES';

-- child-avatars bucket exists, is private, and is restricted to images ≤ 5 MB.
SELECT
  NOT public AS bucket_private,
  allowed_mime_types @> ARRAY['image/png', 'image/jpeg', 'image/webp'] AS images_only,
  file_size_limit = 5242880 AS five_mb_limit
FROM storage.buckets
WHERE id = 'child-avatars';

-- Bucket policies: exactly four, all authenticated-only, all owner-path-or-admin.
SELECT count(*) = 4 AS child_avatar_policy_count
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'child-avatars%';

SELECT count(*) = 0 AS child_avatar_anon_policies
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'child-avatars%'
  AND (COALESCE(qual, '') ILIKE '%anon%' OR COALESCE(with_check, '') ILIKE '%anon%');

-- children DELETE policy exists for owner-or-admin.
SELECT count(*) = 1 AS children_delete_policy
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'children' AND cmd = 'DELETE'
  AND policyname = 'children_delete_owner_or_admin';

-- Removal guard remains the FK: camp_registrations.child_id is ON DELETE RESTRICT.
SELECT pg_get_constraintdef(oid) ILIKE '%RESTRICT%' AS registrations_restrict_delete
FROM pg_constraint
WHERE conrelid = 'public.camp_registrations'::regclass
  AND conname = 'camp_registrations_child_id_fkey';

-- Actor matrix (execute with real JWT claims in a live check, always ROLLBACK):
--
-- Parent A:
-- * INSERT children row → allowed while active (unchanged from 0014).
-- * DELETE own child without registrations → succeeds.
-- * DELETE own child with a camp_registrations row → 23503 (UI explains).
-- * DELETE parent B's child → denied by policy (no row matched).
-- * storage: upload to child-avatars/A.uid/... → succeeds; to B.uid/... → refused.
-- * storage: signed-url read of own path → succeeds; of B's path → refused.
-- Anon:
-- * no SELECT/INSERT/UPDATE/DELETE on child-avatars objects (no anon policies).
-- Admin:
-- * SELECT/DELETE any children row; storage access to any path.
