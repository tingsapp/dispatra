import type { Job } from '../../types';
import { orderLifecycle } from '../../domain/validation';
import { isTodaysOrder } from './todaysPlanData';

/** Map visibility is a session view preference, independent of an order's operational state. */
export const isActiveMonitorOrder = (job: Job) => !['COMPLETED', 'CANCELLED'].includes(orderLifecycle(job));

/** The live Monitor map shows active orders scheduled for the current company day. */
export const isTodaysMonitorOrder = (job: Job, today: string, timeZone: string) => isActiveMonitorOrder(job) && isTodaysOrder(job, today, timeZone);
