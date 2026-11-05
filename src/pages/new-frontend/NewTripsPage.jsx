import { Link } from 'react-router-dom';

const NewTripsPage = () => (
  <section className="nf-page">
    <p className="nf-kicker">Travel</p>
    <h1 className="nf-title">Ebro Delta, played properly.</h1>
    <p className="nf-lead">A visual replica of the trips story: courts, river light, and a week away from Cham. No booking from this concept page.</p>
    <div className="nf-grid nf-grid-2">
      <article className="nf-card">
        <h3>The trip</h3>
        <p>Padel mornings, Delta afternoons. Shared meals, open courts, and a group that already knows how AGC trains at home.</p>
        <Link to="/new/contact" className="nf-pill">Ask about the next trip</Link>
      </article>
      <article className="nf-card">
        <h3>Who it is for</h3>
        <p>Adult players who want more than a weekend clinic. Intermediate and advanced groups, with the academy staff on court.</p>
        <Link to="/new/lessons" className="nf-pill">See the training base</Link>
      </article>
    </div>
  </section>
);

export default NewTripsPage;
