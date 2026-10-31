-- SQL verification for 0023_f125_junior_places_countdown (F1.25 C9).
-- Apply 0023, then run these assertions. Do not change stored max_capacity.
-- Replaces the C8 expectation that Junior remaining places stay 1 from 9 through 15.

SELECT public.camp_registration_ceiling('Junior', 10, 6) = 10 AS junior_before_window;
SELECT public.camp_places_remaining('Junior', 10, 6) = 4 AS junior_four_left;
SELECT public.camp_registration_ceiling('Junior', 10, 7) = 16 AS junior_window_opens;
SELECT public.camp_places_remaining('Junior', 10, 7) = 3 AS junior_shows_three;
SELECT public.camp_places_remaining('Junior', 10, 13) = 3 AS junior_still_three;
SELECT public.camp_places_remaining('Junior', 10, 14) = 2 AS junior_shows_two;
SELECT public.camp_places_remaining('Junior', 10, 15) = 1 AS junior_shows_one;
SELECT public.camp_places_remaining('Junior', 10, 16) = 0 AS junior_full_display;
SELECT public.camp_registration_ceiling('Junior', 10, 15) = 16 AS junior_still_accepts;
SELECT public.camp_registration_ceiling('Mini', 10, 7) = 10 AS mini_hard_cap;
SELECT public.camp_places_remaining('Mini', 10, 10) = 0 AS mini_full;
SELECT public.camp_registration_ceiling('Competition', 10, 7) = 10 AS competition_hard_cap;
