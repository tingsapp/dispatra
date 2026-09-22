import type { ComponentProps } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export function MetricTrigger({ icon: Icon, count, label, ...props }:
  ComponentProps<'button'> & { icon: LucideIcon; count: number; label: string }) {
  return <button {...props} type="button" className="app-metric group">
    <span className="app-metric-icon"><Icon aria-hidden="true" /></span>
    <span className="text-sm font-medium text-slate-900">{count}</span>
    <span className="app-metric-label text-sm text-slate-700 whitespace-nowrap">{label}</span>
    <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 transition-transform group-aria-expanded:rotate-180" />
  </button>;
}
