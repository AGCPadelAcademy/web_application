import { Link } from 'react-router-dom';

const MEMBERSHIPS = [
  { title: '1 session / week', price: 'CHF 280', note: 'Monthly membership · visual sample' },
  { title: '2 sessions / week', price: 'CHF 420', note: 'Most popular · visual sample' },
  { title: '3 sessions / week', price: 'CHF 540', note: 'Intensive · visual sample' },
];

const SESSIONS = [
  { title: '60 minutes', price: 'CHF 70', note: 'Single adult session' },
  { title: '90 minutes', price: 'CHF 95', note: 'Single adult session' },
];

const NewLessonsPage = () => (
  <section className="nf-page">
    <p className="nf-kicker">Training</p>
    <h1 className="nf-title">Lessons that stay with you.</h1>
    <p className="nf-lead">Adult memberships and individual sessions, restyled for the new frontend. Cards are visual only — booking stays on the main site.</p>

    <h2 className="mt-16 mb-4 text-sm font-extrabold tracking-[0.2em] uppercase" style={{ color: 'var(--nf-olive)' }}>Adult memberships</h2>
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

    <h2 className="mt-16 mb-4 text-sm font-extrabold tracking-[0.2em] uppercase" style={{ color: 'var(--nf-olive)' }}>Individual sessions</h2>
    <div className="nf-grid nf-grid-2">
      {SESSIONS.map((item) => (
        <article key={item.title} className="nf-card">
          <h3>{item.title}</h3>
          <div className="nf-price">{item.price}</div>
          <p>{item.note}. Cancellation window on the live product is 48 hours.</p>
          <Link to="/new/contact" className="nf-pill">Book a trial conversation</Link>
        </article>
      ))}
    </div>
  </section>
);

export default NewLessonsPage;
