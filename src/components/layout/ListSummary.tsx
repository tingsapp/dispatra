import type { LucideIcon } from 'lucide-react';

interface SummaryItem {
  label: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
}

/** Equal-sized summary cards aligned with the operational table below. */
export function ListSummary({ label, items }: { label: string; items: SummaryItem[] }) {
  return <dl aria-label={label} className="app-list-summary">
    {items.map(({ label, value, icon: Icon, description }) => <div key={label}>
      <dt><Icon className="app-list-summary-icon" aria-hidden="true" focusable="false" /><span>{label}</span></dt>
      <dd>{typeof value === 'number' ? value.toLocaleString() : value}</dd>
      {description && <dd className="app-list-summary-note">{description}</dd>}
    </div>)}
  </dl>;
}
