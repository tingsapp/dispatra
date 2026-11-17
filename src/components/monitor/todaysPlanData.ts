import type { Job } from '../../types';
import { orderAttention, orderLifecycle } from '../../domain/validation';

export const PLAN_FILTERS = [
  { key: 'all', label: 'Orders today' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'attention', label: 'Needs attention' },
] as const;
export type PlanFilter = typeof PLAN_FILTERS[number]['key'];

export const companyDay = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
};

/** The company-local day of an order's scheduled pickup, never its creation time. */
export function pickupDay(job: Job, timeZone: string): string | undefined {
  const date = new Date(job.scheduledTime);
  return job.scheduledTime && Number.isFinite(date.getTime()) ? companyDay(date, timeZone) : undefined;
}

/** Today's work: orders picked up today, plus earlier pickups that are still open. Later pickups wait for their day. */
export function isTodaysOrder(job: Job, today: string, timeZone: string) {
  const day = pickupDay(job, timeZone), status = orderLifecycle(job);
  return !!day && status !== 'CANCELLED' && (day === today || day < today && status !== 'COMPLETED');
}

export function todaysPlan(jobs: Job[], today: string, timeZone: string, attentionIds: ReadonlySet<string>) {
  const all = jobs.filter(job => isTodaysOrder(job, today, timeZone))
    .sort((a, b) => Date.parse(a.scheduledTime) - Date.parse(b.scheduledTime) || a.id.localeCompare(b.id));
  const groups: Record<PlanFilter, Job[]> = {
    all,
    unassigned: all.filter(job => orderLifecycle(job) === 'NEW'),
    assigned: all.filter(job => orderLifecycle(job) === 'ASSIGNED'),
    in_progress: all.filter(job => orderLifecycle(job) === 'IN_PROGRESS'),
    completed: all.filter(job => orderLifecycle(job) === 'COMPLETED'),
    attention: all.filter(job => !['COMPLETED', 'CANCELLED'].includes(orderLifecycle(job)) && (attentionIds.has(job.id) || orderAttention(job).length > 0)),
  };
  return groups;
}

/** Completion is counted on its company-local day, independently of creation. */
export function ordersCompletedToday(jobs: Job[], today: string, timeZone: string): Job[] {
  return jobs.filter(job => {
    if (orderLifecycle(job) !== 'COMPLETED' || !job.completedAt) return false;
    const completed = new Date(job.completedAt);
    return Number.isFinite(completed.getTime()) && companyDay(completed, timeZone) === today;
  });
}
