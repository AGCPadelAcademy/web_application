import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { format, parseISO } from 'date-fns';
import { fetchSessionRoster } from '@/lib/sessionRoster';
import NewMasthead from './NewMasthead';

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

const NewCoachRosterPage = () => {
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
      <NewMasthead title="Session roster" lead="Participants for sessions assigned to you. Financial details are not shown here." />
      <section className="nf-page">
        {loading && <p className="nf-lead">Loading roster…</p>}
        {error && <p className="nf-error">{error}</p>}
        {!loading && !error && rows.length === 0 && <p className="nf-lead">No sessions assigned yet.</p>}
        {!loading && !error && rows.length > 0 && (
          <div className="nf-table-wrap">
            <table className="nf-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Phone</th>
                  <th>Lesson</th>
                  <th>Date</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.booking_id}>
                    <td>{row.participant_full_name}</td>
                    <td>
                      {row.participant_phone ? (
                        <a href={`tel:${row.participant_phone}`}>{row.participant_phone}</a>
                      ) : 'Not provided'}
                    </td>
                    <td>{row.lesson_name}</td>
                    <td>{formatRosterDate(row.booking_date)}</td>
                    <td>{formatRosterTime(row.start_time, row.end_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

export default NewCoachRosterPage;
