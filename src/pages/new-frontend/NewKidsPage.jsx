import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import NewMasthead from './NewMasthead';

const IMG = {
  kids: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-xiquetys-camp-LKCMQ.jpeg',
  group: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-camp-gk3WD.jpeg',
  court: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/albert-ensenyan-pilota-agc-Mii0Q.jpg',
};

const FULL_LABEL = 'Complet / Ausgebucht';

// Visual sample of the camps list. Not the live published calendar.
const CAMPS = [
  {
    name: 'Mini Camp',
    type: 'Mini',
    start: '7 Apr',
    end: '11 Apr',
    schedule: 'Mornings, 9:00–12:30',
    ages: '4–6',
    eligibility: 'First steps on court. A parent stays nearby.',
    description: 'Short rallies, games, and a week that feels like a club.',
    status: 'open',
    places: 6,
    img: IMG.kids,
  },
  {
    name: 'Junior Camp',
    type: 'Junior',
    start: '6 Jul',
    end: '10 Jul',
    schedule: 'Full days, with a lunch break',
    ages: '7–13',
    eligibility: 'Players who can hold a rally.',
    description: 'Technique, match play, and recovery. Groups by age.',
    status: 'open',
    places: 4,
    img: IMG.group,
  },
  {
    name: 'Competition Camp',
    type: 'Competition',
    start: '12 Oct',
    end: '16 Oct',
    schedule: 'Afternoons, match blocks',
    ages: '14–16',
    eligibility: 'Players already in competition.',
    description: 'Points, patterns, and a week aimed at tournament play.',
    status: 'full',
    waitlist: true,
    img: IMG.court,
  },
];

const TYPES = ['Mini', 'Junior', 'Competition'];

const statusCopy = (camp) => {
  if (camp.status === 'full') return FULL_LABEL;
  if (camp.status === 'closed') return 'Registration closed';
  const places = camp.places != null ? ` · ${camp.places} places left` : '';
  return `Registration open${places}`;
};

const NewKidsPage = () => {
  const [typeFilter, setTypeFilter] = useState(null);
  const visible = CAMPS.filter((camp) => !typeFilter || camp.type === typeFilter);

  return (
    <>
      <Helmet>
        <title>AGC Padel Academy — Kids Academy</title>
      </Helmet>
      <NewMasthead
        title="Kids Academy"
        lead="Holiday camps for children. Each card shows the week, the ages, and whether places are left. This list is visual only."
      />
      <div className="nf-page">
        <div className="nf-filters" role="group" aria-label="Filter camps by type">
          <button type="button" className={!typeFilter ? 'is-on' : undefined} onClick={() => setTypeFilter(null)}>
            All camps
          </button>
          {TYPES.map((type) => (
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

        {visible.length === 0 && (
          <p className="nf-lead">No camps of this type in this sample.</p>
        )}

        <div className="nf-camp-list">
          {visible.map((camp) => (
            <article key={camp.name} className="nf-card nf-camp">
              <div className="nf-camp-copy">
                <p className="nf-kicker">{camp.type}</p>
                <h3>{camp.name}</h3>
                <p className="nf-camp-meta">{camp.start} → {camp.end}</p>
                <p className="nf-camp-meta">{camp.schedule}</p>
                <p className="nf-camp-meta">Ages {camp.ages}</p>
                <p className="nf-camp-meta">{camp.eligibility}</p>
                <p>{camp.description}</p>
                <p className={`nf-camp-status is-${camp.status}`}>{statusCopy(camp)}</p>
                {camp.status === 'full' && !camp.waitlist ? (
                  <button type="button" className="nf-pill" disabled>{FULL_LABEL}</button>
                ) : (
                  <Link to="/new/contact" className={camp.status === 'full' ? 'nf-pill is-quiet' : 'nf-pill'}>
                    {camp.status === 'open' ? 'View camp' : 'Join the list'}
                  </Link>
                )}
              </div>
              <div className="nf-camp-photo">
                <img alt={`${camp.name} camp`} src={camp.img} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
};

export default NewKidsPage;
