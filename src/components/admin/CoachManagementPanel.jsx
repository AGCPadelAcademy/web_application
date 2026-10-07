import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CountrySelect from '@/components/profile/CountrySelect';
import { profileToFormData } from '@/lib/profileService';
import {
  listClients,
  updateClientPersonalFields,
  updateClientRole,
  updateClientStatus,
} from '@/lib/clientManagement';

const selectClass = 'h-10 rounded-md border border-gray-700 bg-gray-950 px-3 text-sm text-white';
const PROMOTE_ROLES = ['student', 'admin'];

const CoachManagementPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coaches, setCoaches] = useState([]);
  const [count, setCount] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [promoteSearch, setPromoteSearch] = useState('');
  const [promoteRole, setPromoteRole] = useState('student');
  const [promoteResults, setPromoteResults] = useState([]);
  const [promoteLoading, setPromoteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listClients({ search, role: 'coach', status, page });
      setCoaches(result.clients);
      setCount(result.count);
      setPageSize(result.pageSize);
      if (selected) {
        const refreshed = result.clients.find((coach) => coach.id === selected.id);
        if (refreshed) {
          setSelected(refreshed);
          setForm(profileToFormData(refreshed));
        }
      }
    } catch (loadError) {
      setError(loadError.message || 'Could not load coaches.');
    } finally {
      setLoading(false);
    }
  }, [page, search, selected?.id, status]);

  useEffect(() => {
    load();
  }, [load]);

  const chooseCoach = (coach) => {
    setSelected(coach);
    setForm(profileToFormData(coach));
  };

  const applyUpdate = async (operation, successMessage) => {
    setSaving(true);
    try {
      const updated = await operation();
      if (updated.role === 'coach') {
        setSelected(updated);
        setForm(profileToFormData(updated));
        setCoaches((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      }
      toast({ title: successMessage });
      await load();
    } catch (saveError) {
      toast({ title: 'Update failed', description: saveError.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const searchPeople = async (event) => {
    event.preventDefault();
    setPromoteLoading(true);
    try {
      const result = await listClients({
        search: promoteSearch,
        role: promoteRole,
        status: 'all',
        page: 1,
        pageSize: 10,
      });
      setPromoteResults(result.clients);
    } catch (searchError) {
      toast({ title: 'Search failed', description: searchError.message, variant: 'destructive' });
    } finally {
      setPromoteLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const isSelf = selected?.id === user?.id;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <div className="space-y-6">
        <Card className="bg-gray-900 border-gray-800 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="text-green-500" /> Coaches</CardTitle>
            <CardDescription className="text-gray-400">Existing coach profiles. No account migration is required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setSearch(searchInput);
              }}
            >
              <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Name or email" className="bg-gray-950 border-gray-700" />
              <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={selectClass}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button type="submit" className="bg-green-500 text-black hover:bg-green-400"><Search className="mr-2 h-4 w-4" /> Search</Button>
            </form>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-green-500" /></div>
            ) : error ? (
              <p className="py-8 text-red-400">{error}</p>
            ) : coaches.length === 0 ? (
              <p className="py-8 text-center text-gray-400">No coaches match these filters.</p>
            ) : (
              <div className="space-y-2">
                {coaches.map((coach) => (
                  <button
                    type="button"
                    key={coach.id}
                    onClick={() => chooseCoach(coach)}
                    className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === coach.id ? 'border-green-500 bg-green-500/10' : 'border-gray-800 bg-gray-950 hover:border-gray-700'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{coach.full_name || 'Unnamed coach'}</span>
                      <span className={`rounded-full px-2 py-1 text-xs ${coach.is_active ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>
                        {coach.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">{coach.email || 'No email'}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
              <span>{count} coaches</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                <span>{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="text-green-500" /> Make an existing person a coach</CardTitle>
            <CardDescription className="text-gray-400">Uses their current login. This does not send an invite or create a password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={searchPeople}>
              <Input value={promoteSearch} onChange={(event) => setPromoteSearch(event.target.value)} placeholder="Name or email" className="bg-gray-950 border-gray-700" />
              <select aria-label="Role to search" value={promoteRole} onChange={(event) => setPromoteRole(event.target.value)} className={selectClass}>
                {PROMOTE_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <Button type="submit" variant="outline" disabled={promoteLoading}>Search</Button>
            </form>
            {promoteLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-green-500" /></div>
            ) : promoteResults.length === 0 ? (
              <p className="text-sm text-gray-400">Search for a student or admin to promote.</p>
            ) : (
              <div className="space-y-2">
                {promoteResults.map((person) => (
                  <div key={person.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
                    <div>
                      <p className="font-medium">{person.full_name || 'Unnamed person'}</p>
                      <p className="text-sm text-gray-400">{person.email || 'No email'} · {person.role}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={saving || person.id === user?.id}
                      className="bg-green-500 text-black hover:bg-green-400"
                      onClick={() => applyUpdate(() => updateClientRole(person.id, 'coach', user.id), 'Coach role assigned')}
                    >
                      Make coach
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
          <CardTitle>Coach profile</CardTitle>
          <CardDescription className="text-gray-400">Personal details and active status stay on the existing profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {!selected || !form ? (
            <p className="py-12 text-center text-gray-400">Select a coach to edit.</p>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['first_name', 'First name'], ['last_name', 'Last name'], ['phone', 'Phone'],
                  ['date_of_birth', 'Date of birth'], ['address', 'Street address'],
                  ['postal_code', 'Postal code'], ['city', 'City'],
                ].map(([name, label]) => (
                  <div key={name} className={name === 'address' ? 'sm:col-span-2' : ''}>
                    <Label htmlFor={`coach-${name}`}>{label}</Label>
                    <Input
                      id={`coach-${name}`}
                      name={name}
                      type={name === 'date_of_birth' ? 'date' : 'text'}
                      max={name === 'date_of_birth' ? new Date().toISOString().slice(0, 10) : undefined}
                      value={form[name] || ''}
                      onChange={(event) => setForm((value) => ({ ...value, [name]: event.target.value }))}
                      className="mt-1 bg-gray-950 border-gray-700"
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <CountrySelect value={form.country_code} onChange={(event) => setForm((value) => ({ ...value, country_code: event.target.value }))} />
                </div>
              </div>
              <Button disabled={saving} onClick={() => applyUpdate(() => updateClientPersonalFields(selected.id, form), 'Coach details updated')} className="w-full bg-green-500 text-black hover:bg-green-400">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save personal details
              </Button>

              <div className="border-t border-gray-800 pt-5">
                <Label>Status</Label>
                <Button
                  variant="outline"
                  disabled={saving || (isSelf && selected.is_active)}
                  onClick={() => applyUpdate(
                    () => updateClientStatus(selected.id, !selected.is_active, user.id),
                    selected.is_active ? 'Coach deactivated' : 'Coach reactivated',
                  )}
                  className="mt-2 w-full"
                >
                  {selected.is_active ? 'Deactivate coach' : 'Reactivate coach'}
                </Button>
                {isSelf && selected.is_active && (
                  <p className="mt-2 text-xs text-amber-300">You cannot deactivate your own administrator profile.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CoachManagementPanel;
