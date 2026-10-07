-- SQL checks for 0024_f107_club_management.
-- Static checks run as the migration owner. The data block rolls back.
-- Actor JWT checks stay commented: they need real users and must not be
-- left running against production by this file.
--
-- Public footer, contact, and terms copy is not stored in the database.
-- Confirm these files still contain the Villmergen address and were not
-- edited by this feature:
--   src/components/layout/Footer.jsx
--   src/pages/ContactPage.jsx
--   src/pages/TermsPage.jsx

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clubs'
      AND column_name = 'is_active'
      AND data_type = 'boolean'
      AND is_nullable = 'NO'
      AND column_default LIKE '%true%'
  ) THEN
    RAISE EXCEPTION 'FAIL: clubs.is_active is not a required boolean defaulting to true';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clubs'
      AND column_name = 'name'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'FAIL: clubs.name is not required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.clubs'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'FAIL: RLS is not enabled on public.clubs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'clubs'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%lower(name)%'
  ) THEN
    RAISE EXCEPTION 'FAIL: unique index on lower(name) is missing';
  END IF;

  IF has_table_privilege('anon', 'public.clubs', 'SELECT')
     OR has_table_privilege('anon', 'public.clubs', 'INSERT')
     OR has_table_privilege('anon', 'public.clubs', 'UPDATE')
     OR has_table_privilege('anon', 'public.clubs', 'DELETE')
     OR has_table_privilege('anon', 'public.clubs_for_new_use', 'SELECT')
     OR has_function_privilege('anon', 'private.club_is_selectable_for_new_use(uuid)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: anon can use the club catalogue or the active-club function';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.clubs', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.clubs', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.clubs', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.clubs', 'DELETE')
  THEN
    RAISE EXCEPTION 'FAIL: authenticated club grants are not select/insert/update only';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clubs'
      AND cmd = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'FAIL: a DELETE policy exists on public.clubs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.clubs'::regclass
      AND tgname = 'clubs_prevent_delete'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'FAIL: BEFORE DELETE trigger is missing';
  END IF;

  IF (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clubs'
      AND cmd IN ('SELECT', 'INSERT', 'UPDATE')
      AND (
        COALESCE(qual, '') ILIKE '%is_admin()%'
        OR COALESCE(with_check, '') ILIKE '%is_admin()%'
      )
  ) <> 3 THEN
    RAISE EXCEPTION 'FAIL: admin policies are not limited to is_admin()';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'clubs_for_new_use'
      AND c.relkind = 'v'
      AND 'security_invoker=true' = ANY (c.reloptions)
  ) THEN
    RAISE EXCEPTION 'FAIL: clubs_for_new_use is not a security-invoker view';
  END IF;

  IF position('is_active' IN pg_get_viewdef('public.clubs_for_new_use'::regclass)) = 0 THEN
    RAISE EXCEPTION 'FAIL: clubs_for_new_use does not filter to active clubs';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'club_is_selectable_for_new_use'
      AND p.prosecdef
      AND 'search_path=' = ANY (p.proconfig)
  ) THEN
    RAISE EXCEPTION 'FAIL: private.club_is_selectable_for_new_use is missing or not locked down';
  END IF;

  IF has_function_privilege('anon', 'private.club_is_selectable_for_new_use(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'private.club_is_selectable_for_new_use(uuid)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: active-club function execute grant is wrong';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('profiles', 'bookings', 'lessons', 'camps')
      AND column_name IN ('club_id', 'home_club_id')
  ) THEN
    RAISE EXCEPTION 'FAIL: a club column was added to profiles, bookings, lessons, or camps';
  END IF;
END;
$$;

BEGIN;

DO $$
DECLARE
  club_id uuid;
  child_count integer;
BEGIN
  INSERT INTO public.clubs (name, location, phone, email)
  VALUES ('  Club Norte  ', '  Hall 1  ', '   ', '  ')
  RETURNING id INTO club_id;

  IF (SELECT name FROM public.clubs WHERE id = club_id) <> 'Club Norte' THEN
    RAISE EXCEPTION 'FAIL: club name was not trimmed';
  END IF;
  IF (SELECT location FROM public.clubs WHERE id = club_id) <> 'Hall 1' THEN
    RAISE EXCEPTION 'FAIL: location was not trimmed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = club_id
      AND (phone IS NOT NULL OR email IS NOT NULL OR NOT is_active)
  ) THEN
    RAISE EXCEPTION 'FAIL: blank contact was stored or a new club was inactive';
  END IF;

  BEGIN
    INSERT INTO public.clubs (name) VALUES ('club norte');
    RAISE EXCEPTION 'FAIL: duplicate name was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM ILIKE 'FAIL:%' THEN
        RAISE;
      END IF;
      RAISE EXCEPTION 'FAIL: unexpected duplicate-name error: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.clubs (name) VALUES ('   ');
    RAISE EXCEPTION 'FAIL: blank name was accepted';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM ILIKE 'FAIL:%' THEN
        RAISE;
      END IF;
      RAISE EXCEPTION 'FAIL: unexpected blank-name error: %', SQLERRM;
  END;

  INSERT INTO public.clubs (name, location, phone, email)
  VALUES ('Optional Empty', NULL, NULL, NULL);
  IF NOT EXISTS (
    SELECT 1 FROM public.clubs
    WHERE name = 'Optional Empty'
      AND location IS NULL
      AND phone IS NULL
      AND email IS NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: optional location, phone, and email could not be null';
  END IF;

  UPDATE public.clubs SET is_active = false WHERE id = club_id;
  IF private.club_is_selectable_for_new_use(club_id) THEN
    RAISE EXCEPTION 'FAIL: inactive club was selectable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clubs_for_new_use WHERE id = club_id) THEN
    RAISE EXCEPTION 'FAIL: inactive club appeared in clubs_for_new_use';
  END IF;
  IF private.club_is_selectable_for_new_use('00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'FAIL: unknown id was selectable';
  END IF;

  UPDATE public.clubs SET is_active = true WHERE id = club_id;
  IF NOT private.club_is_selectable_for_new_use(club_id) THEN
    RAISE EXCEPTION 'FAIL: reactivated club was not selectable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = club_id AND is_active AND name = 'Club Norte'
  ) THEN
    RAISE EXCEPTION 'FAIL: reactivation did not keep the same club';
  END IF;

  BEGIN
    UPDATE public.clubs SET id = gen_random_uuid() WHERE id = club_id;
    RAISE EXCEPTION 'FAIL: id change was accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM ILIKE 'FAIL:%' THEN
        RAISE;
      END IF;
      RAISE EXCEPTION 'FAIL: unexpected id-change error: %', SQLERRM;
  END;

  CREATE TEMP TABLE club_history_probe (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE RESTRICT
  ) ON COMMIT DROP;

  INSERT INTO club_history_probe (club_id) VALUES (club_id);
  UPDATE public.clubs SET is_active = false WHERE id = club_id;
  SELECT count(*) INTO child_count
  FROM club_history_probe
  WHERE club_id = club_id;
  IF child_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: historical link was not kept after deactivation';
  END IF;

  BEGIN
    DELETE FROM public.clubs WHERE id = club_id;
    RAISE EXCEPTION 'FAIL: club delete succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM ILIKE 'FAIL:%' THEN
        RAISE;
      END IF;
      RAISE EXCEPTION 'FAIL: unexpected delete error: %', SQLERRM;
  END;

  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id) THEN
    RAISE EXCEPTION 'FAIL: club row disappeared';
  END IF;
END;
$$;

ROLLBACK;

-- Actor checks. Replace placeholders with real profile ids and run only in a
-- transaction you roll back. is_admin() already requires an active admin, so
-- an inactive admin, student, coach, accounting user, and anonymous caller
-- receive no rows and cannot write.
--
-- BEGIN;
-- SET LOCAL ROLE authenticated;
-- SELECT set_config('request.jwt.claim.sub', ':active_admin', true);
-- INSERT INTO public.clubs (name) VALUES ('Actor Check Club') RETURNING id;
-- UPDATE public.clubs SET location = 'Court 2' WHERE name = 'Actor Check Club';
-- UPDATE public.clubs SET is_active = false WHERE name = 'Actor Check Club';
-- UPDATE public.clubs SET is_active = true WHERE name = 'Actor Check Club';
-- SELECT id FROM public.clubs_for_new_use WHERE name = 'Actor Check Club';
-- ROLLBACK;
--
-- Repeat the insert and the catalogue select as :student, :coach,
-- :accounting, and :inactive_admin. Each must change nothing and return no
-- catalogue rows. Anonymous requests are not authorized.
