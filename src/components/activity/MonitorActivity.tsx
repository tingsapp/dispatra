import { useEffect } from 'react';
import { X } from 'lucide-react';
import { FloatingPanel } from '../ui/FloatingPanel';
import { ActivityLog } from './ActivityLog';
import { useActivityPresence, useCompanyActivity } from './useActivity';

export function MonitorActivity({ slug, open, active, onOpenChange }: { slug: string; open: boolean; active: boolean; onOpenChange: (open: boolean) => void }) {
  const { visible, reducedMotion } = useActivityPresence();
  const live = open && active && visible;
  const query = useCompanyActivity(slug, live);
  useEffect(() => { if (!active) onOpenChange(false); }, [active, onOpenChange]);
  const page = query.data;
  const timeZone = page?.time_zone ?? undefined;
  const error = query.error instanceof Error ? query.error.message : 'Activity updates are unavailable.';
  return <FloatingPanel open={open} onOpenChange={next => { if (next) onOpenChange(true); }} dismissible={false}
    anchor={<span aria-hidden="true" className="pointer-events-none absolute inset-0" />}
    label="Order and agent activity" align="end" side="bottom" avoidCollisions={false} size="rich" className="company-activity-panel app-map-menu p-3" trigger={
    <button type="button" aria-label="Order and agent activity" aria-expanded={open} title="Order and agent activity" className="company-activity-trigger app-metric app-map-icon relative">
      <span aria-hidden="true" className={`company-activity-waves pointer-events-none absolute inset-0 ${!visible || !active ? 'company-activity-pulse-paused' : ''}`}><span className="company-activity-pulse" /><span className="company-activity-pulse" /><span className="company-activity-pulse" /></span>
      <span aria-hidden="true" className="company-activity-dot relative block size-1.5 rounded-full bg-red-600" />
    </button>}>
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="text-sm font-medium">Activity</h3><p title={timeZone ? `Times shown in ${timeZone}` : 'Times shown in your local time'} className="text-[10px] text-app-muted">{query.isError ? 'Updates unavailable' : 'Live updates'}</p></div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close activity" className="inline-flex size-8 items-center justify-center rounded-lg text-app-muted hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"><X size={14} /></button>
      </div>
    </div>
    {query.isPending && !page && <p className="py-8 text-center text-xs text-app-muted">Loading activity…</p>}
    {query.isError && <div role="alert" className="py-3 text-xs text-rose-700"><p>{error}</p>{page && <p className="mt-1 text-app-muted">Showing the last saved activity.</p>}<button type="button" onClick={() => query.refetch()} className="mt-2 underline">Try again</button></div>}
    {page && <>
      {page.items.length === 0 && <p className="py-8 text-center text-xs text-app-muted">No activity recorded yet.</p>}
      <div className="mt-3"><ActivityLog entries={page.items} active={open && active && visible} reducedMotion={reducedMotion} timeZone={timeZone} /></div>
    </>}
  </FloatingPanel>;
}
