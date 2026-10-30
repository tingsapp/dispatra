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

/** Creation timestamps come from the saved order, never the scheduled delivery date. */
export function createdDay(job: Job, timeZone: string): string | undefined {
  if (!job.createdAt) return undefined;
  const date = new Date(job.createdAt);
  return Number.isFinite(date.getTime()) ? companyDay(date, timeZone) : undefined;
}

export function todaysPlan(jobs: Job[], today: string, timeZone: string, attentionIds: ReadonlySet<string>) {
  const all = jobs.filter(job => orderLifecycle(job) !== 'CANCELLED' && createdDay(job, timeZone) === today)
    .sort((a, b) => Date.parse(b.createdAt!) - Date.parse(a.createdAt!) || a.id.localeCompare(b.id));
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
