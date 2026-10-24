import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  COLLECTION_COPY,
  COLLECTION_ERROR_COPY,
  COLLECTION_METHODS,
  adminCollectionLists,
  buildSubjectCollectionView,
  listCollectionSubjects,
  requestNewMandate,
  setCollectionMethod,
} from '@/lib/membershipCollection';

function RecordList({ title, rows, empty, renderRow }) {
  return (
    <section className="mt-8">
      <h3 className="mb-3 text-lg font-semibold text-white">{title}</h3>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-6 text-sm text-gray-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-800">
          {rows.map((row, index) => (
            <li key={`${row.subjectId}-${row.period}-${row.status || 'row'}-${index}`} className="bg-gray-900/60 px-4 py-3 text-sm text-gray-300">
              {renderRow(row)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const MembershipCollectionsPanel = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await listCollectionSubjects();
      setSubjects(result.subjects || []);
    } catch (error) {
      toast({
        title: 'Could not load collections',
        description: error.message || 'Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runAction = async (subjectId, action) => {
    setBusyId(subjectId);
    try {
      await action();
      await load();
    } catch (error) {
      toast({
        title: 'Collection method',
        description: error.message || COLLECTION_COPY.channelNotConfigured,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  const views = subjects.map((subject) => buildSubjectCollectionView(subject));
  const lists = adminCollectionLists(subjects);

  return (
    <div>
      <p className="mb-6 text-sm text-gray-400">
        Set automatic collection or pay by invoice for a client. Failed collections, reversals, and duplicate receipts are read-only.
      </p>
      {views.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-6 py-12 text-center text-gray-400">
          No membership collection subjects yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Membership</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Method</th>
              </tr>
            </thead>
            <tbody>
              {views.map((view) => (
                <tr key={view.id} className="border-t border-gray-800 bg-gray-950/40 align-top">
                  <td className="px-4 py-3 text-gray-200">{view.clientName || view.clientId}</td>
                  <td className="px-4 py-3 text-white">{view.label}</td>
                  <td className="px-4 py-3 text-gray-300">
                    <p>{view.statusCopy}</p>
                    {view.inactive && (
                      <p className="mt-1 text-gray-500">{COLLECTION_ERROR_COPY.client_inactive}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === view.id || view.inactive}
                        aria-pressed={view.method === COLLECTION_METHODS.AUTOMATIC}
                        onClick={() => runAction(view.id, () => setCollectionMethod(view.id, COLLECTION_METHODS.AUTOMATIC))}
                        className="border-gray-700 text-gray-200"
                      >
                        Automatic collection
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === view.id}
                        aria-pressed={view.method === COLLECTION_METHODS.QR}
                        onClick={() => runAction(view.id, () => setCollectionMethod(view.id, COLLECTION_METHODS.QR))}
                        className="border-gray-700 text-gray-200"
                      >
                        Pay by invoice
                      </Button>
                      {view.canRequestNewMandate && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === view.id}
                          onClick={() => runAction(view.id, () => requestNewMandate(view.id))}
                          className="border-gray-700 text-gray-200"
                        >
                          Request a new mandate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RecordList
        title="Failed or rejected collections"
        rows={lists.failed}
        empty="No failed or rejected collections."
        renderRow={(row) => `${row.client} · ${row.label} · ${row.period} · ${row.status}${row.failureReason ? ` · ${row.failureReason}` : ''}`}
      />
      <RecordList
        title="Reversals"
        rows={lists.reversals}
        empty="No reversals."
        renderRow={(row) => `${row.client} · ${row.label} · ${row.period} · no longer paid`}
      />
      <RecordList
        title="Duplicate receipts"
        rows={lists.duplicates}
        empty="No duplicate receipts."
        renderRow={(row) => `${row.client} · ${row.label} · ${row.period}`}
      />
    </div>
  );
};

export default MembershipCollectionsPanel;
