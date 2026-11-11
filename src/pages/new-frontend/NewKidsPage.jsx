import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

const IMG = {
  kids: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-xiquetys-camp-LKCMQ.jpeg',
  group: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-camp-gk3WD.jpeg',
  court: 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/albert-ensenyan-pilota-agc-Mii0Q.jpg',
};

const CAMPS = [
  { title: 'Easter Camp', when: 'April · Cham', copy: 'Morning sessions, mixed games, and a week that feels like a club.', img: IMG.kids },
  { title: 'Summer Intensive', when: 'July · Cham', copy: 'Technique, match play, and recovery. Groups by age, not by noise.', img: IMG.group },
  { title: 'Autumn Rally', when: 'October · Cham', copy: 'Back-to-school rhythm with extra court time and a mini tournament.', img: IMG.court },
];

const NewKidsPage = () => (
  <>
  <Helmet>
    <title>AGC Padel Academy — Kids Academy</title>
  </Helmet>
  <section className="nf-page">
    <p className="nf-kicker">Kids Academy</p>
    <h1 className="nf-title">Little players. Big weeks.</h1>
    <p className="nf-lead">Kids camps work like the academy weeks on the main site: pick a date, request a place, we group by age. This page is visual only.</p>

    <div className="nf-ages">
      <article><p className="nf-kicker">First steps</p><b>4–6</b></article>
      <article><p className="nf-kicker">Mini</p><b>7–9</b></article>
      <article><p className="nf-kicker">Junior</p><b>10–13</b></article>
      <article><p className="nf-kicker">Youth</p><b>14–16</b></article>
    </div>

    <div className="nf-grid nf-grid-3">
      {CAMPS.map((camp) => (
        <article key={camp.title} className="nf-card nf-shot">
          <img alt={camp.title} src={camp.img} />
          <div className="nf-shot-body">
            <p className="nf-kicker">{camp.when}</p>
            <h3>{camp.title}</h3>
            <p>{camp.copy}</p>
            <Link to="/new/contact" className="nf-pill">Request a place</Link>
          </div>
        </article>
      ))}
    </div>
  </section>
  </>
);

export default NewKidsPage;
