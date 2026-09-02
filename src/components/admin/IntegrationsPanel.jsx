import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import {
  getBexioStatus,
  startBexioConnection,
  disconnectBexio,
  initializeBexioConfig,
  runBexioReconciliation,
} from '@/lib/billing';

const STATUS_STYLES = {
  connected: 'bg-green-500/15 text-green-400 border-green-500/40',
  degraded: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  requires_reauth: 'bg-red-500/15 text-red-400 border-red-500/40',
  disconnected: 'bg-gray-500/15 text-gray-400 border-gray-500/40',
  not_connected: 'bg-gray-500/15 text-gray-400 border-gray-500/40',
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.not_connected}`}>
    {(status ?? 'not_connected').replace(/_/g, ' ')}
  </span>
);

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');

const IntegrationsPanel = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState({ run: null, failed: [], discrepancies: [] });

  const loadHealth = useCallback(async () => {
    const [runRes, failedRes, discRes] = await Promise.all([
      supabase
        .from('billing_events')
        .select('created_at, details')
        .eq('event_type', 'reconciliation.run')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('billing_operations')
        .select('id, kind, last_error, attempts, updated_at')
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('billing_events')
        .select('created_at, booking_id, details')
        .eq('event_type', 'reconciliation.discrepancy')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    setHealth({
      run: runRes.data?.[0] ?? null,
      failed: failedRes.data ?? [],
      discrepancies: discRes.data ?? [],
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      setState(await getBexioStatus());
      await loadHealth();
    } catch (err) {
      toast({ title: 'Could not load integration status', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, loadHealth]);

  useEffect(() => {
    const outcome = searchParams.get('bexio');
    if (outcome === 'connected') {
      toast({ title: 'Bexio connected', description: 'The accounting integration is now active.' });
    } else if (outcome === 'error') {
      toast({
        title: 'Bexio connection failed',
        description: `Reason: ${searchParams.get('code') ?? 'unknown'}. Try connecting again.`,
        variant: 'destructive',
      });
    }
    if (outcome) {
      searchParams.delete('bexio');
      searchParams.delete('code');
      setSearchParams(searchParams, { replace: true });
    }
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    setBusy(true);
    try {
      const { authorize_url } = await startBexioConnection();
      window.location.href = authorize_url;
    } catch (err) {
      toast({ title: 'Could not start Bexio connection', description: err.message, variant: 'destructive' });
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Bexio? New invoices will no longer be issued via Bexio.')) return;
    setBusy(true);
    try {
      await disconnectBexio();
      toast({ title: 'Bexio disconnected' });
      await refresh();
    } catch (err) {
      toast({ title: 'Disconnect failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleReconcileNow = async () => {
    setBusy(true);
    try {
      const result = await runBexioReconciliation();
      toast({
        title: 'Reconciliation finished',
        description: `Checked ${result.checked}, confirmed ${result.confirmed}, retried ${result.retried}, failed ${result.failed_operations}.`,
      });
      await refresh();
    } catch (err) {
      toast({ title: 'Reconciliation failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleInitialize = async () => {
    setBusy(true);
    try {
      const result = await initializeBexioConfig();
      if (result.config_complete) {
        toast({ title: 'Configuration discovered', description: 'All required Bexio configuration was found.' });
      } else {
        toast({
          title: 'Configuration incomplete',
          description: `Missing: ${result.missing.join(', ')}. Review with the accountant before go-live.`,
        });
      }
      await refresh();
    } catch (err) {
      toast({ title: 'Initialization failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-gray-400">Loading integration status…</p>;

  const status = state?.status ?? 'not_connected';
  const config = state?.config ?? {};
  const connected = status === 'connected' || status === 'degraded' || status === 'requires_reauth';

  return (
    <div className="space-y-6">
      {status === 'requires_reauth' && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
          Bexio authorization expired or was revoked. Reconnect to resume invoice issuance —
          pending operations are queued and will retry automatically.
        </div>
      )}

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Bexio Accounting</CardTitle>
              <CardDescription className="text-gray-400">
                External financial system for invoices and payment reconciliation.
              </CardDescription>
            </div>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Connected at</dt>
              <dd className="text-gray-200">{formatDate(state?.connected_at)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Last successful call</dt>
              <dd className="text-gray-200">{formatDate(state?.last_successful_call_at)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Scopes</dt>
              <dd className="text-gray-200 break-all">{(state?.scopes ?? []).join(' ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Configuration</dt>
              <dd className="text-gray-200">
                {state?.config_complete ? 'Complete' : `Missing: ${(state?.missing ?? []).join(', ') || '—'}`}
              </dd>
            </div>
          </dl>

          {state?.last_error && (
            <p className="text-sm text-red-400">Last error: {state.last_error}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {!connected && (
              <Button onClick={handleConnect} disabled={busy} className="bg-green-500 text-black hover:bg-green-400">
                Connect Bexio
              </Button>
            )}
            {connected && (
              <>
                <Button onClick={handleInitialize} disabled={busy} variant="outline" className="border-gray-700 text-gray-200">
                  Discover configuration
                </Button>
                <Button onClick={handleReconcileNow} disabled={busy} className="bg-green-500 text-black hover:bg-green-400">
                  Run reconciliation now
                </Button>
                <Button onClick={handleConnect} disabled={busy} variant="outline" className="border-gray-700 text-gray-200">
                  Reconnect
                </Button>
                <Button onClick={handleDisconnect} disabled={busy} variant="destructive">
                  Disconnect
                </Button>
              </>
            )}
          </div>

          {connected && !state?.config_complete && (
            <p className="text-sm text-yellow-400/90">
              Run “Discover configuration”. Lesson invoices require an active 0% Bexio sales tax.
            </p>
          )}

          {connected && config.taxes_sales?.length > 0 && (
            <div className="text-sm text-gray-400">
              <p className="mb-1 text-gray-500">Available sales taxes in Bexio:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {config.taxes_sales.map((t) => {
                  const isZero = Number(t.value) === 0;
                  const isSelected = t.id === config.tax_id_sales;
                  return (
                    <li key={t.id} className={isZero || isSelected ? 'text-green-400' : ''}>
                      {t.name} — {t.value}%
                      {isZero && ' (0% — used on invoices)'}
                      {!isZero && isSelected && ' (stored selection)'}
                    </li>
                  );
                })}
              </ul>
              {!config.taxes_sales.some((t) => Number(t.value) === 0) && (
                <p className="mt-2 text-yellow-400/90">
                  No 0% sales tax in this Bexio company. Add one in Bexio, then run Discover
                  configuration — 8.1% must not be used on lesson invoices.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {connected && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Reconciliation worker</CardTitle>
            <CardDescription className="text-gray-400">
              Bank payments recorded in Bexio are synced into AGC every six hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-gray-500">Last run</dt>
                <dd className="text-gray-200">{formatDate(health.run?.created_at)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Last run counts</dt>
                <dd className="text-gray-200">
                  {health.run?.details
                    ? `checked ${health.run.details.checked ?? 0}, confirmed ${health.run.details.confirmed ?? 0}, retried ${health.run.details.retried ?? 0}, failed ${health.run.details.failed_operations ?? 0}`
                    : '—'}
                </dd>
              </div>
            </dl>
            {health.failed.length > 0 && (
              <div>
                <p className="text-yellow-400 mb-1">Failed operations</p>
                <ul className="list-disc list-inside text-gray-400 space-y-0.5">
                  {health.failed.map((op) => (
                    <li key={op.id}>{op.kind}: {op.last_error || 'failed'} ({op.attempts} attempts)</li>
                  ))}
                </ul>
              </div>
            )}
            {health.discrepancies.length > 0 && (
              <div>
                <p className="text-yellow-400 mb-1">Discrepancies</p>
                <ul className="list-disc list-inside text-gray-400 space-y-0.5">
                  {health.discrepancies.map((row) => (
                    <li key={`${row.booking_id}-${row.created_at}`}>
                      {row.details?.kind || 'flagged'} · booking {row.booking_id}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IntegrationsPanel;
