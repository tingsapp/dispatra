import { Info } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { ConnectedTmsTab } from '../components/integrations/ConnectedTmsTab';
import { DispatraApiTab } from '../components/integrations/DispatraApiTab';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import type { IntegrationsPreview } from '../integrations/preview';

export function IntegrationsPage({ preview, onChange }: { preview: IntegrationsPreview; onChange: (next: IntegrationsPreview) => void }) {
  const slug = companySlugForCurrentPath() ?? 'example';
  return <div className="app-page h-full min-w-0 flex flex-col">
    <PageHeader title="Integrations" description="Connect your existing transportation system to Dispatra and exchange orders and operational updates." />
    <div className="page-content py-6"><div className="app-sections">
      <div className="flex items-start gap-3 rounded-lg border border-app-border p-4 text-sm text-app-muted">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p><span className="font-medium text-app-text">Interface preview.</span> No TMS is connected and no synchronization is active. Use test values only. Saved preview settings stay in this workspace session and reset on reload or sign out. Entered credentials are cleared when saved.</p>
      </div>
      <Tabs label="Integration sections" items={[
        { id: 'tms', label: 'Connected TMS', pageWidth: 'reading', content: <ConnectedTmsTab saved={preview.tms} slug={slug} onSave={tms => onChange({ ...preview, tms })} /> },
        { id: 'api', label: 'Dispatra API', pageWidth: 'reading', content: <DispatraApiTab slug={slug} apiKey={preview.apiKey} outbound={preview.outbound} onRegenerate={apiKey => onChange({ ...preview, apiKey })} onSave={outbound => onChange({ ...preview, outbound })} /> },
      ]} />
    </div></div>
  </div>;
}
