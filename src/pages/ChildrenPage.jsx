import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import InvoicePreviewModal from '@/components/modals/InvoicePreviewModal.jsx';
import { archiveChild, createChild, listChildCampInvoices, listChildren, updateChild } from '@/lib/children';
import { cancelCampRegistration, mapCampError } from '@/lib/camps';
import { fetchCampInvoicePdfBlob } from '@/lib/billing';

const emptyForm = {
  first_name: '',
  last_name: '',
  date_of_birth: '',
  padel_level: '',
  allergies: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

const ChildrenPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [children, setChildren] = useState([]);
  const [invoices, setInvoices] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const refresh = async () => {
    const rows = await listChildren();
    setChildren(rows);
    const byChild = {};
    await Promise.all(rows.map(async (child) => {
      byChild[child.id] = await listChildCampInvoices(child.id);
    }));
    setInvoices(byChild);
  };

  useEffect(() => {
    if (!user) return;
    refresh().catch((error) => toast({ title: 'Could not load children', description: error.message, variant: 'destructive' }));
  }, [user]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingId) await updateChild(editingId, form);
      else await createChild(form, user.id);
      setForm(emptyForm);
      setEditingId(null);
      await refresh();
      toast({ title: 'Child saved' });
    } catch (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
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

  return (
    <>
      <Helmet>
        <title>My Children - AGC Padel Academy</title>
      </Helmet>
      <div className="px-6 py-12 md:py-24 max-w-5xl mx-auto w-full">
        <h1 className="text-3xl font-bold font-serif mb-6">My Children</h1>
        <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>{editingId ? 'Edit child' : 'Add a child'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={save} className="space-y-3">
                {['first_name', 'last_name', 'date_of_birth', 'padel_level', 'allergies', 'emergency_contact_name', 'emergency_contact_phone'].map((field) => (
                  <div key={field}>
                    <Label htmlFor={field}>{field.replaceAll('_', ' ')}</Label>
                    <Input
                      id={field}
                      type={field === 'date_of_birth' ? 'date' : 'text'}
                      value={form[field]}
                      onChange={(e) => setForm((c) => ({ ...c, [field]: e.target.value }))}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                  </div>
                ))}
                <Button type="submit" disabled={saving} className="bg-green-500 text-black font-bold w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {children.map((child) => (
              <Card key={child.id} className="bg-gray-900 border-gray-800">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle>{child.first_name} {child.last_name}</CardTitle>
                    <p className="text-sm text-gray-400">{child.date_of_birth || 'No date of birth'} · {child.padel_level || 'No level set'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-gray-700" onClick={() => { setEditingId(child.id); setForm({ ...emptyForm, ...child, date_of_birth: child.date_of_birth || '' }); }}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={async () => { await archiveChild(child.id); await refresh(); }}>Archive</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {(invoices[child.id] || []).length === 0 && <p className="text-gray-500">No camp invoices yet.</p>}
                  {(invoices[child.id] || []).map((reg) => {
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
                                  await refresh();
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
            ))}
          </div>
        </div>
      </div>
      <InvoicePreviewModal
        isOpen={invoiceOpen}
        onClose={() => { setInvoiceOpen(false); if (invoiceUrl) URL.revokeObjectURL(invoiceUrl); setInvoiceUrl(null); }}
        invoiceUrl={invoiceUrl}
      />
    </>
  );
};

export default ChildrenPage;
