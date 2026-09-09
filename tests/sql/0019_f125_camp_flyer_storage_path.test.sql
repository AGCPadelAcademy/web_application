-- SQL / RLS verification checklist for 0019_f125_camp_flyer_storage_path (F1.25 C4).
--
-- Apply 0019 on the project, then run the static assertions below.

-- Policy exists and keys off storage.objects.name, not camps.name.
SELECT count(*) = 1 AS flyer_select_uses_object_name
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage'
  AND c.relname = 'objects'
  AND p.polname = 'camp-flyers published or admin select'
  AND pg_get_expr(p.polqual, p.polrelid) ILIKE '%foldername(objects.name)%'
  AND pg_get_expr(p.polqual, p.polrelid) NOT ILIKE '%foldername(camps.name)%';
