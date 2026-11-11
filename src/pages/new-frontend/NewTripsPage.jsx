import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

const NewTripsPage = () => (
  <>
  <Helmet>
    <title>AGC Padel Academy — Trips</title>
  </Helmet>
  <section className="nf-page">
    <p className="nf-kicker">Trips</p>
    <h1 className="nf-title">Ebro Delta, played properly.</h1>
    <p className="nf-lead">A week of morning padel, Delta light, hotel, and transfers. Visual replica of the trips story. No booking from this page.</p>

    <div className="nf-mosaic" style={{ minHeight: 420 }}>
      <img alt="Ebro Delta" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/delta-hIX8c.jpg" />
      <div style={{ display: 'grid', gap: 12 }}>
        <img alt="Group at La Ràpita" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-camp-gk3WD.jpeg" />
        <img alt="Kids and coaches on trip" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-xiquetys-camp-LKCMQ.jpeg" />
      </div>
    </div>

    <div className="nf-grid nf-grid-3">
      <article className="nf-card">
        <p className="nf-kicker">Day 1</p>
        <h3>Arrive</h3>
        <p>Transfer, hotel check-in, welcome dinner looking over the Delta.</p>
      </article>
      <article className="nf-card">
        <p className="nf-kicker">Days 2–6</p>
        <h3>Train + nature</h3>
        <p>Padel in the morning. River and lagoon in the afternoon. The group already knows how AGC trains at home.</p>
      </article>
      <article className="nf-card">
        <p className="nf-kicker">Day 7</p>
        <h3>Play + farewell</h3>
        <p>Mini-tournament among the week’s players, then a closing night.</p>
        <Link to="/new/contact" className="nf-pill">Ask about the next trip</Link>
      </article>
    </div>
  </section>
  </>
);

export default NewTripsPage;
