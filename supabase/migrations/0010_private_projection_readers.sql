-- ============================================================================
-- Migration: 0010_private_projection_readers
-- Purpose  : Replace public SECURITY DEFINER views with SECURITY INVOKER views
--            backed by fixed-output SECURITY DEFINER functions in an
--            unexposed schema.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.booking_slots_rows()
RETURNS TABLE (
  booking_date date,
  start_time time without time zone,
  end_time time without time zone,
  payment_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    b.booking_date,
    b.start_time,
    b.end_time,
    b.payment_status
  FROM public.bookings b;
$$;

REVOKE ALL ON FUNCTION private.booking_slots_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.booking_slots_rows()
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.billing_public_config_row()
RETURNS TABLE (integration_enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.billing_integrations bi
    WHERE bi.provider = 'bexio'
      AND bi.status IN ('connected', 'degraded')
  ) AS integration_enabled;
$$;

REVOKE ALL ON FUNCTION private.billing_public_config_row() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.billing_public_config_row()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.session_roster_rows()
RETURNS TABLE (
  booking_id uuid,
  booking_date date,
  start_time time without time zone,
  end_time time without time zone,
  lesson_name text,
  participant_full_name text,
  coach_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    b.id AS booking_id,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.lesson_name,
    COALESCE(NULLIF(p.full_name, ''), 'Student') AS participant_full_name,
    b.coach_id
  FROM public.bookings b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE public.is_admin()
     OR (
       public.is_coach()
       AND b.coach_id = (SELECT auth.uid())
     );
$$;

REVOKE ALL ON FUNCTION private.session_roster_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.session_roster_rows()
  TO authenticated, service_role;

CREATE OR REPLACE VIEW public.booking_slots
WITH (security_barrier = true, security_invoker = true)
AS
SELECT * FROM private.booking_slots_rows();

CREATE OR REPLACE VIEW public.billing_public_config
WITH (security_barrier = true, security_invoker = true)
AS
SELECT * FROM private.billing_public_config_row();

CREATE OR REPLACE VIEW public.session_roster
WITH (security_barrier = true, security_invoker = true)
AS
SELECT * FROM private.session_roster_rows();

REVOKE ALL ON public.booking_slots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.booking_slots TO anon, authenticated;

REVOKE ALL ON public.billing_public_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.billing_public_config TO authenticated;

REVOKE ALL ON public.session_roster FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.session_roster TO authenticated;

-- Explicit deny policies make the intentional service-role-only contract
-- visible to Security Advisor without granting any API access.
DROP POLICY IF EXISTS "API roles denied" ON public.bookings_duplicate;
CREATE POLICY "API roles denied"
  ON public.bookings_duplicate
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "API roles denied" ON public.invoice_counters;
CREATE POLICY "API roles denied"
  ON public.invoice_counters
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "API roles denied" ON public.invoices;
CREATE POLICY "API roles denied"
  ON public.invoices
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

NOTIFY pgrst, 'reload schema';
