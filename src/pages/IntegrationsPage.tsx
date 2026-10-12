import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/layout/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { ConnectedTmsTab } from '../components/integrations/ConnectedTmsTab';
import { DispatraApiTab } from '../components/integrations/DispatraApiTab';
import { TmsReview } from '../components/integrations/TmsReview';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import { tmsForm, tmsInput, type TmsForm } from '../integrations/preview';
import { operations, type FleetSyncResult, type RateCard } from '../operations/api';

/** Loads the saved TMS connection; the form mounts once the API answers so its draft starts from saved values. */
function ConnectedTms({ slug, importedRateCard }: { slug: string; importedRateCard?: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['operations', slug, 'tms'];
  const query = useQuery({ queryKey, queryFn: () => operations.tms(slug) });
  if (query.isPending) return <p role="status" className="text-sm text-app-muted">Loading…</p>;
  if (query.error) return <p role="alert" className="text-sm text-rose-700">{query.error.message}</p>;
  const save = async (form: TmsForm, credential: string, secret: string) => {
    const view = await operations.saveTms(slug, tmsInput(form, credential, secret));
    queryClient.setQueryData(queryKey, view);
    return tmsForm(view);
  };
  const sync = async () => {
    try { return await operations.syncTms(slug); } finally { await queryClient.invalidateQueries({ queryKey }); }
  };
  const view = query.data;
  const lastSync = view?.last_fleet_sync_at && view.last_fleet_result ? { at: view.last_fleet_sync_at, result: view.last_fleet_result as FleetSyncResult } : null;
  return <ConnectedTmsTab saved={tmsForm(view)} slug={slug} importedRateCard={importedRateCard} lastSync={lastSync} statusDelivery={view?.last_status_at ? { at: view.last_status_at, failing: !!view.last_status_error } : null} review={view ? <TmsReview slug={slug} /> : null} onSave={save} onTest={() => operations.testTms(slug)} onSync={sync} />;
}

export function IntegrationsPage({ rates = [] }: { rates?: RateCard[] }) {
  const slug = companySlugForCurrentPath() ?? 'example';
  const importedRateCard = rates.find(card => card.active && card.data.method === 'IMPORTED')?.data.name;
  return <div className="app-page h-full min-w-0 flex flex-col">
    <PageHeader title="Integrations" description="Connect your existing transportation system to Dispatra and exchange orders and operational updates." />
    <div className="page-content py-6"><div className="app-sections">
      <Tabs label="Integration sections" items={[
        { id: 'tms', label: 'Connected TMS', pageWidth: 'reading', content: <ConnectedTms slug={slug} importedRateCard={importedRateCard} /> },
        { id: 'api', label: 'Dispatra API', pageWidth: 'reading', content: <DispatraApiTab slug={slug} /> },
      ]} />
    </div></div>
  </div>;
}
