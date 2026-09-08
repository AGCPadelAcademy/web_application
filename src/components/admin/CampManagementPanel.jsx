import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  convertWaitlistEntry,
  exportCampRegistrations,
  listAdminCamps,
  listCampRegistrations,
  listCampWaitlist,
  mapCampError,
  removeCampExtra,
  serializeRegistrationsCsv,
  upsertCamp,
  upsertCampExtra,
} from '@/lib/camps';

const emptyCamp = {
  name: '',
  slug: '',
  description: '',
  start_date: '',
  end_date: '',
  daily_start_time: '',
  daily_end_time: '',
  schedule_text: '',
  min_age: '',
  max_age: '',
  eligibility_text: '',
  price_amount: '',
  max_capacity: '',
  registration_opens_at: '',
  registration_deadline_at: '',
  is_published: false,
  waitlist_enabled: false,
  practical_info: '',
};

const emptyExtra = { name: '', description: '', price_amount: '', sort_order: 0, is_active: true };

const CampManagementPanel = () => {
  const { toast } = useToast();
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyCamp);
  const [extraForm, setExtraForm] = useState(emptyExtra);
  const [registrations, setRegistrations] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [remaining, setRemaining] = useState(null);

  const selected = useMemo(
    () => camps.find((camp) => camp.id === selectedId) || null,
    [camps, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAdminCamps();
      setCamps(result.camps || []);
    } catch (error) {
      toast({ title: 'Could not load camps', description: mapCampError(error.message), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const chooseCamp = (camp) => {
    setSelectedId(camp.id);
    setForm({
      ...emptyCamp,
      ...camp,
      min_age: camp.min_age ?? '',
      max_age: camp.max_age ?? '',
      price_amount: camp.price_amount ?? '',
      max_capacity: camp.max_capacity ?? '',
      daily_start_time: camp.daily_start_time ?? '',
      daily_end_time: camp.daily_end_time ?? '',
      registration_opens_at: camp.registration_opens_at ? String(camp.registration_opens_at).slice(0, 16) : '',
      registration_deadline_at: camp.registration_deadline_at ? String(camp.registration_deadline_at).slice(0, 16) : '',
    });
  };

  const saveCamp = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        id: selectedId || undefined,
        min_age: form.min_age === '' ? null : Number(form.min_age),
        max_age: form.max_age === '' ? null : Number(form.max_age),
        price_amount: Number(form.price_amount),
        max_capacity: Number(form.max_capacity),
        registration_opens_at: form.registration_opens_at || null,
        registration_deadline_at: form.registration_deadline_at || null,
      };
      await upsertCamp(payload);
      toast({ title: 'Camp saved' });
      await load();
    } catch (error) {
      toast({ title: 'Save failed', description: mapCampError(error.message), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveExtra = async (event) => {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    try {
      await upsertCampExtra(selectedId, {
        ...extraForm,
        price_amount: Number(extraForm.price_amount),
        sort_order: Number(extraForm.sort_order) || 0,
      });
      setExtraForm(emptyExtra);
      toast({ title: 'Extra saved' });
      await load();
    } catch (error) {
      toast({ title: 'Extra failed', description: mapCampError(error.message), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const loadOps = async () => {
    if (!selectedId) return;
    try {
      const [regs, wait] = await Promise.all([
        listCampRegistrations(selectedId),
        listCampWaitlist(selectedId),
      ]);
      setRegistrations(regs.registrations || []);
      setRemaining(regs.remaining_places);
      setWaitlist(wait.entries || []);
    } catch (error) {
      toast({ title: 'Could not load registrations', description: mapCampError(error.message), variant: 'destructive' });
    }
  };

  const downloadCsv = async () => {
    if (!selectedId) return;
    try {
      const result = await exportCampRegistrations(selectedId);
      const csv = serializeRegistrationsCsv(result.registrations || []);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${form.slug || 'camp'}-registrations.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Export failed', description: mapCampError(error.message), variant: 'destructive' });
    }
  };

  const field = (name, label, type = 'text') => (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type={type}
        value={form[name] ?? ''}
        onChange={(e) => setForm((current) => ({ ...current, [name]: e.target.value }))}
        className="bg-gray-950 border-gray-700 text-white"
      />
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle>Camps</CardTitle>
          <CardDescription>Create, publish, and reuse camp configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full border-gray-700"
            onClick={() => { setSelectedId(null); setForm(emptyCamp); }}
          >
            <Plus className="w-4 h-4 mr-2" /> New camp
          </Button>
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-green-500" /> : camps.map((camp) => (
            <button
              key={camp.id}
              type="button"
              onClick={() => chooseCamp(camp)}
              className={`w-full text-left rounded-lg border px-3 py-2 ${selectedId === camp.id ? 'border-green-500 bg-green-500/10' : 'border-gray-800'}`}
            >
              <p className="font-medium text-white">{camp.name}</p>
              <p className="text-xs text-gray-400">{camp.start_date} → {camp.end_date} {camp.is_published ? '· published' : '· draft'}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList className="bg-gray-900 border border-gray-800 mb-4">
          <TabsTrigger value="edit">Camp</TabsTrigger>
          <TabsTrigger value="registrations" onClick={loadOps}>Registrations</TabsTrigger>
          <TabsTrigger value="waitlist" onClick={loadOps}>Waitlist</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>{selected ? 'Edit camp' : 'Create camp'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveCamp} className="grid gap-4 md:grid-cols-2">
                {field('name', 'Name')}
                {field('slug', 'Slug')}
                {field('start_date', 'Start date', 'date')}
                {field('end_date', 'End date', 'date')}
                {field('daily_start_time', 'Daily start', 'time')}
                {field('daily_end_time', 'Daily end', 'time')}
                {field('min_age', 'Min age', 'number')}
                {field('max_age', 'Max age', 'number')}
                {field('price_amount', 'Price (CHF)', 'number')}
                {field('max_capacity', 'Capacity', 'number')}
                {field('registration_opens_at', 'Registration opens', 'datetime-local')}
                {field('registration_deadline_at', 'Registration deadline', 'datetime-local')}
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="description">Description</Label>
                  <textarea id="description" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} className="w-full min-h-[80px] rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="schedule_text">Schedule notes</Label>
                  <Input id="schedule_text" value={form.schedule_text} onChange={(e) => setForm((c) => ({ ...c, schedule_text: e.target.value }))} className="bg-gray-950 border-gray-700 text-white" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="eligibility_text">Eligibility</Label>
                  <Input id="eligibility_text" value={form.eligibility_text} onChange={(e) => setForm((c) => ({ ...c, eligibility_text: e.target.value }))} className="bg-gray-950 border-gray-700 text-white" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="practical_info">Practical info (confirmation email)</Label>
                  <textarea id="practical_info" value={form.practical_info} onChange={(e) => setForm((c) => ({ ...c, practical_info: e.target.value }))} className="w-full min-h-[80px] rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((c) => ({ ...c, is_published: e.target.checked }))} />
                  Published
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.waitlist_enabled} onChange={(e) => setForm((c) => ({ ...c, waitlist_enabled: e.target.checked }))} />
                  Waitlist enabled
                </label>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={saving} className="bg-green-500 hover:bg-green-600 text-black font-bold">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save camp'}
                  </Button>
                </div>
              </form>

              {selected && (
                <div className="mt-8 border-t border-gray-800 pt-6">
                  <h3 className="font-semibold mb-3">Extras</h3>
                  <ul className="space-y-2 mb-4">
                    {(selected.extras || []).map((extra) => (
                      <li key={extra.id} className="flex items-center justify-between text-sm border border-gray-800 rounded-lg px-3 py-2">
                        <span>{extra.name} · {extra.price_amount} CHF {extra.is_active ? '' : '(inactive)'}</span>
                        <Button variant="ghost" size="sm" onClick={async () => { await removeCampExtra(extra.id); await load(); }}>Remove</Button>
                      </li>
                    ))}
                  </ul>
                  <form onSubmit={saveExtra} className="grid gap-3 md:grid-cols-4">
                    <Input placeholder="Name" value={extraForm.name} onChange={(e) => setExtraForm((c) => ({ ...c, name: e.target.value }))} className="bg-gray-950 border-gray-700" />
                    <Input placeholder="Price" type="number" value={extraForm.price_amount} onChange={(e) => setExtraForm((c) => ({ ...c, price_amount: e.target.value }))} className="bg-gray-950 border-gray-700" />
                    <Input placeholder="Description" value={extraForm.description} onChange={(e) => setExtraForm((c) => ({ ...c, description: e.target.value }))} className="bg-gray-950 border-gray-700" />
                    <Button type="submit" disabled={saving} className="bg-green-500 text-black">Add extra</Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registrations">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Registrations</CardTitle>
                <CardDescription>Remaining places: {remaining ?? '—'}</CardDescription>
              </div>
              <Button onClick={downloadCsv} disabled={!selectedId} className="bg-green-500 text-black">Download CSV</Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr>
                    <th className="text-left py-2">Child</th>
                    <th className="text-left">Parent</th>
                    <th className="text-left">Total</th>
                    <th className="text-left">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((row) => (
                    <tr key={row.registration_id} className="border-t border-gray-800">
                      <td className="py-2">{row.child_first_name} {row.child_last_name}</td>
                      <td>{row.parent_full_name}<br /><span className="text-gray-500">{row.parent_email}</span></td>
                      <td>{row.total_amount} {row.currency}</td>
                      <td>{row.payment_status === 'confirmed' ? 'Paid' : 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waitlist">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>Waitlist</CardTitle>
              <CardDescription>Oldest entry first. Conversion revalidates capacity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {waitlist.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between border border-gray-800 rounded-lg px-3 py-2">
                  <div className="text-sm">
                    <p>{entry.status} · {new Date(entry.created_at).toLocaleString()}</p>
                    <p className="text-gray-500">Child {entry.child_id}</p>
                  </div>
                  {entry.status === 'active' && (
                    <Button
                      size="sm"
                      className="bg-green-500 text-black"
                      onClick={async () => {
                        try {
                          await convertWaitlistEntry(entry.id);
                          toast({ title: 'Waitlist converted' });
                          await loadOps();
                        } catch (error) {
                          toast({ title: 'Conversion failed', description: mapCampError(error.message), variant: 'destructive' });
                        }
                      }}
                    >
                      Convert
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CampManagementPanel;
