import { orderLifecycle } from '../domain/validation';
import { Job } from '../types';

const completed = (job: Job) => ['COMPLETED', 'INVOICED'].includes(orderLifecycle(job));

/** Stamp the completion time once, when an order first becomes completed. */
export function freezeCompletedOrder(previous: Job | undefined, next: Job, now = new Date()): Job {
  if (!completed(next)) return next;
  return { ...next, completedAt: next.completedAt ?? (previous && completed(previous) ? previous.completedAt : undefined) ?? now.toISOString() };
}
