import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import ChildAvatar from '@/components/children/ChildAvatar';
import ChildForm from '@/components/children/ChildForm';
import {
  getChild,
  listChildCampInvoices,
  removeChildAvatar,
  updateChild,
  uploadChildAvatar,
} from '@/lib/children';
import { cancelCampRegistration, mapCampError } from '@/lib/camps';
import NewMasthead from './NewMasthead';
import NewInvoiceDialog from './NewInvoiceDialog';

const NewChildProfilePage = () => {
  const { childId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [child, setChild] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [invoiceId, setInvoiceId] = useState(null);

  const load = async () => {
    const row = await getChild(childId);
    if (!row) {
      setNotFound(true);
      return;
    }
    setChild(row);
    setInvoices(await listChildCampInvoices(childId));
  };

  useEffect(() => {
    if (!user) return;
    load().catch((error) => toast({ title: 'Could not load child', description: error.message, variant: 'destructive' }));
  }, [user, childId]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      setChild(await updateChild(childId, values));
      toast({ title: 'Child updated' });
    } catch (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarReplace = async (file) => {
    if (!file) return;
    setAvatarBusy(true);
    try {
      setChild(await uploadChildAvatar(childId, user.id, file));
      toast({ title: 'Profile image updated' });
    } catch (error) {
      toast({ title: 'Image upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarBusy(true);
    try {
      setChild(await removeChildAvatar(child));
      toast({ title: 'Profile image removed' });
    } catch (error) {
      toast({ title: 'Could not remove image', description: error.message, variant: 'destructive' });
    } finally {
      setAvatarBusy(false);
    }
  };

  if (notFound) {
    return (
      <section className="nf-page">
        <p className="nf-error">This child does not exist or is not yours.</p>
        <Link to="/new/children" className="nf-back">My children</Link>
      </section>
    );
  }

  if (!child) {
    return <p className="nf-lead" style={{ padding: '48px 8%' }}>Loading child…</p>;
  }

  return (
    <>
      <Helmet>
        <title>{child.first_name} {child.last_name} - My Children</title>
      </Helmet>
      <NewMasthead title={`${child.first_name} ${child.last_name}`} lead="Personal information and camp invoices." />
      <section className="nf-page nf-skin">
        <Link to="/new/children" className="nf-back">My children</Link>
        <article className="nf-card nf-child-row">
          <ChildAvatar child={child} size="lg" />
          <div className="nf-row">
            <button type="button" className="nf-pill is-quiet border-0" disabled={avatarBusy} onClick={() => fileInputRef.current?.click()}>
              {child.avatar_path ? 'Replace image' : 'Add image'}
            </button>
            {child.avatar_path && (
              <button type="button" className="nf-text-btn" disabled={avatarBusy} onClick={handleAvatarRemove}>Remove image</button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => handleAvatarReplace(event.target.files?.[0] ?? null)}
          />
        </article>
        <article className="nf-card">
          <h3>Personal information</h3>
          <ChildForm mode="edit" initial={child} submitting={saving} submitLabel="Save changes" onSubmit={handleSave} />
        </article>
        <article className="nf-card">
          <h3>Camp invoices</h3>
          {invoices.length === 0 && <p className="nf-lead">No camp invoices yet.</p>}
          {invoices.map((registration) => {
            const unpaid = registration.status === 'pending_payment' && registration.payment_status !== 'confirmed';
            return (
              <div key={registration.id} className="nf-pay-row">
                <div>
                  <strong>{registration.camp_name}</strong>
                  <p>{registration.payment_status} · {registration.total_amount} {registration.currency}</p>
                </div>
                <div className="nf-row">
                  <button type="button" className="nf-pill border-0" onClick={() => setInvoiceId(registration.id)}>Invoice</button>
                  {unpaid && (
                    <button
                      type="button"
                      className="nf-text-btn"
                      onClick={async () => {
                        try {
                          await cancelCampRegistration(registration.id);
                          setInvoices(await listChildCampInvoices(childId));
                          toast({ title: 'Registration cancelled' });
                        } catch (error) {
                          toast({ title: 'Cancel failed', description: mapCampError(error.message), variant: 'destructive' });
                        }
                      }}
                    >
                      Cancel registration
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </article>
      </section>
      <NewInvoiceDialog open={Boolean(invoiceId)} campRegistrationId={invoiceId} onClose={() => setInvoiceId(null)} />
    </>
  );
};

export default NewChildProfilePage;
