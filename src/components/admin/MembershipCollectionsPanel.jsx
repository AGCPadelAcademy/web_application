import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { COLLECTION_COPY, listCollectionSubjects, setCollectionMethod } from '@/lib/membershipCollection';

function requestRows(intent) {
  const requests = intent.collection_requests ?? [];
  return Array.isArray(requests) ? requests : [requests];
}

function needsAttention(intent) {
  const requests = requestRows(intent);
  return intent.status === 'collection_failed'
    || intent.status === 'reversed'
    || intent.duplicate_receipt === true
    || requests.some((row) => row.status === 'failed' || row.status === 'rejected');
}

const MembershipCollectionsPanel = () => {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await listCollectionSubjects());
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load collections.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <CardTitle>Collections</CardTitle>
        <CardDescription className="text-gray-400">{COLLECTION_COPY.unavailable}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-red-400">{error}</p> : null}
        {rows.length === 0 ? <p className="text-gray-400">No collection subjects yet.</p> : null}
        {rows.map((row) => {
          const method = row.collection_methods?.[0]?.method ?? row.collection_methods?.method ?? 'qr_invoice';
          const intents = row.membership_period_intents ?? [];
          return (
            <div key={row.id} className="rounded-lg border border-gray-800 p-4">
              <p className="font-medium">{row.display_label}</p>
              <p className="text-sm text-gray-400">{method === 'automatic_collection' ? COLLECTION_COPY.waiting : COLLECTION_COPY.invoice}</p>
              <ul className="mt-2 text-sm text-gray-300">
                {intents.map((intent) => (
                  <li key={intent.id}>{intent.period_key} · CHF {intent.amount} · {intent.status}</li>
                ))}
              </ul>
              {intents.filter(needsAttention).length > 0 ? (
                <div className="mt-3 text-sm text-amber-200">
                  <p className="font-medium">Failed collections, reversals, and duplicate receipts</p>
                  <ul>
                    {intents.filter(needsAttention).map((intent) => (
                      <li key={`${intent.id}-attention`}>
                        {intent.period_key}
                        {intent.status === 'collection_failed' ? ' · collection failed' : ''}
                        {intent.status === 'reversed' ? ' · reversed' : ''}
                        {intent.duplicate_receipt ? ' · duplicate receipt' : ''}
                        {requestRows(intent).some((request) => request.status === 'failed' || request.status === 'rejected')
                          ? ' · collection rejected'
                          : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button type="button" variant="outline" className="mt-3" onClick={() => setCollectionMethod(row.id, 'qr_invoice').then(load)}>
                Use invoice
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default MembershipCollectionsPanel;
