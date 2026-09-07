import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Users } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CountrySelect from '@/components/profile/CountrySelect';
import { profileToFormData } from '@/lib/profileService';
import {
  ASSIGNABLE_ROLES,
  listClients,
  updateClientPersonalFields,
  updateClientRole,
  updateClientStatus,
} from '@/lib/clientManagement';

const selectClass = 'h-10 rounded-md border border-gray-700 bg-gray-950 px-3 text-sm text-white';

const ClientManagementPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listClients({ search, role, status, page });
      setClients(result.clients);
      setCount(result.count);
      if (selected) {
        const refreshed = result.clients.find((client) => client.id === selected.id);
        if (refreshed) {
          setSelected(refreshed);
          setForm(profileToFormData(refreshed));
        }
      }
    } catch (loadError) {
      setError(loadError.message || 'Could not load clients.');
    } finally {
      setLoading(false);
    }
  }, [page, role, search, selected?.id, status]);

  useEffect(() => {
    load();
  }, [load]);

  const chooseClient = (client) => {
    setSelected(client);
    setForm(profileToFormData(client));
  };

  const applyUpdate = async (operation, successMessage) => {
    setSaving(true);
    try {
      const updated = await operation();
      setSelected(updated);
      setForm(profileToFormData(updated));
      setClients((items) => items.map((item) => item.id === updated.id ? updated : item));
      toast({ title: successMessage });
    } catch (saveError) {
      toast({ title: 'Update failed', description: saveError.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / 50));
  const isSelf = selected?.id === user?.id;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="text-green-500" /> Clients</CardTitle>
          <CardDescription className="text-gray-400">Search and filter existing academy profiles.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput);
            }}
          >
            <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Name or email" className="bg-gray-950 border-gray-700" />
            <select aria-label="Filter by role" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className={selectClass}>
              <option value="all">All roles</option>
              {ASSIGNABLE_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
              <option value="accounting">accounting (legacy)</option>
            </select>
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
          ) : clients.length === 0 ? (
            <p className="py-8 text-center text-gray-400">No clients match these filters.</p>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <button
                  type="button"
                  key={client.id}
                  onClick={() => chooseClient(client)}
                  className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === client.id ? 'border-green-500 bg-green-500/10' : 'border-gray-800 bg-gray-950 hover:border-gray-700'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{client.full_name || 'Unnamed client'}</span>
                    <span className={`rounded-full px-2 py-1 text-xs ${client.is_active ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-gray-400">
                    <span>{client.email || 'No email'}</span><span className="capitalize">{client.role}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
            <span>{count} profiles</span>
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
          <CardTitle>Edit client</CardTitle>
          <CardDescription className="text-gray-400">Personal, role, and lifecycle updates are saved separately.</CardDescription>
        </CardHeader>
        <CardContent>
          {!selected || !form ? (
            <p className="py-12 text-center text-gray-400">Select a client to edit.</p>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['first_name', 'First name'], ['last_name', 'Last name'], ['phone', 'Phone'],
                  ['date_of_birth', 'Date of birth'], ['address', 'Street address'],
                  ['postal_code', 'Postal code'], ['city', 'City'],
                ].map(([name, label]) => (
                  <div key={name} className={name === 'address' ? 'sm:col-span-2' : ''}>
                    <Label htmlFor={`client-${name}`}>{label}</Label>
                    <Input
                      id={`client-${name}`}
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
              <Button disabled={saving} onClick={() => applyUpdate(() => updateClientPersonalFields(selected.id, form), 'Client details updated')} className="w-full bg-green-500 text-black hover:bg-green-400">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save personal details
              </Button>

              <div className="border-t border-gray-800 pt-5">
                <Label htmlFor="client-role">Role</Label>
                <div className="mt-2 flex gap-2">
                  <select id="client-role" value={ASSIGNABLE_ROLES.includes(form.role) ? form.role : ''} disabled={isSelf || saving || form.role === 'accounting'} onChange={(event) => setForm((value) => ({ ...value, role: event.target.value }))} className={`${selectClass} flex-1`}>
                    {form.role === 'accounting' && <option value="">accounting (managed in Bexio)</option>}
                    {ASSIGNABLE_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <Button variant="outline" disabled={isSelf || saving || form.role === 'accounting'} onClick={() => applyUpdate(() => updateClientRole(selected.id, form.role, user.id), 'Client role updated')}>Update role</Button>
                </div>
                {isSelf && <p className="mt-2 text-xs text-amber-300">You cannot change your own role.</p>}
              </div>

              <div className="border-t border-gray-800 pt-5">
                <Label>Status</Label>
                <Button
                  variant="outline"
                  disabled={saving || (isSelf && selected.is_active)}
                  onClick={() => applyUpdate(() => updateClientStatus(selected.id, !selected.is_active, user.id), selected.is_active ? 'Client deactivated' : 'Client reactivated')}
                  className="mt-2 w-full"
                >
                  {selected.is_active ? 'Deactivate client' : 'Reactivate client'}
                </Button>
                {isSelf && selected.is_active && <p className="mt-2 text-xs text-amber-300">You cannot deactivate your own administrator profile.</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientManagementPanel;
