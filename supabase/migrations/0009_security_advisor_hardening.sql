-- ============================================================================
-- Migration: 0009_security_advisor_hardening
-- Purpose  : Remove unintended API execute/write grants reported by Supabase
--            Security Advisor while preserving deliberate read-only views.
-- ============================================================================

-- Trigger-only function: fixed search_path, qualified objects, no RPC access.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated, service_role;

-- Event-trigger-only function: never an exposed PostgREST RPC.
REVOKE ALL ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated, service_role;

-- Default privileges had granted API roles write privileges on these views.
-- Keep the deliberate SECURITY DEFINER projections read-only.
REVOKE ALL ON public.booking_slots
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.booking_slots TO anon, authenticated;
ALTER VIEW public.booking_slots SET (security_barrier = true);

REVOKE ALL ON public.billing_public_config
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.billing_public_config TO authenticated;
ALTER VIEW public.billing_public_config SET (security_barrier = true);

REVOKE ALL ON public.session_roster
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.session_roster TO authenticated;
ALTER VIEW public.session_roster SET (security_barrier = true);

-- These tables are intentionally service-role-only. RLS already denies API
-- rows; revoke table privileges as defense in depth. No permissive policy is
-- added merely to silence the informational advisor finding.
REVOKE ALL ON public.bookings_duplicate, public.invoice_counters, public.invoices
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
