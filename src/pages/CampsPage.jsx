import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import CampFlyer from '@/components/camps/CampFlyer';
import FlyerLightbox from '@/components/modals/FlyerLightbox';
import { CAMP_FULL_LABEL, deriveCampStatus, fetchPublicCamps, formatCampPrice, FUNNEL_EVENTS, trackCampFunnelEvent } from '@/lib/camps';

const statusLabel = (status) => {
  if (status === 'full') return CAMP_FULL_LABEL;
  if (status === 'closed') return 'Registration closed';
  return 'Registration open';
};

const CampsPage = () => {
  const [camps, setCamps] = useState([]);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    trackCampFunnelEvent(FUNNEL_EVENTS.PAGE_VIEW);
    fetchPublicCamps()
      .then(setCamps)
      .catch((err) => setError(err.message || 'Could not load camps.'));
  }, []);

  return (
    <>
      <Helmet>
        <title>Camps - AGC Padel Academy</title>
      </Helmet>
      <div className="px-6 py-12 md:py-24 max-w-6xl mx-auto w-full">
        <h1 className="text-3xl md:text-5xl font-bold font-serif mb-3">Padel Camps</h1>
        <p className="text-gray-400 mb-10 max-w-2xl">Holiday camps for children. Choose a camp, register a saved child, and pay by bank transfer after the invoice is issued.</p>
        {error && <p className="text-red-400 mb-6">{error}</p>}
        {!error && camps.length === 0 && (
          <p className="text-gray-400">No published camps right now. Check back soon.</p>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          {camps.map((camp) => {
            const status = deriveCampStatus(camp);
            return (
              <article key={camp.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-1 flex flex-col">
                <h2 className="text-2xl font-semibold mb-2">{camp.name}</h2>
                <p className="text-sm text-gray-400 mb-3">{camp.start_date} → {camp.end_date}</p>
                {camp.schedule_text && <p className="text-sm text-gray-300 mb-2">{camp.schedule_text}</p>}
                {(camp.min_age != null || camp.max_age != null) && (
                  <p className="text-sm text-gray-300 mb-2">Ages {camp.min_age ?? '—'}–{camp.max_age ?? '—'}</p>
                )}
                {camp.eligibility_text && <p className="text-sm text-gray-400 mb-2">{camp.eligibility_text}</p>}
                {camp.member_price_amount != null ? (
                  <p className="text-lg font-bold text-green-400 mb-2">
                    {formatCampPrice(camp.member_price_amount, camp.currency)} <span className="text-sm text-gray-400 font-normal">members</span>
                    <span className="text-gray-500 mx-1">·</span>
                    <span className="text-base text-gray-300">{formatCampPrice(camp.price_amount, camp.currency)}</span> <span className="text-sm text-gray-400 font-normal">standard</span>
                  </p>
                ) : (
                  <p className="text-lg font-bold text-green-400 mb-2">{formatCampPrice(camp.price_amount, camp.currency)}</p>
                )}
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
                  className="w-full md:w-44 h-44 shrink-0 md:self-start"
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
