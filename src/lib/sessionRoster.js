import { supabase } from '@/lib/customSupabaseClient';

export const SESSION_ROSTER_COLUMNS =
  'booking_id, booking_date, start_time, end_time, lesson_name, participant_id, participant_full_name, participant_phone, coach_id';

export async function fetchSessionRoster() {
  const { data, error } = await supabase
    .from('session_roster')
    .select(SESSION_ROSTER_COLUMNS)
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
