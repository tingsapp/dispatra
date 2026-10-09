import { MapPinned, MoreHorizontal, Package, Search, Settings2, Truck, Users } from 'lucide-react';
import { BrandMark } from '../layout/AppBrand';
import { OrderActivityPreview } from './OrderActivityPreview';

/** An illustrative Monitor view with sample orders, never live company data. */
export function MonitorPreview() {
  return <div aria-label="Illustrative dispatch workspace preview" className="relative mx-auto w-full max-w-2xl">
    <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-xl">
      <div className="flex items-center justify-between px-4 py-3"><div className="flex items-center gap-1.5" aria-hidden="true">{[0, 1, 2].map(i => <span key={i} className="size-2 rounded-full bg-slate-200" />)}</div><span className="text-[10px] text-app-muted">Dispatra / workspace</span><MoreHorizontal className="size-4 text-slate-400" aria-hidden="true" /></div>
      <div className="flex h-[340px] sm:h-[390px]">
        <div className="flex w-14 shrink-0 flex-col items-center gap-5 border-r border-app-border bg-app-sidebar py-4 sm:w-16"><BrandMark /><div className="rounded-lg bg-app-selected p-2"><MapPinned className="size-4" aria-hidden="true" /></div>{[Package, Truck, Users].map((Icon, i) => <Icon key={i} className="size-4 text-app-muted" aria-hidden="true" />)}<Settings2 className="mt-auto size-4 text-app-muted" aria-hidden="true" /></div>
        <div className="relative min-w-0 flex-1 overflow-hidden bg-[#f0f2ef]">
          <svg viewBox="0 0 700 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
            <rect width="700" height="500" fill="#f0f2ef" />
            <path d="M-30 405C100 350 130 480 255 420S410 440 440 540H-30Z" fill="#d8e7ef" />
            <path d="M550-20 730-20 730 300C640 280 580 160 550-20Z" fill="#d8e7ef" />
            <path d="M390 75h85v58h-85zM270 365h64v52h-64zM90 236h66v53H90z" fill="#dfe7dd" />
            <g stroke="white" strokeWidth="11" fill="none"><path d="M-50 64 720 354M-50 152 690 430M-50 245 700 528M90-50 90 550M200-50 200 550M310-50 310 550M420-50 420 550M530-50 530 550M640-50 640 550" /></g>
            <path d="M-50 325 750 130" fill="none" stroke="#dedfd9" strokeWidth="23" /><path d="M-50 325 750 130" fill="none" stroke="white" strokeWidth="16" />
            <g fill="#92988f" fontFamily="Inter, sans-serif" fontSize="10"><text x="275" y="84">MOUNT PLEASANT</text><text x="490" y="375">EAST VANCOUVER</text><text x="300" y="478">FRASER RIVER</text></g>
            <path d="M215 332V235Q215 209 240 203L411 161Q430 156 430 135V103" fill="none" stroke="#3b82f6" strokeOpacity="0.12" strokeWidth="13" strokeLinecap="round" />
            <path d="M215 332V235Q215 209 240 203L411 161Q430 156 430 135V103" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="215" cy="332" r="8" fill="white" stroke="#171717" strokeWidth="3" /><circle cx="430" cy="103" r="8" fill="#171717" stroke="white" strokeWidth="3" />
          </svg>
          <div className="absolute right-3 top-3 hidden items-center gap-2 rounded-full border border-app-border bg-white px-3 py-2 text-[10px] text-app-muted shadow-sm sm:flex"><Search className="size-3" aria-hidden="true" /><span>Search your workspace</span></div>
          <div className="absolute left-[55%] top-[28%] flex size-9 items-center justify-center rounded-xl border-2 border-white bg-blue-600 text-white shadow-md sm:top-[39%]"><Truck className="size-4" aria-hidden="true" /></div>
          <OrderActivityPreview />
        </div>
      </div>
    </div>
    <p className="mt-3 text-center text-[11px] text-app-muted">Workspace preview · sample data</p>
  </div>;
}
