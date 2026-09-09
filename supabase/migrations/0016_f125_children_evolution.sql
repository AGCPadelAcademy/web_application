-- ============================================================================
-- Migration: 0016_f125_children_evolution
-- Feature  : F1.25 Padel Camps — children evolution (2026-09-09 decisions)
-- Spec     : specs/features/010-padel-camps/ (spec.md FR-006d/e/f, data-model.md)
--
-- 1. children.avatar_path — optional profile image pointer.
-- 2. Private `child-avatars` Storage bucket, owner-path-or-admin policies
--    modeled on payment-proofs (migration 0008). Path: {parent_id}/{child_id}/…
-- 3. children DELETE policy (owner-or-admin). Removal with history stays
--    blocked by camp_registrations.child_id ON DELETE RESTRICT (decision 2).
-- ============================================================================

-- 1. Avatar pointer ----------------------------------------------------------

ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS avatar_path text;

-- 2. child-avatars bucket + policies ------------------------------------------

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'child-avatars',
  'child-avatars',
  false,
  ARRAY['image/png', 'image/jpeg', 'image/webp'],
  5242880
)
ON CONFLICT (id) DO NOTHING;

-- First path segment must be the parent's auth uid (or the caller is admin).
DROP POLICY IF EXISTS "child-avatars owner or admin select" ON storage.objects;
CREATE POLICY "child-avatars owner or admin select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'child-avatars'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
  );

DROP POLICY IF EXISTS "child-avatars owner or admin insert" ON storage.objects;
CREATE POLICY "child-avatars owner or admin insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'child-avatars'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
  );

DROP POLICY IF EXISTS "child-avatars owner or admin update" ON storage.objects;
CREATE POLICY "child-avatars owner or admin update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'child-avatars'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
  )
  WITH CHECK (
    bucket_id = 'child-avatars'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
  );

DROP POLICY IF EXISTS "child-avatars owner or admin delete" ON storage.objects;
CREATE POLICY "child-avatars owner or admin delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'child-avatars'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
    )
  );

-- 3. Guarded child removal ----------------------------------------------------
-- Hard delete remains impossible when registrations exist: the
-- camp_registrations.child_id FK is ON DELETE RESTRICT (23503), which the UI
-- maps to an explanation (FR-006d/FR-006f, decision 2026-09-09 #2).

DROP POLICY IF EXISTS children_delete_owner_or_admin ON public.children;
CREATE POLICY children_delete_owner_or_admin
  ON public.children FOR DELETE
  TO authenticated
  USING (parent_id = (SELECT auth.uid()) OR public.is_admin());

GRANT DELETE ON public.children TO authenticated;
