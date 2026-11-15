const NewDialog = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="nf-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="nf-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="nf-modal-card">
        {title ? <h3>{title}</h3> : null}
        {children}
      </div>
    </div>
  );
};

export default NewDialog;
