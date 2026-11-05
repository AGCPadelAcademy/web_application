import { Link } from 'react-router-dom';

const CAMPS = [
  {
    title: 'Easter Camp',
    when: 'April · Cham',
    copy: 'Kids groups, morning sessions, and a week that feels like a club, not a classroom.',
  },
  {
    title: 'Summer Intensive',
    when: 'July · Cham',
    copy: 'Technique, match play, and recovery in the pistachio-and-forest palette of the new look.',
  },
];

const NewCampsPage = () => (
  <section className="nf-page">
    <p className="nf-kicker">Academy weeks</p>
    <h1 className="nf-title">Camps with room to grow.</h1>
    <p className="nf-lead">Sample camp cards for the new frontend. Dates and availability still live on the main Camps page.</p>
    <div className="nf-grid nf-grid-2">
      {CAMPS.map((camp) => (
        <article key={camp.title} className="nf-card">
          <p className="nf-kicker">{camp.when}</p>
          <h3>{camp.title}</h3>
          <p>{camp.copy}</p>
          <Link to="/new/contact" className="nf-pill">Request a place</Link>
        </article>
      ))}
    </div>
  </section>
);

export default NewCampsPage;
