-- ============================================================================
-- Migration: 0015_f125_is_admin_anon_grant
-- Feature  : F1.25 Padel Camps / Camps Registration (follow-up to 0014)
--
-- The camps / camp_extras public SELECT policies from 0014 are
-- `TO anon, authenticated` and call public.is_admin(). anon had no EXECUTE
-- grant on is_admin(), so anonymous reads of camps / camp_public_list failed
-- with 42501 "permission denied for function is_admin".
--
-- is_admin() is STABLE, search_path-pinned, and returns false for anon
-- (auth.uid() IS NULL), so granting EXECUTE to anon exposes nothing.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
