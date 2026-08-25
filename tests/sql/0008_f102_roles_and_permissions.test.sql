-- SQL / RLS verification checklist for 0008_f102_roles_and_permissions
-- Feature 008 F1.02 — encode plan.md checklist as statements.
--
-- Run on a TEST project with JWTs for: student A, student B, coach C (assigned
-- only to A's booking), admin, accounting D. Do not run against production.
--
-- Replace :a_id :b_id :c_id :admin_id :d_id :booking_a :booking_b and set
-- request.jwt via SET LOCAL request.jwt.claim.sub / role as your runner allows.
-- Comments below are the constitution-required checklist; keep them in sync
-- with specs/features/008-roles-and-permissions/plan.md.

-- GRANT helpers
-- [ ] is_admin() / is_coach() EXECUTE granted so policies/triggers evaluate
SELECT
  has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') AS is_admin_exec,
  has_function_privilege('authenticated', 'public.is_coach()', 'EXECUTE') AS is_coach_exec;

-- [ ] Anon SELECT profiles returns no PII
-- As role anon:
--   SELECT id, email, role FROM public.profiles;
-- Expect: 0 rows (public SELECT policy dropped).

-- [ ] Student A cannot SELECT B's profile, booking, or proof object
-- SET request.jwt.claim.sub = ':a_id'; SET ROLE authenticated;
--   SELECT * FROM public.profiles WHERE id = ':b_id';           -- 0 rows
--   SELECT * FROM public.bookings WHERE id = ':booking_b';      -- 0 rows
--   SELECT * FROM storage.objects WHERE bucket_id = 'payment-proofs'
--     AND name LIKE ':booking_b/%';                             -- 0 rows

-- [ ] Student A cannot UPDATE/PATCH B's profile, booking, or payment_proofs (FR-004)
--   UPDATE public.profiles SET full_name = 'x' WHERE id = ':b_id';          -- 0 rows
--   UPDATE public.bookings SET notes = 'x' WHERE id = ':booking_b';         -- 0 rows
--   UPDATE public.payment_proofs SET admin_notes = 'x'
--     WHERE booking_id = ':booking_b';                                      -- 0 rows

-- [ ] Student A PATCH role fails; role unchanged
--   UPDATE public.profiles SET role = 'admin' WHERE id = ':a_id';
-- Expect: exception 'role cannot be changed via the application'
--   SELECT role FROM public.profiles WHERE id = ':a_id';  -- still student

-- [ ] Student A UPDATE own booking verification_status still succeeds; UPDATE coach_id fails
--   UPDATE public.bookings SET verification_status = 'pending' WHERE id = ':booking_a'; -- ok
--   UPDATE public.bookings SET coach_id = ':c_id' WHERE id = ':booking_a';
-- Expect: exception 'only an administrator can change coach assignment'

-- [ ] Coach SELECT session_roster = assigned only; SELECT others' bookings empty
-- SET request.jwt.claim.sub = ':c_id';
--   SELECT booking_id FROM public.session_roster;
-- Expect: only :booking_a (after admin assigned C)
--   SELECT * FROM public.bookings WHERE id = ':booking_b';  -- 0 rows

-- [ ] Coach cannot SELECT/sign payment-proof objects they do not own
--   SELECT * FROM storage.objects WHERE bucket_id = 'payment-proofs'
--     AND name LIKE ':booking_a/%';  -- 0 unless C owns that booking

-- [ ] Admin UPDATE coach_id to a coach profile succeeds; to a student profile fails
-- SET request.jwt.claim.sub = ':admin_id';
--   UPDATE public.bookings SET coach_id = ':c_id' WHERE id = ':booking_a'; -- ok
--   UPDATE public.bookings SET coach_id = ':a_id' WHERE id = ':booking_a';
-- Expect: exception 'coach_id must reference a profile with role coach'

-- [ ] Admin payment-verification UPDATE still succeeds
--   UPDATE public.bookings SET payment_status = 'confirmed' WHERE id = ':booking_a'; -- ok
--   UPDATE public.payment_proofs SET verification_status = 'approved'
--     WHERE booking_id = ':booking_a'; -- ok if a proof row exists

-- [ ] Anon SELECT booking_slots still works
-- SET ROLE anon;
--   SELECT * FROM public.booking_slots LIMIT 1;  -- allowed (non-PII)

-- [ ] accounting JWT: empty session_roster, not is_admin(), role PATCH denied (FR-002)
-- SET request.jwt.claim.sub = ':d_id'; SET ROLE authenticated;
--   SELECT public.is_admin();  -- false
--   SELECT * FROM public.session_roster;  -- 0 rows
--   UPDATE public.profiles SET role = 'admin' WHERE id = ':d_id';
-- Expect: exception 'role cannot be changed via the application'

SELECT '0008_f102 checklist loaded — execute the commented statements with test JWTs' AS status;
