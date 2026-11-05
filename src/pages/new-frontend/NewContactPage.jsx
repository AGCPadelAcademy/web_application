const NewContactPage = () => {
  const onSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <section className="nf-page">
      <p className="nf-kicker">Contact</p>
      <h1 className="nf-title">Write to the academy.</h1>
      <p className="nf-lead">This form is a visual replica. It does not send mail or call the backend. Use the main site Contact page when you need a real message to go through.</p>
      <div className="nf-grid nf-grid-2">
        <form className="nf-card nf-form" onSubmit={onSubmit}>
          <label htmlFor="nf-name">Name</label>
          <input id="nf-name" name="name" autoComplete="name" />
          <label htmlFor="nf-email">Email</label>
          <input id="nf-email" name="email" type="email" autoComplete="email" />
          <label htmlFor="nf-message">Message</label>
          <textarea id="nf-message" name="message" />
          <button type="submit" className="nf-pill border-0 cursor-pointer">Show send (visual only)</button>
        </form>
        <article className="nf-card">
          <h3>Visit</h3>
          <p>Riedstrasse 6, 6330 Cham, Switzerland</p>
          <p className="mt-4">+41 79 799 04 58</p>
          <p>info@agc-padelacademy.com</p>
        </article>
      </div>
    </section>
  );
};

export default NewContactPage;
