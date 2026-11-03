import { MapPin } from 'lucide-react';
import type { Job } from '../../types';

/** A marker control that focuses the order's location on the Monitor. */
export function OrderMapFocusButton({ job, onLocate }: { job: Job; onLocate: () => void }) {
  return <button type="button" aria-label={`Focus ${job.jobNumber} on map`} title="Focus on map" onClick={onLocate}
    className="mb-1 flex size-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-slate-500">
    <MapPin size={15} aria-hidden="true" />
  </button>;
}
