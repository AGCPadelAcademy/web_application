import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import InvoicePreviewModal from '@/components/modals/InvoicePreviewModal.jsx';
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
import { fetchCampInvoicePdfBlob } from '@/lib/billing';

const ChildProfilePage = () => {
  const { childId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [child, setChild] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

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
      const updated = await updateChild(childId, values);
      setChild(updated);
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
      const updated = await uploadChildAvatar(childId, user.id, file);
      setChild(updated);
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
      const updated = await removeChildAvatar(child);
      setChild(updated);
      toast({ title: 'Profile image removed' });
    } catch (error) {
      toast({ title: 'Could not remove image', description: error.message, variant: 'destructive' });
    } finally {
      setAvatarBusy(false);
    }
  };

  const openInvoice = async (registrationId) => {
    try {
      const url = await fetchCampInvoicePdfBlob(registrationId);
      setInvoiceUrl(url);
      setInvoiceOpen(true);
    } catch (error) {
      toast({ title: 'Invoice unavailable', description: error.message, variant: 'destructive' });
    }
  };

  if (notFound) {
    return (
      <div className="px-6 py-24 text-center max-w-xl mx-auto">
        <p className="text-red-400 mb-4">This child does not exist or is not yours.</p>
        <Link to="/children" className="text-sm text-green-400">← My children</Link>
      </div>
    );
  }

  if (!child) {
    return <div className="px-6 py-24 text-center text-gray-400">Loading child…</div>;
  }

  return (
    <>
      <Helmet>
        <title>{child.first_name} {child.last_name} - My Children</title>
      </Helmet>
      <div className="px-6 py-12 md:py-24 max-w-2xl mx-auto w-full">
        <Link to="/children" className="text-sm text-green-400">← My children</Link>
        <h1 className="text-3xl font-bold font-serif mt-4 mb-8 text-center">Child profile</h1>

        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <ChildAvatar child={child} size="lg" />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700"
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {child.avatar_path ? 'Replace image' : 'Add image'}
              </Button>
              {child.avatar_path && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-300"
                  disabled={avatarBusy}
                  onClick={handleAvatarRemove}
                >
                  Remove image
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleAvatarReplace(e.target.files?.[0] ?? null)}
            />
            {avatarBusy && <Loader2 className="w-4 h-4 animate-spin text-green-500" />}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-center">Personal information</CardTitle>
          </CardHeader>
          <CardContent>
            <ChildForm
              mode="edit"
              initial={child}
              submitting={saving}
              submitLabel="Save changes"
              onSubmit={handleSave}
            />
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-center">Camp invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invoices.length === 0 && <p className="text-gray-500 text-center">No camp invoices yet.</p>}
            {invoices.map((reg) => {
              const unpaid = reg.status === 'pending_payment' && reg.payment_status !== 'confirmed';
              return (
                <div key={reg.id} className="flex items-center justify-between border border-gray-800 rounded-lg px-3 py-2">
                  <div>
                    <p>{reg.camp_name}</p>
                    <p className="text-gray-500">{reg.payment_status} · {reg.total_amount} {reg.currency}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-green-500 text-black" onClick={() => openInvoice(reg.id)}>Invoice</Button>
                    {unpaid && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-700 text-red-300"
                        onClick={async () => {
                          try {
                            await cancelCampRegistration(reg.id);
                            setInvoices(await listChildCampInvoices(childId));
                            toast({ title: 'Registration cancelled' });
                          } catch (error) {
                            toast({ title: 'Cancel failed', description: mapCampError(error.message), variant: 'destructive' });
                          }
                        }}
                      >
                        Cancel registration
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <InvoicePreviewModal
        isOpen={invoiceOpen}
        onClose={() => { setInvoiceOpen(false); if (invoiceUrl) URL.revokeObjectURL(invoiceUrl); setInvoiceUrl(null); }}
        invoiceUrl={invoiceUrl}
      />
    </>
  );
};

export default ChildProfilePage;
