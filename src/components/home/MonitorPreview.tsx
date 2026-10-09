import { MapPinned, MoreHorizontal, Package, Search, Settings2, Truck, Users } from 'lucide-react';
import { BrandMark } from '../layout/AppBrand';
import { OrderActivityPreview } from './OrderActivityPreview';
import { PreviewMap } from './PreviewMap';

/** An illustrative Monitor view with sample orders, never live company data. */
export function MonitorPreview() {
  return <div aria-label="Illustrative dispatch workspace preview" className="relative mx-auto w-full max-w-2xl">
    <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-xl">
      <div className="flex items-center justify-between px-4 py-3"><div className="flex items-center gap-1.5" aria-hidden="true">{[0, 1, 2].map(i => <span key={i} className="size-2 rounded-full bg-slate-200" />)}</div><span className="text-[10px] text-app-muted">Dispatra / workspace</span><MoreHorizontal className="size-4 text-slate-400" aria-hidden="true" /></div>
      <div className="flex h-[340px] sm:h-[390px]">
        <div className="flex w-14 shrink-0 flex-col items-center gap-5 border-r border-app-border bg-app-sidebar py-4 sm:w-16"><BrandMark /><div className="rounded-lg bg-app-selected p-2"><MapPinned className="size-4" aria-hidden="true" /></div>{[Package, Truck, Users].map((Icon, i) => <Icon key={i} className="size-4 text-app-muted" aria-hidden="true" />)}<Settings2 className="mt-auto size-4 text-app-muted" aria-hidden="true" /></div>
        <div className="relative min-w-0 flex-1 overflow-hidden bg-[#f0f2ef]">
          <PreviewMap />
          <div className="absolute right-3 top-3 hidden items-center gap-2 rounded-full border border-app-border bg-white px-3 py-2 text-[10px] text-app-muted shadow-sm sm:flex"><Search className="size-3" aria-hidden="true" /><span>Search your workspace</span></div>
          <OrderActivityPreview />
        </div>
      </div>
    </div>
    <p className="mt-3 text-center text-[11px] text-app-muted">Workspace preview · sample data</p>
  </div>;
}
