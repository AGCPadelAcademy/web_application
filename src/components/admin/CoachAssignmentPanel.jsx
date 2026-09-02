import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  listBookingsForAssignment,
  listCoachProfiles,
  updateBookingCoachId,
  coachAssignmentErrorMessage,
} from '@/lib/coachAssignments';

function formatDate(value) {
  if (!value) return 'Date TBD';
  try {
    return format(parseISO(value), 'd MMM yyyy');
  } catch {
    return value;
  }
}

const CoachAssignmentPanel = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [bookingRows, coachRows] = await Promise.all([
        listBookingsForAssignment(),
        listCoachProfiles(),
      ]);
      setBookings(bookingRows);
      setCoaches(coachRows);
    } catch (error) {
      toast({
        title: 'Could not load assignments',
        description: 'Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAssign = async (bookingId, nextCoachId) => {
    const coachId = nextCoachId || null;
    setSavingId(bookingId);
    try {
      const updated = await updateBookingCoachId(bookingId, coachId);
      setBookings((current) =>
        current.map((row) => (row.id === bookingId ? { ...row, coach_id: updated.coach_id } : row))
      );
      toast({
        title: coachId ? 'Coach assigned' : 'Assignment cleared',
        description: 'The roster updates on the next coach refresh.',
      });
    } catch (error) {
      toast({
        title: 'Assignment failed',
        description: coachAssignmentErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-6 py-12 text-center text-gray-400">
        No bookings to assign yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-900 text-gray-400">
          <tr>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Lesson</th>
            <th className="px-4 py-3 font-medium">Participant</th>
            <th className="px-4 py-3 font-medium">Coach</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} className="border-t border-gray-800">
              <td className="px-4 py-3 text-gray-200">{formatDate(booking.booking_date)}</td>
              <td className="px-4 py-3 text-gray-300">
                {booking.start_time ? String(booking.start_time).slice(0, 5) : 'TBD'}
              </td>
              <td className="px-4 py-3 text-white">{booking.lesson_name}</td>
              <td className="px-4 py-3 text-gray-200">{booking.participant_full_name}</td>
              <td className="px-4 py-3">
                <select
                  aria-label={`Coach for ${booking.lesson_name}`}
                  className="w-full max-w-xs rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  value={booking.coach_id || ''}
                  disabled={savingId === booking.id}
                  onChange={(event) => handleAssign(booking.id, event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.full_name || 'Coach'}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CoachAssignmentPanel;
