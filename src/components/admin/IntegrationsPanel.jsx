import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  getBexioStatus,
  startBexioConnection,
  disconnectBexio,
  initializeBexioConfig,
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

  const refresh = useCallback(async () => {
    try {
      setState(await getBexioStatus());
    } catch (err) {
      toast({ title: 'Could not load integration status', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
              Run “Discover configuration”, then have the accountant confirm the VAT tax selection
              before enabling bookings (spec FR-018).
            </p>
          )}

          {connected && config.taxes_sales?.length > 0 && (
            <div className="text-sm text-gray-400">
              <p className="mb-1 text-gray-500">Available sales taxes in Bexio:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {config.taxes_sales.map((t) => (
                  <li key={t.id} className={t.id === config.tax_id_sales ? 'text-green-400' : ''}>
                    {t.name} — {t.value}% {t.id === config.tax_id_sales && '(selected)'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsPanel;
