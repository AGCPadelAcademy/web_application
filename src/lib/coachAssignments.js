import { supabase } from '@/lib/customSupabaseClient';

export function isMissingCoachAssignmentSchema(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    (message.includes('coach_id') && (
      message.includes('does not exist') ||
      message.includes('could not find') ||
      message.includes('schema cache')
    ))
  );
}

export async function isCoachAssignmentAvailable() {
  const { error } = await supabase
    .from('bookings')
    .select('coach_id')
    .limit(1);

  if (!error) return true;
  if (isMissingCoachAssignmentSchema(error)) return false;
  return true;
}

export function coachAssignmentErrorMessage(error) {
  const raw = String(error?.message || '');
  if (raw.includes('only an administrator can change coach assignment')) {
    return 'Only an administrator can change coach assignment.';
  }
  if (raw.includes('coach_id must reference an active coach')) {
    return 'That coach is inactive. Choose an active coach or clear the assignment.';
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
    .eq('is_active', true)
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
  const profileIds = [...new Set(rows.flatMap((row) => [row.user_id, row.coach_id]).filter(Boolean))];
  if (profileIds.length === 0) {
    return rows.map((row) => ({
      ...row,
      participant_full_name: 'Student',
      coach_full_name: null,
      coach_is_active: null,
    }));
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, is_active')
    .in('id', profileIds);

  if (profileError) throw profileError;

  const byId = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
  return rows.map((row) => ({
    ...row,
    participant_full_name: byId[row.user_id]?.full_name || 'Student',
    coach_full_name: row.coach_id ? (byId[row.coach_id]?.full_name || 'Coach') : null,
    coach_is_active: row.coach_id ? byId[row.coach_id]?.is_active === true : null,
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
