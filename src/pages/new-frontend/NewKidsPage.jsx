import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  CAMP_FULL_LABEL,
  campFlyerSignedUrl,
  deriveCampStatus,
  distinctCampTypes,
  fetchPublicCamps,
  filterCampsByType,
  FUNNEL_EVENTS,
  sortPublicCamps,
  trackCampFunnelEvent,
} from '@/lib/camps';
import NewMasthead from './NewMasthead';

const statusCopy = (camp, status) => {
  if (status === 'full') return CAMP_FULL_LABEL;
  if (status === 'closed') return 'Registration closed';
  const places = camp.places_remaining != null ? ` · ${camp.places_remaining} places left` : '';
  return `Registration open${places}`;
};

const campAction = (camp, status) => {
  if (status === 'full') {
    return camp.waitlist_enabled
      ? { href: `/new/kids/${camp.slug}`, label: 'Join waitlist', quiet: true }
      : { disabled: true, label: CAMP_FULL_LABEL };
  }
  return {
    href: `/new/kids/${camp.slug}`,
    label: status === 'open' ? 'View & register' : 'View camp',
    quiet: status !== 'open',
  };
};

const CampPhoto = ({ camp }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!camp.flyer_path) {
      setUrl(null);
      return undefined;
    }
    campFlyerSignedUrl(camp.flyer_path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [camp.flyer_path]);

  if (!url) return null;
  return <img alt={`${camp.name} camp`} src={url} />;
};

const NewKidsPage = () => {
  const [camps, setCamps] = useState([]);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);

  useEffect(() => {
    trackCampFunnelEvent(FUNNEL_EVENTS.PAGE_VIEW);
    fetchPublicCamps()
      .then(setCamps)
      .catch((err) => setError(err.message || 'Could not load camps.'));
  }, []);

  const types = useMemo(() => distinctCampTypes(camps), [camps]);
  const visible = useMemo(
    () => sortPublicCamps(filterCampsByType(camps, typeFilter)),
    [camps, typeFilter],
  );

  return (
    <>
      <Helmet>
        <title>AGC Padel Academy — Kids Academy</title>
      </Helmet>
      <NewMasthead
        title="Kids Academy"
        lead="Holiday camps for children. Choose a camp, register a saved child, and pay by bank transfer after the invoice is issued."
      />
      <div className="nf-page">
        {types.length > 0 && (
          <div className="nf-filters" role="group" aria-label="Filter camps by type">
            <button type="button" className={!typeFilter ? 'is-on' : undefined} onClick={() => setTypeFilter(null)}>
              All camps
            </button>
            {types.map((type) => (
              <button
                key={type}
                type="button"
                className={typeFilter === type ? 'is-on' : undefined}
                onClick={() => setTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        )}
        {error && <p className="nf-error">{error}</p>}
        {!error && camps.length === 0 && <p className="nf-lead">No published camps right now. Check back soon.</p>}
        {!error && camps.length > 0 && visible.length === 0 && (
          <p className="nf-lead">No published camps of this type.</p>
        )}
        <div className="nf-camp-list">
          {visible.map((camp) => {
            const status = deriveCampStatus(camp);
            const action = campAction(camp, status);
            return (
              <article key={camp.id} className="nf-card nf-camp">
                <div className="nf-camp-photo">
                  <CampPhoto camp={camp} />
                </div>
                <div className="nf-camp-copy">
                  {camp.camp_type && <p className="nf-kicker">{camp.camp_type}</p>}
                  <h3>{camp.name}</h3>
                  <p className="nf-camp-meta">{camp.start_date} → {camp.end_date}</p>
                  {camp.schedule_text && <p className="nf-camp-meta">{camp.schedule_text}</p>}
                  {(camp.min_age != null || camp.max_age != null) && (
                    <p className="nf-camp-meta">Ages {camp.min_age ?? '—'}–{camp.max_age ?? '—'}</p>
                  )}
                  {camp.eligibility_text && <p className="nf-camp-meta">{camp.eligibility_text}</p>}
                  <p className={`nf-camp-status is-${status}`}>{statusCopy(camp, status)}</p>
                  {action.disabled ? (
                    <button type="button" className="nf-pill" disabled>{action.label}</button>
                  ) : (
                    <Link to={action.href} className={action.quiet ? 'nf-pill is-quiet' : 'nf-pill'}>{action.label}</Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default NewKidsPage;
