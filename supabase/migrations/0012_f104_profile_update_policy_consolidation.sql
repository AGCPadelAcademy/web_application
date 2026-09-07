-- Consolidate F1.04 profile UPDATE authorization into one policy so Postgres
-- evaluates the owner/admin predicate once per row.

DROP POLICY IF EXISTS "Active users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Active admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Active users or admins can update profiles" ON public.profiles;

CREATE POLICY "Active users or admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    (
      id = (SELECT auth.uid())
      AND is_active
    )
    OR public.is_admin()
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR public.is_admin()
  );

NOTIFY pgrst, 'reload schema';
