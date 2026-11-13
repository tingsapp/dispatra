export type MapMarkerTone = 'accent' | 'risk' | 'late' | 'muted' | 'live';

const TONE_DOT: Record<MapMarkerTone, string> = {
  accent: 'bg-app-accent', risk: 'bg-rose-600', late: 'bg-amber-500', muted: 'bg-slate-400', live: 'bg-emerald-500',
};

/** Branded hover/focus card above a map marker. The marker's group must be named `marker`; its aria-label carries the same text. */
export function MapMarkerLabel({ title, status, tone = 'accent', meta, detail }: { title: string; status?: string; tone?: MapMarkerTone; meta?: string; detail?: string }) {
  return <div aria-hidden="true" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[220px] -translate-x-1/2 translate-y-1 rounded-lg border border-app-border bg-app-surface px-2.5 py-2 text-left text-[11px] leading-4 text-app-text opacity-0 shadow-[0_6px_16px_rgb(0_0_0/0.12)] transition duration-150 group-hover/marker:translate-y-0 group-hover/marker:opacity-100 group-focus-visible/marker:translate-y-0 group-focus-visible/marker:opacity-100 group-aria-expanded/marker:hidden">
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="font-semibold tracking-tight">{title}</span>
      {status && <span className="flex items-center gap-1 text-app-muted"><span className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} />{status}</span>}
    </div>
    {meta && <div className="mt-0.5 text-app-muted">{meta}</div>}
    {detail && <div className="mt-1 line-clamp-2 border-t border-app-border pt-1 text-app-text/80">{detail}</div>}
    <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-app-border bg-app-surface" />
  </div>;
}
