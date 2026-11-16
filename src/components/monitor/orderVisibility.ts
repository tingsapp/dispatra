import type { Job } from '../../types';
import { orderLifecycle } from '../../domain/validation';
import { createdDay } from './todaysPlanData';

/** Map visibility is a session view preference, independent of an order's operational state. */
export const isActiveMonitorOrder = (job: Job) => !['COMPLETED', 'CANCELLED'].includes(orderLifecycle(job));

/** The live Monitor map shows the Active orders panel's day: active orders created on the company's current day. */
export const isTodaysMonitorOrder = (job: Job, today: string, timeZone: string) => isActiveMonitorOrder(job) && createdDay(job, timeZone) === today;
