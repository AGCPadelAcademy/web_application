-- F1.25 C4: camp-flyers SELECT policy used the wrong `name` column.
--
-- 0017 created "camp-flyers published or admin select" with
--   storage.foldername(name)
-- inside `EXISTS (SELECT 1 FROM public.camps …)`. Unqualified `name` binds to
-- camps.name (the display title), not storage.objects.name (the object path).
-- Anon createSignedUrl then 404s ("Object not found") even when the file exists,
-- so public /camps flyers never paint. Qualify objects.name.

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
              WHEN (storage.foldername(objects.name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              THEN (storage.foldername(objects.name))[1]::uuid
              ELSE NULL
            END
          )
      )
    )
  );
