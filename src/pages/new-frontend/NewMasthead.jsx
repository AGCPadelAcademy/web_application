const NewMasthead = ({ kicker, title, lead }) => {
  const line = `${title}  `;

  return (
    <header className="nf-mast">
      <p className="nf-mast-kicker">{kicker}</p>
      <h1 className="nf-mast-title" aria-label={title}>
        <span>
          <span aria-hidden="true">{line}</span>
          <span aria-hidden="true">{line}</span>
          <span aria-hidden="true">{line}</span>
          <span aria-hidden="true">{line}</span>
        </span>
      </h1>
      {lead ? <p className="nf-mast-lead">{lead}</p> : null}
    </header>
  );
};

export default NewMasthead;
