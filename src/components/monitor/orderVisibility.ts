import type { Job } from '../../types';
import { orderLifecycle } from '../../domain/validation';

/** Map visibility is a session view preference, independent of an order's operational state. */
export const isActiveMonitorOrder = (job: Job) => !['COMPLETED', 'CANCELLED'].includes(orderLifecycle(job));
