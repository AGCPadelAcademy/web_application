-- SQL verification for 0024_f106_coach_management.
--
-- Static queries below are safe on any database that has the migration.
-- The JWT transactions are comments. Run them only on a test project with
-- real tokens. Do not run them against production.

-- Static: active-coach predicate, no parallel tables, no profile/booking DELETE.
SELECT
  position('is_active' IN pg_get_functiondef('public.prevent_non_admin_coach_assignment()'::regprocedure)) > 0
    AS assignment_requires_active_coach,
  position('coach_id must reference an active coach' IN pg_get_functiondef('public.prevent_non_admin_coach_assignment()'::regprocedure)) > 0
    AS inactive_coach_error_present,
  position('IS DISTINCT FROM OLD.coach_id' IN pg_get_functiondef('public.prevent_non_admin_coach_assignment()'::regprocedure)) > 0
    AS unchanged_assignment_skipped,
  position('is_active' IN pg_get_functiondef('public.is_coach()'::regprocedure)) > 0
    AS coach_helper_active_aware;

SELECT NOT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('coaches', 'groups', 'attendance', 'payroll', 'coach_assignments')
) AS no_parallel_coach_tables;

SELECT count(*) = 0 AS no_profile_or_booking_delete
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'bookings')
  AND cmd = 'DELETE';

-- JWT transactions (test project only). Replace the placeholders.
--
-- As active admin A:
--   UPDATE public.bookings SET coach_id = ':active_coach' WHERE id = ':booking_b2';
--   Expect: success.
--   UPDATE public.bookings SET coach_id = ':inactive_coach' WHERE id = ':booking_b2';
--   Expect: exception 'coach_id must reference an active coach'; coach_id unchanged.
--   UPDATE public.bookings SET coach_id = ':student' WHERE id = ':booking_b2';
--   Expect: exception 'coach_id must reference a profile with role coach'.
--   UPDATE public.bookings SET lesson_name = lesson_name WHERE id = ':booking_b1';
--   Expect: success while booking_b1.coach_id still names the inactive coach.
--   UPDATE public.bookings SET coach_id = NULL WHERE id = ':booking_b2';
--   Expect: success and the booking row remains.
--   UPDATE public.profiles SET role = 'coach' WHERE id = ':student' AND id <> auth.uid();
--   Expect: success when last-admin rule allows it. Revert the role after the check.
--
-- As student S:
--   UPDATE public.bookings SET coach_id = ':active_coach' WHERE id = ':booking_b2';
--   Expect: exception 'only an administrator can change coach assignment'.
--   UPDATE public.profiles SET role = 'coach' WHERE id = auth.uid();
--   Expect: exception; role unchanged.
--
-- As admin A, with booking_b1.coach_id = inactive coach D:
--   UPDATE public.profiles SET is_active = false WHERE id = ':coach_d';
--   SELECT coach_id = ':coach_d' FROM public.bookings WHERE id = ':booking_b1';
--   Expect: true. Deactivation does not clear the assignment.
--
-- As inactive coach D:
--   SELECT count(*) = 0 FROM public.session_roster;
--   Expect: true.
-- As admin A:
--   UPDATE public.profiles SET is_active = true WHERE id = ':coach_d';
-- As coach D again:
--   SELECT count(*) > 0 FROM public.session_roster WHERE booking_id = ':booking_b1';
--   Expect: true when booking_b1 is still assigned to D.
