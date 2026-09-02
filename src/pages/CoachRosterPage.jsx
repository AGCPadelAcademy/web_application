import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { format, parseISO } from 'date-fns';
import { Calendar, Clock, Loader2, Users } from 'lucide-react';
import { fetchSessionRoster } from '@/lib/sessionRoster';

function formatRosterDate(value) {
  if (!value) return 'Date TBD';
  try {
    return format(parseISO(value), 'EEE d MMM yyyy');
  } catch {
    return value;
  }
}

function formatRosterTime(start, end) {
  const startLabel = start ? String(start).slice(0, 5) : null;
  const endLabel = end ? String(end).slice(0, 5) : null;
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  if (startLabel) return startLabel;
  return 'Time TBD';
}

const CoachRosterPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSessionRoster();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load the roster.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>Session roster - AGC Padel Academy</title>
      </Helmet>
      <div className="px-6 py-12 md:py-24 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-green-500" />
            Session roster
          </h1>
          <p className="text-gray-400">
            Participants for sessions assigned to you. Financial details are not shown here.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-6 py-12 text-center text-gray-400">
            No sessions assigned yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Participant</th>
                  <th className="px-4 py-3 font-medium">Lesson</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.booking_id} className="border-t border-gray-800">
                    <td className="px-4 py-3 text-white">{row.participant_full_name}</td>
                    <td className="px-4 py-3 text-gray-200">{row.lesson_name}</td>
                    <td className="px-4 py-3 text-gray-300">
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-500" />
                        {formatRosterDate(row.booking_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      <span className="inline-flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-500" />
                        {formatRosterTime(row.start_time, row.end_time)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default CoachRosterPage;
