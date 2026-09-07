-- Auth-owned identity synchronization is allowed for the signed-in owner even
-- when the client lifecycle is inactive. Every other inactive mutation remains
-- blocked by the trigger.

CREATE OR REPLACE FUNCTION public.guard_profile_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text := COALESCE(auth.role(), '');
  caller_is_admin boolean := false;
  signed_email text := auth.jwt() ->> 'email';
  identity_sync boolean := false;
  active_admin_count integer;
BEGIN
  IF NEW.date_of_birth IS NOT NULL AND NEW.date_of_birth > CURRENT_DATE THEN
    RAISE EXCEPTION 'date of birth cannot be in the future'
      USING ERRCODE = '22007';
  END IF;
  IF caller_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  caller_is_admin := public.is_admin();
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profile id cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  identity_sync := NEW.email IS DISTINCT FROM OLD.email
    AND caller_id = OLD.id
    AND signed_email IS NOT NULL
    AND NEW.email = signed_email
    AND NEW.first_name IS NOT DISTINCT FROM OLD.first_name
    AND NEW.last_name IS NOT DISTINCT FROM OLD.last_name
    AND NEW.full_name IS NOT DISTINCT FROM OLD.full_name
    AND NEW.phone IS NOT DISTINCT FROM OLD.phone
    AND NEW.address IS NOT DISTINCT FROM OLD.address
    AND NEW.postal_code IS NOT DISTINCT FROM OLD.postal_code
    AND NEW.city IS NOT DISTINCT FROM OLD.city
    AND NEW.country IS NOT DISTINCT FROM OLD.country
    AND NEW.country_code IS NOT DISTINCT FROM OLD.country_code
    AND NEW.date_of_birth IS NOT DISTINCT FROM OLD.date_of_birth
    AND NEW.role IS NOT DISTINCT FROM OLD.role
    AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active;

  IF NEW.email IS DISTINCT FROM OLD.email AND NOT identity_sync THEN
    RAISE EXCEPTION 'profile email is managed by authentication'
      USING ERRCODE = '42501';
  END IF;
  IF identity_sync THEN
    RETURN NEW;
  END IF;

  IF caller_is_admin THEN
    IF caller_id = OLD.id AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'an administrator cannot change their own role'
        USING ERRCODE = '42501';
    END IF;
    IF caller_id = OLD.id AND OLD.is_active AND NOT NEW.is_active THEN
      RAISE EXCEPTION 'an administrator cannot deactivate their own profile'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role AND NEW.role = 'accounting' THEN
      RAISE EXCEPTION 'accounting is managed in Bexio'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF caller_id IS NULL OR caller_id <> OLD.id THEN
      RAISE EXCEPTION 'profile update is not permitted'
        USING ERRCODE = '42501';
    END IF;
    IF NOT OLD.is_active THEN
      RAISE EXCEPTION 'client profile is inactive'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'protected profile field cannot be changed'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF OLD.role = 'admin'
     AND OLD.is_active
     AND (NEW.role <> 'admin' OR NOT NEW.is_active) THEN
    PERFORM pg_advisory_xact_lock(hashtext('f104-active-admin-invariant'));
    SELECT count(*) INTO active_admin_count
    FROM public.profiles
    WHERE role = 'admin' AND is_active;
    IF active_admin_count <= 1 THEN
      RAISE EXCEPTION 'at least one active administrator is required'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Active users or admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users or active admins can update profiles" ON public.profiles;
CREATE POLICY "Users or active admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR public.is_admin()
  );

NOTIFY pgrst, 'reload schema';
