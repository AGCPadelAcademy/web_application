import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listClients } from '@/lib/clientManagement';
import {
  MEMBERSHIP_STATUS_LABELS,
  activateMembership,
  cancelMembership,
  createMembership,
  expireMembership,
  listGroups,
  listMemberships,
  pauseMembership,
  resumeMembership,
} from '@/lib/memberships';

const selectClass = 'h-10 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-sm text-white';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function groupLabel(group) {
  if (!group) return 'Group';
  const day = WEEKDAYS[group.weekday] || '';
  return `${group.name} (${day} ${group.start_time}–${group.end_time})`;
}

function actionsFor(status) {
  if (status === 'pending_payment') return ['activate', 'cancel', 'expire'];
  if (status === 'active') return ['pause', 'cancel'];
  if (status === 'paused') return ['resume', 'cancel'];
  if (status === 'cancelled') return ['expire'];
  return [];
}

const ACTION_LABELS = {
  activate: 'Activate',
  pause: 'Pause',
  resume: 'Resume',
  cancel: 'Cancel',
  expire: 'Expire',
};

const MembershipManagementPanel = () => {
  const { toast } = useToast();
  const [memberships, setMemberships] = useState([]);
  const [clients, setClients] = useState([]);
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clientId, setClientId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [price, setPrice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [membershipResult, clientResult, groupResult] = await Promise.all([
        listMemberships({ status }),
        listClients({ status: 'active', pageSize: 100 }),
        listGroups(),
      ]);
      setMemberships(membershipResult.memberships);
      setClients(clientResult.clients);
      setGroups(groupResult);
    } catch (loadError) {
      setError(loadError.message || 'Could not load memberships.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const onCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createMembership({ clientId, groupId, monthlyPriceAmount: price });
      setPrice('');
      toast({ title: 'Membership created' });
      await load();
    } catch (createError) {
      toast({ title: 'Create failed', description: createError.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (membership, action) => {
    const label = ACTION_LABELS[action];
    if (!window.confirm(`${label} this membership?`)) return;
    const runners = {
      activate: activateMembership,
      pause: pauseMembership,
      resume: resumeMembership,
      cancel: cancelMembership,
      expire: expireMembership,
    };
    setSaving(true);
    try {
      await runners[action](membership.id);
      toast({ title: `Membership ${ACTION_LABELS[action].toLowerCase()} complete` });
      await load();
    } catch (actionError) {
      toast({ title: `${label} failed`, description: actionError.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
          <CardTitle>New membership</CardTitle>
          <CardDescription className="text-gray-400">
            Creates a Pending Payment membership. Activation stays manual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4" onSubmit={onCreate}>
            <div className="space-y-2">
              <Label htmlFor="membership-client">Client</Label>
              <select id="membership-client" className={selectClass} value={clientId} onChange={(event) => setClientId(event.target.value)} required>
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.full_name || client.email}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="membership-group">Group</Label>
              <select id="membership-group" className={selectClass} value={groupId} onChange={(event) => setGroupId(event.target.value)} required>
                <option value="">Select a group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{groupLabel(group)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="membership-price">Monthly price (CHF)</Label>
              <Input id="membership-price" type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required className="bg-gray-950 border-gray-700" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={saving} className="bg-green-500 text-black hover:bg-green-400">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Memberships</CardTitle>
          <select aria-label="Filter by status" className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {Object.entries(MEMBERSHIP_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-gray-400">Loading memberships…</p> : null}
          {error ? <p className="text-red-400">{error}</p> : null}
          {!loading && memberships.length === 0 ? <p className="text-gray-400">No memberships yet.</p> : null}
          <ul className="space-y-3">
            {memberships.map((membership) => (
              <li key={membership.id} className="rounded-lg border border-gray-800 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{membership.profiles?.full_name || 'Client'}</p>
                    <p className="text-sm text-gray-400">{groupLabel(membership.groups)}</p>
                    <p className="text-sm text-gray-300">
                      {MEMBERSHIP_STATUS_LABELS[membership.status] || membership.status}
                      {' · CHF '}
                      {membership.monthly_price_amount}
                      {membership.cancellation_effective_on ? ` · through ${membership.cancellation_effective_on}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {actionsFor(membership.status).map((action) => (
                      <Button key={action} type="button" variant="outline" disabled={saving} onClick={() => runAction(membership, action)}>
                        {ACTION_LABELS[action]}
                      </Button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default MembershipManagementPanel;
