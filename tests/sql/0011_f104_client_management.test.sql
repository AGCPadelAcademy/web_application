-- SQL / RLS verification checklist for 0011_f104_client_management.
--
-- The statements below are intentionally read-only by default. Replace actor
-- placeholders and execute each commented transaction with real JWT claims in
-- an isolated environment. On production, run only the static assertions and
-- use existing browser/API journeys for reversible actor checks.

-- Schema/defaults and RLS remain present.
SELECT
  (SELECT data_type = 'date' AND is_nullable = 'YES'
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'date_of_birth') AS dob_contract,
  (SELECT data_type = 'boolean' AND is_nullable = 'NO'
          AND column_default = 'true'
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'is_active') AS active_contract,
  (SELECT relrowsecurity FROM pg_class
    WHERE oid = 'public.profiles'::regclass) AS profiles_rls,
  (SELECT relrowsecurity FROM pg_class
    WHERE oid = 'public.bookings'::regclass) AS bookings_rls;

-- Helpers are available only to authenticated callers and include activity.
SELECT
  has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') AS admin_exec,
  has_function_privilege('authenticated', 'public.is_coach()', 'EXECUTE') AS coach_exec,
  NOT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') AS anon_admin_denied,
  position('is_active' in pg_get_functiondef('public.is_admin()'::regprocedure)) > 0 AS admin_active_aware,
  position('is_active' in pg_get_functiondef('public.is_coach()'::regprocedure)) > 0 AS coach_active_aware;

-- Projection columns and grants.
SELECT array_agg(column_name ORDER BY ordinal_position) = ARRAY[
  'booking_id', 'booking_date', 'start_time', 'end_time', 'lesson_name',
  'participant_id', 'participant_full_name', 'participant_phone', 'coach_id'
]::name[] AS roster_columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'session_roster';

SELECT
  has_table_privilege('authenticated', 'public.session_roster', 'SELECT') AS authenticated_roster,
  NOT has_table_privilege('anon', 'public.session_roster', 'SELECT') AS anon_roster_denied,
  NOT has_function_privilege('public', 'private.session_roster_rows()', 'EXECUTE') AS public_reader_denied,
  has_function_privilege('authenticated', 'private.session_roster_rows()', 'EXECUTE') AS authenticated_reader;

-- No profile/history DELETE policy was added.
SELECT count(*) = 0 AS no_profile_delete_policy
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'DELETE';

-- Actor matrix (execute with actual ids and always ROLLBACK):
--
-- BEGIN;
-- SET LOCAL ROLE authenticated;
-- SELECT set_config('request.jwt.claim.role', 'authenticated', true);
-- SELECT set_config('request.jwt.claim.sub', ':student_a', true);
-- SELECT set_config('request.jwt.claims',
--   '{"sub":":student_a","role":"authenticated","email":"student-a@example.test"}', true);
-- SELECT * FROM public.profiles WHERE id = ':student_a';       -- one row
-- SELECT * FROM public.profiles WHERE id = ':student_b';       -- zero rows
-- UPDATE public.profiles SET phone = '+41000000000' WHERE id = ':student_a'; -- succeeds when active
-- UPDATE public.profiles SET role = 'admin' WHERE id = ':student_a';          -- protected-field error
-- UPDATE public.profiles SET is_active = false WHERE id = ':student_a';       -- protected-field error
-- UPDATE public.profiles SET email = 'other@example.test' WHERE id = ':student_a'; -- Auth-email error
-- UPDATE public.profiles SET email = 'student-a@example.test' WHERE id = ':student_a'; -- exact signed email only
-- UPDATE public.profiles SET date_of_birth = CURRENT_DATE + 1 WHERE id = ':student_a'; -- future-DOB error
-- UPDATE public.profiles SET phone = 'x' WHERE id = ':student_b';             -- zero rows
-- ROLLBACK;
--
-- As active admin A:
-- * list profiles; edit student B personal fields
-- * assign only student/coach/admin; assigning accounting fails
-- * changing own role or self-deactivating fails
-- * deactivate/reactivate another profile
-- * after transactionally creating a second active admin, concurrent attempts
--   to remove both must leave at least one active admin
--
-- As inactive student A:
-- * own profile/bookings SELECT remains available
-- * profile UPDATE, booking INSERT/UPDATE/cancel, invoice issuance fail
--
-- As active coach C:
-- * session_roster includes assigned rows with id/name/phone only
-- * unrelated rows and full participant profiles are unavailable
-- * deactivation or assignment removal removes rows on the next request
--
-- As accounting and anon:
-- * directory/roster/admin privileges remain unavailable
-- * anon booking_slots remains readable and contains no PII
--
-- Service-role functions:
-- * active owner or active admin may issue/cancel
-- * inactive owner/admin is denied
-- * inactive owner may retrieve an existing own invoice document
-- * scheduler-secret reconciliation remains available

SELECT '0011 F1.04 static assertions loaded; actor mutations require rollback-safe JWT checks' AS status;
