import type { Job } from '../../types';

export interface OrderMapVisibilityProps {
  hiddenOrderIds?: ReadonlySet<string>;
  onOrderVisibilityChange?: (id: string, visible: boolean) => void;
}

export function OrderMapCheckbox({ job, hiddenOrderIds, onOrderVisibilityChange }: OrderMapVisibilityProps & { job: Job }) {
  if (!onOrderVisibilityChange) return null;
  return <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-slate-100" title="Show order on map">
    <input type="checkbox" className="app-checkbox" aria-label={`Show ${job.jobNumber} on map`}
      checked={!hiddenOrderIds?.has(job.id)} onChange={event => onOrderVisibilityChange(job.id, event.target.checked)} />
  </label>;
}
