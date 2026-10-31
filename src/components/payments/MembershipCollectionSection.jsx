import { useEffect, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import InvoicePreviewModal from '@/components/modals/InvoicePreviewModal.jsx';
import { fetchMembershipPeriodDocument } from '@/lib/billing';
import {
  COLLECTION_COPY,
  COLLECTION_ERROR_COPY,
  COLLECTION_METHODS,
  buildSubjectCollectionView,
  listCollectionSubjects,
  requestNewMandate,
  setCollectionMethod,
} from '@/lib/membershipCollection';

const MembershipCollectionSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [ready, setReady] = useState(false);
  const [channelConfigured, setChannelConfigured] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [hiddenPeriodIds, setHiddenPeriodIds] = useState(() => new Set());
  const [previewUrl, setPreviewUrl] = useState(null);

  const load = async () => {
    const result = await listCollectionSubjects();
    setSubjects(result.available ? result.subjects : []);
    setReady(true);
  };

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    listCollectionSubjects()
      .then((result) => {
        if (cancelled) return;
        setSubjects(result.available ? result.subjects : []);
        setReady(true);
      })
      .catch((error) => {
        console.error('Membership collection load error:', error);
        if (!cancelled) {
          setSubjects([]);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!ready || subjects.length === 0) return null;

  const views = subjects.map((subject) => buildSubjectCollectionView(subject, { channelConfigured }));

  const runAction = async (subjectId, action) => {
    setBusyId(subjectId);
    try {
      await action();
      setChannelConfigured(true);
      await load();
    } catch (error) {
      if (error.code === 'collection_channel_not_configured') {
        setChannelConfigured(false);
      }
      toast({
        title: 'Collection method',
        description: error.message || COLLECTION_COPY.channelNotConfigured,
        variant: 'destructive',
      });
      try {
        await load();
      } catch (reloadError) {
        console.error('Membership collection reload error:', reloadError);
      }
    } finally {
      setBusyId(null);
    }
  };

  const openPeriodInvoice = async (periodId) => {
    setBusyId(periodId);
    try {
      const result = await fetchMembershipPeriodDocument(periodId);
      if (result.qrPayHidden) {
        setHiddenPeriodIds((current) => new Set(current).add(periodId));
        toast({
          title: 'Pay by invoice is hidden',
          description: COLLECTION_COPY.collectionSubmitted,
        });
        return;
      }
      if (!result.previewUrl) {
        toast({
          title: 'Invoice',
          description: 'Invoice is not available yet.',
          variant: 'destructive',
        });
        return;
      }
      setPreviewUrl(result.previewUrl);
    } catch (error) {
      toast({
        title: 'Invoice',
        description: error.message || 'Could not open the invoice.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section className="mb-10 space-y-4" aria-label="Membership collection">
        <div>
          <h2 className="text-xl font-semibold text-white">Membership collection</h2>
          <p className="mt-1 text-sm text-gray-400">{COLLECTION_COPY.notPaidNote}</p>
        </div>
        {views.map((view) => (
          <article key={view.id} className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col gap-1 border-b border-gray-800 pb-4 mb-4">
              <h3 className="font-bold text-xl text-white">{view.label}</h3>
              <p className="text-sm text-gray-300">{view.statusCopy}</p>
              {view.failureReason && (
                <p className="text-sm text-gray-500">{view.failureReason}</p>
              )}
            </div>
            <fieldset className="flex flex-wrap gap-3" disabled={busyId === view.id}>
              <legend className="mb-3 text-sm text-gray-400">Collection method</legend>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={view.method === COLLECTION_METHODS.AUTOMATIC}
                disabled={view.inactive}
                onClick={() => runAction(view.id, () => setCollectionMethod(view.id, COLLECTION_METHODS.AUTOMATIC))}
                className={view.method === COLLECTION_METHODS.AUTOMATIC
                  ? 'border-green-500 text-green-300'
                  : 'border-gray-700 text-gray-300'}
              >
                {busyId === view.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Automatic collection
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={view.method === COLLECTION_METHODS.QR}
                onClick={() => runAction(view.id, () => setCollectionMethod(view.id, COLLECTION_METHODS.QR))}
                className={view.method === COLLECTION_METHODS.QR
                  ? 'border-green-500 text-green-300'
                  : 'border-gray-700 text-gray-300'}
              >
                Pay by invoice
              </Button>
              {view.canRequestNewMandate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => runAction(view.id, () => requestNewMandate(view.id))}
                  className="border-gray-700 text-gray-300"
                >
                  Request a new mandate
                </Button>
              )}
            </fieldset>
            {view.inactive && (
              <p className="mt-3 text-sm text-gray-400">{COLLECTION_ERROR_COPY.client_inactive}</p>
            )}
            {view.periods.length > 0 && (
              <ul className="mt-5 space-y-3">
                {view.periods.map((period) => {
                  const payHidden = period.qrPayHidden || hiddenPeriodIds.has(period.id);
                  return (
                    <li key={period.id} className="flex flex-col gap-2 rounded-xl border border-gray-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{period.periodKey}</p>
                        <p className="text-sm text-gray-400">
                          {period.amountLabel ? `${period.amountLabel}. ` : ''}
                          {payHidden ? COLLECTION_COPY.collectionSubmitted : period.copy}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {period.showInvoice && !payHidden && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openPeriodInvoice(period.id)}
                            disabled={busyId === period.id}
                            className="border-green-500/40 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                          >
                            {busyId === period.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <FileDown className="w-4 h-4 mr-2" />
                            )}
                            Invoice (PDF)
                          </Button>
                        )}
                        <span className={`text-xs font-medium ${period.paid ? 'text-green-400' : 'text-gray-400'}`}>
                          {period.paid ? 'Paid' : 'Not paid'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        ))}
      </section>
      <InvoicePreviewModal
        isOpen={Boolean(previewUrl)}
        onClose={() => setPreviewUrl(null)}
        invoiceUrl={previewUrl}
      />
    </>
  );
};

export default MembershipCollectionSection;
