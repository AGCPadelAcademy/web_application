const NewMasthead = ({ title, lead }) => (
  <header className="nf-mast">
    <h1 className="nf-mast-title">{title}</h1>
    {lead ? <p className="nf-mast-lead">{lead}</p> : null}
  </header>
);

export default NewMasthead;
