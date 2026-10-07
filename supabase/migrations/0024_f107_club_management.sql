-- ============================================================================
-- Migration: 0024_f107_club_management
-- Feature  : F1.07 club catalogue. One location record, admin-only writes,
--            non-destructive activation, and a shared active-club check.
-- ============================================================================

CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clubs_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT clubs_location_length CHECK (location IS NULL OR char_length(location) <= 500),
  CONSTRAINT clubs_phone_length CHECK (phone IS NULL OR char_length(phone) <= 40),
  CONSTRAINT clubs_email_length CHECK (email IS NULL OR char_length(email) <= 254)
);

COMMENT ON TABLE public.clubs IS
  'Academy location catalogue. Identity is the uuid. Deactivation is not deletion.';

CREATE UNIQUE INDEX clubs_name_lower_unique ON public.clubs (lower(name));

CREATE OR REPLACE FUNCTION public.guard_club_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'club id cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  NEW.name := btrim(COALESCE(NEW.name, ''));
  IF NEW.name = '' THEN
    RAISE EXCEPTION 'club name is required'
      USING ERRCODE = '23514';
  END IF;
  IF char_length(NEW.name) > 120 THEN
    RAISE EXCEPTION 'club name is too long'
      USING ERRCODE = '23514';
  END IF;

  NEW.location := NULLIF(btrim(COALESCE(NEW.location, '')), '');
  NEW.phone := NULLIF(btrim(COALESCE(NEW.phone, '')), '');
  NEW.email := NULLIF(btrim(COALESCE(NEW.email, '')), '');

  IF NEW.location IS NOT NULL AND char_length(NEW.location) > 500 THEN
    RAISE EXCEPTION 'club location is too long'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.phone IS NOT NULL AND char_length(NEW.phone) > 40 THEN
    RAISE EXCEPTION 'club phone is too long'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.email IS NOT NULL AND char_length(NEW.email) > 254 THEN
    RAISE EXCEPTION 'club email is too long'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_active := true;
    NEW.created_at := now();
    NEW.updated_at := now();
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_club_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'clubs cannot be deleted'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_club_write()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_club_delete()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER clubs_guard_write
  BEFORE INSERT OR UPDATE ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_club_write();

CREATE TRIGGER clubs_prevent_delete
  BEFORE DELETE ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_club_delete();

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY clubs_admin_select
  ON public.clubs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY clubs_admin_insert
  ON public.clubs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY clubs_admin_update
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.clubs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.clubs TO authenticated;

CREATE VIEW public.clubs_for_new_use
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, name, location
FROM public.clubs
WHERE is_active;

COMMENT ON VIEW public.clubs_for_new_use IS
  'Active clubs an admin may choose for a new use. RLS on clubs still applies.';

REVOKE ALL ON public.clubs_for_new_use FROM PUBLIC, anon;
GRANT SELECT ON public.clubs_for_new_use TO authenticated;

CREATE OR REPLACE FUNCTION private.club_is_selectable_for_new_use(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clubs
    WHERE id = p_club_id
      AND is_active
  );
$$;

REVOKE ALL ON FUNCTION private.club_is_selectable_for_new_use(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.club_is_selectable_for_new_use(uuid)
  TO authenticated;

COMMENT ON FUNCTION private.club_is_selectable_for_new_use(uuid) IS
  'True only when the club exists and is active. Returns no catalogue fields.';
