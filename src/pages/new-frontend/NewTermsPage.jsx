const NewTermsPage = () => (
  <section className="nf-page">
    <p className="nf-kicker">Legal</p>
    <h1 className="nf-title">Terms, restyled.</h1>
    <p className="nf-lead">Headings from the live Terms page, laid out in the new shell. This is a reading layout, not a legal rewrite.</p>
    <div className="nf-grid" style={{ maxWidth: 760 }}>
      <article className="nf-card">
        <h3>General conditions</h3>
        <p>Memberships, invoices, and denial of service follow the academy’s published terms. Adults pay from invoices issued by CAG Padel Academy GmbH.</p>
      </article>
      <article className="nf-card">
        <h3>Cancellation</h3>
        <p>Adult monthly memberships are not refundable. Notice is required 30 days before the following month. Missed sessions may become credit with 48 hours’ notice or a medical certificate — never cash.</p>
      </article>
      <article className="nf-card">
        <h3>Liability</h3>
        <p>The academy is not responsible for injuries except in cases of proven gross negligence. Personal insurance is recommended.</p>
      </article>
    </div>
  </section>
);

export default NewTermsPage;
