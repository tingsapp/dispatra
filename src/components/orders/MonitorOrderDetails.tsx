import { useState } from 'react';
import { OrderDetailsDialog } from './OrderDetailsDialog';
import { useCompanyPricingContext, useOrderAssignment, useOrderCompletion } from './useOrderDetails';
import { companySlugForCurrentPath } from '../../lib/pageRoutes';
import { loadPricingContext } from '../../lib/orderPricing';
import { useEntityDialog } from '../entities/useEntityDialog';
import type { Driver, Job } from '../../types';

/** The Orders list details dialog opened from the Monitor; editing continues on the Orders page. */
export function MonitorOrderDetails({ job, jobs, drivers, onClose, onEdit, onUpdateJob, onNotification }: {
  job: Job; jobs: Job[]; drivers: Driver[]; onClose: () => void; onEdit: (job: Job) => void;
  onUpdateJob: (job: Job) => void; onNotification: (message: string) => void;
}) {
  const slug = companySlugForCurrentPath();
  const { ctx } = useCompanyPricingContext(slug);
  const [localCtx] = useState(() => loadPricingContext());
  const reassign = useOrderAssignment({ slug, jobs, drivers, onUpdateJob, onNotification });
  const complete = useOrderCompletion({ slug, onUpdateJob, onNotification });
  const pricingCtx = slug ? ctx : localCtx;
  // Escape and focus trapping, as on the Orders page.
  useEntityDialog(!!pricingCtx, onClose);
  if (!pricingCtx) return null;
  // Read the current record so a local reassignment is reflected immediately.
  const current = jobs.find(row => row.id === job.id) ?? job;
  return <OrderDetailsDialog job={current} ctx={pricingCtx} drivers={drivers} onClose={onClose} onEdit={onEdit}
    onReassign={async (row, driverId) => { const result = await reassign(row, driverId); if (result && !result.updated) onClose(); }}
    onComplete={async row => { const result = await complete(row); if (result && !result.updated) onClose(); }} />;
}
