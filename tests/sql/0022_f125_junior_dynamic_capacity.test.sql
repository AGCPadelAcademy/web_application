-- SQL verification for 0022_f125_junior_dynamic_capacity (F1.25 C8).
-- Apply 0022, then run these assertions. Do not change stored max_capacity.

SELECT public.camp_registration_ceiling('Junior', 10, 8) = 10 AS junior_before_window;
SELECT public.camp_registration_ceiling('Junior', 10, 9) = 16 AS junior_window_opens;
SELECT public.camp_registration_ceiling('Junior', 10, 15) = 16 AS junior_still_open;
SELECT public.camp_registration_ceiling('Junior', 10, 16) = 16 AS junior_at_ceiling;
SELECT public.camp_places_remaining('Junior', 10, 8) = 2 AS junior_two_left;
SELECT public.camp_places_remaining('Junior', 10, 9) = 1 AS junior_shows_one;
SELECT public.camp_places_remaining('Junior', 10, 15) = 1 AS junior_still_shows_one;
SELECT public.camp_places_remaining('Junior', 10, 16) = 0 AS junior_full_display;
SELECT public.camp_registration_ceiling('Mini', 10, 9) = 10 AS mini_hard_cap;
SELECT public.camp_places_remaining('Mini', 10, 10) = 0 AS mini_full;
SELECT public.camp_registration_ceiling('Competition', 10, 9) = 10 AS competition_hard_cap;
SELECT position('camp_registration_ceiling' in pg_get_functiondef('public.register_camp_child(uuid,uuid,uuid,uuid[],text,boolean)'::regprocedure)) > 0 AS register_uses_ceiling;
SELECT position('age_out_of_range' in pg_get_functiondef('public.register_camp_child(uuid,uuid,uuid,uuid[],text,boolean)'::regprocedure)) = 0 AS no_age_refusal;
