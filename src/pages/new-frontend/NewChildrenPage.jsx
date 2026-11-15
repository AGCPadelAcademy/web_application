import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import ChildAvatar from '@/components/children/ChildAvatar';
import ChildForm from '@/components/children/ChildForm';
import { createChild, listChildren, removeChild, uploadChildAvatar } from '@/lib/children';
import NewMasthead from './NewMasthead';
import NewDialog from './NewDialog';
import { safeNewPath } from './newPaths';

const NewChildrenPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return_to');
  const safeReturnTo = returnTo ? safeNewPath(returnTo, '') : '';
  const [children, setChildren] = useState([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const refresh = async () => {
    setChildren(await listChildren());
  };

  useEffect(() => {
    if (!user) return;
    refresh().catch((error) => toast({ title: 'Could not load children', description: error.message, variant: 'destructive' }));
  }, [user, toast]);

  const handleCreate = async (values, avatarFile) => {
    setSaving(true);
    try {
      const created = await createChild(values, user.id);
      if (avatarFile) {
        try {
          await uploadChildAvatar(created.id, user.id, avatarFile);
        } catch (error) {
          toast({ title: 'Child saved, image failed', description: error.message, variant: 'destructive' });
        }
      }
      toast({ title: 'Child saved' });
      if (safeReturnTo) {
        const joiner = safeReturnTo.includes('?') ? '&' : '?';
        navigate(`${safeReturnTo}${joiner}select_child=${created.id}`);
        return;
      }
      await refresh();
    } catch (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await removeChild(removing.id);
      toast({ title: 'Child removed' });
      setRemoving(null);
      await refresh();
    } catch (error) {
      toast({ title: 'Cannot remove child', description: error.message, variant: 'destructive' });
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>My Children - AGC Padel Academy</title>
      </Helmet>
      <NewMasthead title="My Children" lead="Save a child before registering them for a camp." />
      <section className="nf-page nf-skin">
        <article className="nf-card">
          <h3>Add a child</h3>
          {safeReturnTo && <p className="nf-lead">Save the child and we will take you straight back to the registration.</p>}
          <ChildForm mode="create" submitting={saving} onSubmit={handleCreate} />
        </article>
        <div className="nf-grid nf-grid-2" style={{ marginTop: 24 }}>
          {children.map((child) => (
            <article key={child.id} className="nf-card nf-child-row">
              <Link to={`/new/children/${child.id}`} className="nf-child-link">
                <ChildAvatar child={child} />
                <span>
                  <strong>{child.first_name} {child.last_name}</strong>
                  <small>{child.date_of_birth || 'No date of birth'} · {child.padel_level || 'No level set'}</small>
                </span>
              </Link>
              <div className="nf-row">
                <Link to={`/new/children/${child.id}`} className="nf-pill is-quiet">Edit</Link>
                <button type="button" className="nf-text-btn" onClick={() => setRemoving(child)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
        {children.length === 0 && <p className="nf-lead">No children yet. Add your first child above.</p>}
      </section>
      <NewDialog open={Boolean(removing)} title={`Remove ${removing?.first_name || 'child'}?`} onClose={() => !removeBusy && setRemoving(null)}>
        <p>This permanently removes the child and cannot be undone. Children with camp registrations or invoices cannot be removed — their history is kept.</p>
        {removing && (
          <p><strong>{removing.first_name} {removing.last_name}</strong><br />{[removing.date_of_birth, removing.padel_level].filter(Boolean).join(' · ')}</p>
        )}
        <div className="nf-row">
          <button type="button" className="nf-pill is-quiet" disabled={removeBusy} onClick={() => setRemoving(null)}>Keep child</button>
          <button type="button" className="nf-pill border-0" disabled={removeBusy} onClick={confirmRemove}>{removeBusy ? 'Removing…' : 'Remove child'}</button>
        </div>
      </NewDialog>
    </>
  );
};

export default NewChildrenPage;
