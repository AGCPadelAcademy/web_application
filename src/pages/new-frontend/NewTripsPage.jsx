import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import NewMasthead from './NewMasthead';

const PHOTOS = [
  { src: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/delta-hIX8c.jpg', alt: 'Ebro Delta' },
  { src: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-camp-gk3WD.jpeg', alt: 'The group at La Ràpita' },
  { src: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-xiquetys-camp-LKCMQ.jpeg', alt: 'Players and coaches on the trip' },
];

const FACTS = [
  { label: 'Training', value: 'Mornings on court' },
  { label: 'Stay', value: 'Hotel in La Ràpita' },
  { label: 'Afternoons', value: 'River and lagoon' },
  { label: 'Transfer', value: 'Included' },
];

const DAYS = [
  { when: 'Day 1', title: 'Arrive', copy: 'Transfer, check in, welcome dinner.' },
  { when: 'Days 2–6', title: 'Train, then the Delta', copy: 'Padel in the morning. Outdoors after lunch.' },
  { when: 'Day 7', title: 'Play and leave', copy: 'A short tournament, then the closing night.' },
];

const NewTripsPage = () => (
  <>
    <Helmet>
      <title>AGC Padel Academy — Trips</title>
    </Helmet>
    <NewMasthead
      title="Trips"
      lead="One week in the Ebro Delta. Court in the morning, the Delta in the afternoon, hotel and transfer included."
    />
    <section className="nf-page">
      <div className="nf-trip-photos">
        {PHOTOS.map((photo) => (
          <img key={photo.alt} alt={photo.alt} src={photo.src} />
        ))}
      </div>

      <div className="nf-facts">
        {FACTS.map((fact) => (
          <article key={fact.label} className="nf-fact">
            <p className="nf-kicker">{fact.label}</p>
            <b>{fact.value}</b>
          </article>
        ))}
      </div>

      <div className="nf-days">
        {DAYS.map((day) => (
          <article key={day.when} className="nf-card nf-day">
            <em>{day.when}</em>
            <div>
              <h3>{day.title}</h3>
              <p>{day.copy}</p>
            </div>
          </article>
        ))}
      </div>

      <Link to="/new/contact" className="nf-pill">Ask about the next trip</Link>
    </section>
  </>
);

export default NewTripsPage;
