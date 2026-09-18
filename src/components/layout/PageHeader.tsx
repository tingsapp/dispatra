import { ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';

export function PageHeader({ title, description, onBackToMonitor, actions }: { title: string; description: string; onBackToMonitor: () => void; actions?: ReactNode }) {
  return <header className="page-content shrink-0 border-b border-slate-200 bg-white py-5">
    <div className="min-h-5 pr-12 mb-3">
      <button type="button" onClick={onBackToMonitor} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
        <ArrowLeft className="h-3.5 w-3.5" />Back to Monitor
      </button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0 flex-1 basis-64">
        <h1 className="text-xl font-semibold leading-7 text-slate-900">{title}</h1>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </header>;
}
