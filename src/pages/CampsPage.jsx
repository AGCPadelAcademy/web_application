import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import CampFlyer from '@/components/camps/CampFlyer';
import FlyerLightbox from '@/components/modals/FlyerLightbox';
import {
  CAMP_FULL_LABEL,
  deriveCampStatus,
  distinctCampTypes,
  fetchPublicCamps,
  filterCampsByType,
  FUNNEL_EVENTS,
  trackCampFunnelEvent,
} from '@/lib/camps';

const statusLabel = (status) => {
  if (status === 'full') return CAMP_FULL_LABEL;
  if (status === 'closed') return 'Registration closed';
  return 'Registration open';
};

const CampsPage = () => {
  const [camps, setCamps] = useState([]);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);

  useEffect(() => {
    trackCampFunnelEvent(FUNNEL_EVENTS.PAGE_VIEW);
    fetchPublicCamps()
      .then(setCamps)
      .catch((err) => setError(err.message || 'Could not load camps.'));
  }, []);

  const types = useMemo(() => distinctCampTypes(camps), [camps]);
  const visibleCamps = useMemo(() => filterCampsByType(camps, typeFilter), [camps, typeFilter]);

  const filterClass = (active) =>
    `px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
      active
        ? 'bg-green-500 text-black border-green-500'
        : 'bg-gray-950 text-gray-200 border-gray-700 hover:border-green-500/60'
    }`;

  return (
    <>
      <Helmet>
        <title>Camps - AGC Padel Academy</title>
      </Helmet>
      <div className="px-6 py-12 md:py-24 max-w-6xl mx-auto w-full">
        <h1 className="text-3xl md:text-5xl font-bold font-serif mb-3">Padel Camps</h1>
        <p className="text-gray-400 mb-6">Holiday camps for children. Choose a camp, register a saved child, and pay by bank transfer after the invoice is issued.</p>
        {types.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10" role="group" aria-label="Filter camps by type">
            <button type="button" className={filterClass(!typeFilter)} onClick={() => setTypeFilter(null)}>
              All camps
            </button>
            {types.map((type) => (
              <button
                key={type}
                type="button"
                className={filterClass(typeFilter === type)}
                onClick={() => setTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-red-400 mb-6">{error}</p>}
        {!error && camps.length === 0 && (
          <p className="text-gray-400">No published camps right now. Check back soon.</p>
        )}
        {!error && camps.length > 0 && visibleCamps.length === 0 && (
          <p className="text-gray-400">No published camps of this type.</p>
        )}
        <div className="flex flex-col gap-6">
          {visibleCamps.map((camp) => {
            const status = deriveCampStatus(camp);
            return (
              <article key={camp.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-1 flex flex-col min-w-0">
                <h2 className="text-2xl font-semibold mb-2">{camp.name}</h2>
                <p className="text-sm text-gray-400 mb-3">{camp.start_date} → {camp.end_date}</p>
                {camp.schedule_text && <p className="text-sm text-gray-300 mb-2">{camp.schedule_text}</p>}
                {(camp.min_age != null || camp.max_age != null) && (
                  <p className="text-sm text-gray-300 mb-2">Ages {camp.min_age ?? '—'}–{camp.max_age ?? '—'}</p>
                )}
                {camp.eligibility_text && <p className="text-sm text-gray-400 mb-2">{camp.eligibility_text}</p>}
                {camp.description && <p className="text-sm text-gray-300 mb-4 flex-1">{camp.description}</p>}
                <p className={`text-sm font-semibold mb-4 ${status === 'full' ? 'text-amber-400' : status === 'open' ? 'text-green-400' : 'text-gray-400'}`}>
                  {statusLabel(status)}
                  {status !== 'full' && camp.places_remaining != null ? ` · ${camp.places_remaining} places left` : ''}
                </p>
                {status === 'full' ? (
                  camp.waitlist_enabled ? (
                    <Link to={`/camps/${camp.slug}`} className="text-center bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl">Join waitlist</Link>
                  ) : (
                    <button type="button" disabled className="bg-gray-800 text-gray-500 font-bold py-3 rounded-xl cursor-not-allowed">{CAMP_FULL_LABEL}</button>
                  )
                ) : (
                  <Link to={`/camps/${camp.slug}`} className="text-center bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-xl">
                    {status === 'open' ? 'View & register' : 'View camp'}
                  </Link>
                )}
                </div>
                <CampFlyer
                  camp={camp}
                  onOpen={(url, name) => setLightbox({ url, title: name })}
                  className="w-full md:w-[min(42%,26rem)] min-h-[16rem] md:min-h-[22rem] shrink-0 md:self-stretch"
                />
              </article>
            );
          })}
        </div>
      </div>
      <FlyerLightbox
        open={Boolean(lightbox)}
        imageUrl={lightbox?.url ?? null}
        title={lightbox?.title ?? ''}
        onClose={() => setLightbox(null)}
      />
    </>
  );
};

export default CampsPage;
