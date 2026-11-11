import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

const PHOTO = 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/albert-ensenyan-pilota-agc-Mii0Q.jpg';

const MEMBERSHIPS = [
  { title: '1 session / week', price: 'CHF 280', note: 'Monthly membership · visual sample' },
  { title: '2 sessions / week', price: 'CHF 420', note: 'Most popular · visual sample' },
  { title: '3 sessions / week', price: 'CHF 540', note: 'Intensive · visual sample' },
];

const SESSIONS = [
  { title: 'Private 60 min', price: 'CHF 70', note: 'Single adult session' },
  { title: 'Private 90 min', price: 'CHF 95', note: 'Single adult session' },
];

const NewAdultsPage = () => (
  <>
  <Helmet>
    <title>AGC Padel Academy — Adult Training</title>
  </Helmet>
  <section className="nf-page">
    <p className="nf-kicker">Adult training</p>
    <h1 className="nf-title">Your game. Your next level.</h1>
    <p className="nf-lead">Group memberships and private sessions, restyled from Lessons. Cards are visual only — booking stays on the main site.</p>

    <div className="nf-mosaic" style={{ minHeight: 320 }}>
      <img alt="Adult coaching at AGC" src={PHOTO} />
      <article className="nf-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p className="nf-kicker">01 Group · 02 Private · 03 Intensive</p>
        <h3>From first rally to match play.</h3>
        <p>Professional coaching built around your week. 48-hour cancellation on the live product.</p>
        <Link to="/new/contact" className="nf-pill">Find your training</Link>
      </article>
    </div>

    <h2 className="mt-16 mb-4 text-sm font-extrabold tracking-[0.2em] uppercase" style={{ color: 'var(--nf-olive)' }}>Memberships</h2>
    <div className="nf-grid nf-grid-3">
      {MEMBERSHIPS.map((item) => (
        <article key={item.title} className="nf-card">
          <h3>{item.title}</h3>
          <div className="nf-price">{item.price}</div>
          <p>{item.note}</p>
          <Link to="/new/contact" className="nf-pill">Ask about this plan</Link>
        </article>
      ))}
    </div>

    <h2 className="mt-16 mb-4 text-sm font-extrabold tracking-[0.2em] uppercase" style={{ color: 'var(--nf-olive)' }}>Private sessions</h2>
    <div className="nf-grid nf-grid-2">
      {SESSIONS.map((item) => (
        <article key={item.title} className="nf-card">
          <h3>{item.title}</h3>
          <div className="nf-price">{item.price}</div>
          <p>{item.note}</p>
          <Link to="/new/contact" className="nf-pill">Book a trial conversation</Link>
        </article>
      ))}
    </div>
  </section>
  </>
);

export default NewAdultsPage;
