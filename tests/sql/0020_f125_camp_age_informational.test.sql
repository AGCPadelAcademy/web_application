-- SQL verification for 0020_f125_camp_age_informational (F1.25 C7).
--
-- Age range is informational. Do not drop age columns.
-- Apply 0020 on the project only when asked, then run the assertions below.

-- Age columns stay.
SELECT count(*) = 2 AS camp_age_columns_kept
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'camps'
  AND column_name IN ('min_age', 'max_age');

SELECT count(*) = 1 AS child_dob_kept
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'children'
  AND column_name = 'date_of_birth';

SELECT count(*) = 1 AS registration_dob_snapshot_kept
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'camp_registrations'
  AND column_name = 'child_date_of_birth';

-- register_camp_child no longer raises age_out_of_range and still snapshots DOB.
SELECT
  position('age_out_of_range' in pg_get_functiondef('public.register_camp_child(uuid,uuid,uuid,uuid[],text,boolean)'::regprocedure)) = 0 AS no_age_refusal,
  position('child_date_of_birth' in pg_get_functiondef('public.register_camp_child(uuid,uuid,uuid,uuid[],text,boolean)'::regprocedure)) > 0 AS snapshots_dob;

-- Six-argument signature stays service-role only.
SELECT
  has_function_privilege('service_role', 'public.register_camp_child(uuid,uuid,uuid,uuid[],text,boolean)', 'EXECUTE') AS service_register,
  NOT has_function_privilege('authenticated', 'public.register_camp_child(uuid,uuid,uuid,uuid[],text,boolean)', 'EXECUTE') AS auth_register_denied,
  NOT has_function_privilege('anon', 'public.register_camp_child(uuid,uuid,uuid,uuid[],text,boolean)', 'EXECUTE') AS anon_register_denied;
