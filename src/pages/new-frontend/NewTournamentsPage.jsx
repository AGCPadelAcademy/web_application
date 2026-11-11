import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import NewMasthead from './NewMasthead';

const PHOTOS = [
  { src: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-torneo-agc-MZ4y0.jpg', alt: 'Tournament group with trophies' },
  { src: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-torneo-agc-gent-caminan-4mm1N.jpg', alt: 'Players after a match' },
  { src: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/roman-torneig-agc-48NuE.jpg', alt: 'Tournament participants' },
  { src: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/martin-torneig-agc-0HdjX.jpg', alt: 'On court at an AGC tournament' },
];

const NewTournamentsPage = () => (
  <>
  <Helmet>
    <title>AGC Padel Academy — Tournaments</title>
  </Helmet>
  <NewMasthead
    title="Tournaments"
    lead="One-day opens, golden-point tiebreak, one set, at least four matches. Next date is still to be confirmed."
  />
  <section className="nf-page">
    <article className="nf-card" style={{ marginTop: 40, maxWidth: 640 }}>
      <p className="nf-kicker">Upcoming</p>
      <h3>Date to be confirmed</h3>
      <p>When the academy publishes a date, the live tournaments module can carry it. Here it is a visual board for the New frontend.</p>
      <Link to="/new/contact" className="nf-pill">Ask to be listed</Link>
    </article>

    <div className="nf-grid nf-grid-2" style={{ marginTop: 24 }}>
      {PHOTOS.map((photo) => (
        <article key={photo.src} className="nf-card nf-shot">
          <img alt={photo.alt} src={photo.src} style={{ height: 280 }} />
        </article>
      ))}
    </div>
  </section>
  </>
);

export default NewTournamentsPage;
