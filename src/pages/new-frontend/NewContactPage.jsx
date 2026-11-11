import { Helmet } from 'react-helmet-async';
import NewMasthead from './NewMasthead';

const PHOTO = 'https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/albert-ensenyan-pilota-agc-Mii0Q.jpg';

const NewContactPage = () => {
  const onSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <>
    <Helmet>
      <title>AGC Padel Academy — Contact</title>
    </Helmet>
    <NewMasthead
      kicker="Villmergen, Switzerland  /  Contact"
      title="CONTACT"
      lead="A visual form. It does not send mail. Use the main Contact page when a real message has to go through."
    />
    <section className="nf-page">
      <div className="nf-grid nf-grid-2">
        <form className="nf-card nf-form" onSubmit={onSubmit}>
          <label htmlFor="nf-name">Name</label>
          <input id="nf-name" name="name" autoComplete="name" />
          <label htmlFor="nf-email">Email</label>
          <input id="nf-email" name="email" type="email" autoComplete="email" />
          <label htmlFor="nf-topic">About</label>
          <input id="nf-topic" name="topic" placeholder="Kids, adults, trips, tournaments…" />
          <label htmlFor="nf-message">Message</label>
          <textarea id="nf-message" name="message" />
          <button type="submit" className="nf-pill border-0 cursor-pointer">Show send (visual only)</button>
        </form>
        <div>
          <article className="nf-card nf-shot" style={{ marginBottom: 16 }}>
            <img alt="AGC on court" src={PHOTO} />
            <div className="nf-shot-body">
              <h3>Visit</h3>
              <p>Riedstrasse 6, 6330 Cham, Switzerland</p>
              <p className="mt-3">+41 79 799 04 58</p>
              <p>info@agc-padelacademy.com</p>
              <p className="mt-3">
                <a href="https://www.instagram.com/agc.padelacademy/" target="_blank" rel="noopener noreferrer">Instagram</a>
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
    </>
  );
};

export default NewContactPage;
