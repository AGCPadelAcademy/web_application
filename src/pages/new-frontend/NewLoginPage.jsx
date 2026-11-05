import { Link } from 'react-router-dom';

const NewLoginPage = () => {
  const onSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <section className="nf-page">
      <p className="nf-kicker">Account</p>
      <h1 className="nf-title">Login, as a concept.</h1>
      <p className="nf-lead">Looks like the academy login. It does not authenticate. Use the main Login page for a real session.</p>
      <div className="nf-grid nf-grid-2">
        <form className="nf-card nf-form" onSubmit={onSubmit}>
          <h3>Sign in</h3>
          <label htmlFor="nf-login-email">Email</label>
          <input id="nf-login-email" type="email" autoComplete="email" />
          <label htmlFor="nf-login-password">Password</label>
          <input id="nf-login-password" type="password" autoComplete="current-password" />
          <button type="submit" className="nf-pill border-0 cursor-pointer">Enter (visual)</button>
        </form>
        <article className="nf-card">
          <h3>Need an account?</h3>
          <p>Registration still lives on the main frontend. This concept keeps the door visible without wiring auth.</p>
          <Link to="/new/contact" className="nf-pill">Talk to the academy</Link>
        </article>
      </div>
    </section>
  );
};

export default NewLoginPage;
