import type { ReactNode } from 'react';
import { Boxes, Route, Truck, Workflow } from 'lucide-react';
import { DispatraConnectorCard } from './DispatraConnectorCard';

export function WorkspaceModeLayout({ nativeTms, children }: { nativeTms: boolean; children: ReactNode }) {
  return <div className="space-y-5" data-workspace-mode={nativeTms ? 'dispatra' : 'external'}>
    {nativeTms && <div className="flex h-8 items-center" aria-live="polite" aria-atomic="true">
      <p className="integration-mode-label inline-flex items-center gap-2 rounded-full bg-app-accent-soft px-3 py-1.5 text-xs font-medium text-app-accent">
        <Workflow size={14} aria-hidden="true" />Dispatra workspace
      </p>
    </div>}
    <DispatraConnectorCard />
    <div className="integration-mode-stage">
      <div className="integration-mode-view" data-active={nativeTms} aria-hidden={!nativeTms} inert={!nativeTms}>
        <div className="integration-mode-content">
          <section aria-label="Dispatra workspace" className="rounded-xl bg-slate-50 p-6 sm:p-8">
            <div className="mb-5 inline-flex size-10 items-center justify-center rounded-xl bg-white text-app-accent"><Workflow size={20} aria-hidden="true" /></div>
            <h3 className="text-lg font-medium text-app-text">Manage operations in Dispatra.</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-app-muted">Keep your orders, drivers, and dispatch together in one workspace. No external TMS connection is needed.</p>
            <ul aria-label="In your Dispatra workspace" className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs text-app-muted">
              <li className="inline-flex items-center gap-2"><Boxes size={15} aria-hidden="true" />Orders</li>
              <li className="inline-flex items-center gap-2"><Truck size={15} aria-hidden="true" />Drivers</li>
              <li className="inline-flex items-center gap-2"><Route size={15} aria-hidden="true" />Dispatch</li>
            </ul>
          </section>
        </div>
      </div>
      <div className="integration-mode-view" data-active={!nativeTms} aria-hidden={nativeTms} inert={nativeTms}>
        <div className="integration-mode-content space-y-5">
          <div>
            <h3 className="text-base font-medium text-app-text">Connect your existing TMS.</h3>
            <p className="mt-1 text-sm text-app-muted">Choose a connector, or use the API tabs above.</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  </div>;
}
