import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import NewMasthead from './NewMasthead';

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
  <NewMasthead
    title="Adult Training"
    lead="Two ways to train. Memberships for a weekly group, private sessions when you want the court to yourself. Visual only."
  />
  <div className="nf-page">
    <section className="nf-block" aria-labelledby="adult-memberships">
      <p className="nf-kicker">Weekly group</p>
      <h2 id="adult-memberships">Memberships</h2>
      <p className="nf-lead">A set number of group sessions each week. The prices here are samples, not a live offer.</p>
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
    </section>

    <section className="nf-block" aria-labelledby="adult-private">
      <p className="nf-kicker">One to one</p>
      <h2 id="adult-private">Private sessions</h2>
      <p className="nf-lead">A single coached hour, booked on its own. These cards do not open a booking.</p>
      <div className="nf-grid nf-grid-2">
        {SESSIONS.map((item) => (
          <article key={item.title} className="nf-card">
            <h3>{item.title}</h3>
            <div className="nf-price">{item.price}</div>
            <p>{item.note}</p>
            <Link to="/new/contact" className="nf-pill">Ask about a private</Link>
          </article>
        ))}
      </div>
    </section>
  </div>
  </>
);

export default NewAdultsPage;
