import { supabase } from '@/lib/customSupabaseClient';

export function coachAssignmentErrorMessage(error) {
  const raw = String(error?.message || '');
  if (raw.includes('only an administrator can change coach assignment')) {
    return 'Only an administrator can change coach assignment.';
  }
  if (raw.includes('coach_id must reference a profile with role coach')) {
    return 'That profile is not a coach. Choose a coach or clear the assignment.';
  }
  return 'Could not update the coach assignment.';
}

export async function listCoachProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'coach')
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listBookingsForAssignment({ limit = 80 } = {}) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, booking_date, start_time, end_time, lesson_name, coach_id, user_id')
    .order('booking_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = data ?? [];
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  if (userIds.length === 0) {
    return rows.map((row) => ({ ...row, participant_full_name: 'Student' }));
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);

  if (profileError) throw profileError;

  const names = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  return rows.map((row) => ({
    ...row,
    participant_full_name: names[row.user_id] || 'Student',
  }));
}

export async function updateBookingCoachId(bookingId, coachId) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ coach_id: coachId })
    .eq('id', bookingId)
    .select('id, coach_id')
    .single();

  if (error) throw error;
  return data;
}
