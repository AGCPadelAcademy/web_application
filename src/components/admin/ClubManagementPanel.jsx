import { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createClub,
  listClubs,
  listClubsForNewUse,
  setClubActive,
  updateClub,
} from '@/lib/clubs';

const emptyForm = { name: '', location: '', phone: '', email: '' };

function toForm(club) {
  return {
    name: club?.name || '',
    location: club?.location || '',
    phone: club?.phone || '',
    email: club?.email || '',
  };
}

const ClubManagementPanel = () => {
  const { toast } = useToast();
  const [clubs, setClubs] = useState([]);
  const [forNewUse, setForNewUse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catalogue, selectable] = await Promise.all([listClubs(), listClubsForNewUse()]);
      setClubs(catalogue);
      setForNewUse(selectable);
    } catch (loadError) {
      setError(loadError.message || 'Could not load clubs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = clubs.find((club) => club.id === selectedId) || null;

  const chooseClub = (club) => {
    setSelectedId(club.id);
    setForm(toForm(club));
  };

  const startCreate = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = selected
        ? await updateClub(selected.id, form)
        : await createClub(form);
      toast({ title: selected ? 'Club updated' : 'Club created' });
      setSelectedId(saved.id);
      setForm(toForm(saved));
      await load();
    } catch (saveError) {
      toast({ title: 'Could not save club', description: saveError.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const saved = await setClubActive(selected.id, !selected.is_active);
      toast({ title: saved.is_active ? 'Club activated' : 'Club deactivated' });
      setForm(toForm(saved));
      await load();
    } catch (saveError) {
      toast({ title: 'Could not change club status', description: saveError.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="grid gap-6">
        <Card className="bg-gray-900 border-gray-800 text-white">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><MapPin className="text-green-500" /> Clubs</CardTitle>
              <CardDescription className="text-gray-400">Every location, including inactive ones.</CardDescription>
            </div>
            <Button type="button" onClick={startCreate} className="bg-green-500 text-black hover:bg-green-400">
              New club
            </Button>
          </CardHeader>
          <CardContent>
            {loading && <p className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading clubs…</p>}
            {!loading && error && <p className="text-red-400">{error}</p>}
            {!loading && !error && clubs.length === 0 && (
              <p className="text-gray-400">No clubs yet. Create the first location.</p>
            )}
            <ul className="grid gap-2">
              {clubs.map((club) => (
                <li key={club.id}>
                  <button
                    type="button"
                    onClick={() => chooseClub(club)}
                    className={`w-full rounded-lg border px-4 py-3 text-left ${selectedId === club.id ? 'border-green-500 bg-gray-800' : 'border-gray-800 hover:border-gray-600'}`}
                  >
                    <span className="block font-medium">{club.name}</span>
                    <span className="block text-sm text-gray-400">{club.location || 'No place recorded'}</span>
                    <span className={`text-xs ${club.is_active ? 'text-green-400' : 'text-amber-300'}`}>
                      {club.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800 text-white">
          <CardHeader>
            <CardTitle>Available for new use</CardTitle>
            <CardDescription className="text-gray-400">Active clubs only. Inactive clubs stay in the catalogue above.</CardDescription>
          </CardHeader>
          <CardContent>
            {!loading && forNewUse.length === 0 && <p className="text-gray-400">No active club is available for a new use.</p>}
            <ul className="grid gap-2">
              {forNewUse.map((club) => (
                <li key={club.id} className="rounded-lg border border-gray-800 px-4 py-3">
                  <span className="block font-medium">{club.name}</span>
                  <span className="block text-sm text-gray-400">{club.location || 'No place recorded'}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
          <CardTitle>{selected ? 'Edit club' : 'Create club'}</CardTitle>
          <CardDescription className="text-gray-400">
            {selected
              ? 'The same club keeps its identity when you correct its details or change its status.'
              : 'A new club starts active. Name is required.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={save}>
            <div className="grid gap-2">
              <Label htmlFor="club-name">Name</Label>
              <Input id="club-name" value={form.name} maxLength={120} onChange={(event) => setForm({ ...form, name: event.target.value })} className="bg-gray-950 border-gray-700" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="club-location">Place</Label>
              <Input id="club-location" value={form.location} maxLength={500} onChange={(event) => setForm({ ...form, location: event.target.value })} className="bg-gray-950 border-gray-700" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="club-phone">Phone</Label>
              <Input id="club-phone" value={form.phone} maxLength={40} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="bg-gray-950 border-gray-700" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="club-email">Email</Label>
              <Input id="club-email" type="email" value={form.email} maxLength={254} onChange={(event) => setForm({ ...form, email: event.target.value })} className="bg-gray-950 border-gray-700" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving} className="bg-green-500 text-black hover:bg-green-400">
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {selected && (
                <Button type="button" variant="outline" disabled={saving} onClick={toggleActive}>
                  {selected.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClubManagementPanel;
