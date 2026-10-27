import type { AgentActivity, OperationalIncident, TechnicalIssue } from '../api';

export type AgentFeedEntry =
  | { kind: 'technical'; key: string; row: TechnicalIssue }
  | { kind: 'operational'; key: string; row: OperationalIncident }
  | { kind: 'event'; key: string; row: AgentActivity; count: number };

export const technicalStatus: Record<TechnicalIssue['status'], string> = {
  NEEDS_ADMIN: 'Needs investigation', AWAITING_APPROVAL: 'Awaiting approval', APPROVED: 'Approved · queued', APPLYING: 'Repair in progress',
  FAILED: 'Repair failed', FIXED: 'Fixed', REJECTED: 'Dismissed', SUPERSEDED: 'State changed',
};
export const operationalStatus = { OPEN: 'Needs attention', ACKNOWLEDGED: 'Acknowledged · still open', RESOLVED: 'Resolved', SUPERSEDED: 'Plan changed' };
export const certaintyLabel = { OBSERVED: 'Recorded fact', PREDICTED: 'Prediction', REPORTED: 'Reported by a person', NEEDS_CONFIRMATION: 'Needs confirmation' };

/** Saved issue statuses determine what is open; recent log events are history only. */
export function agentFeed(technical: TechnicalIssue[], operational: OperationalIncident[], activity: AgentActivity[], now = Date.now()): AgentFeedEntry[] {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const logs = [...new Map(activity.map(row => [row.id, row])).values()]
    .filter(row => row.level !== 'INFO' && Date.parse(row.created_at) >= cutoff)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id));
  const events = new Map<string, Extract<AgentFeedEntry, { kind: 'event' }>>();
  for (const row of logs) {
    // The run summary repeats the useful error already recorded for that run.
    if (row.message === 'Run completed with errors' && logs.some(other => other.run_id === row.run_id && other.id !== row.id && other.level === 'ERROR' && other.message !== row.message)) continue;
    const key = JSON.stringify([row.agent, row.organization_id, row.level, row.message]);
    const previous = events.get(key);
    if (previous) previous.count += 1;
    else events.set(key, { kind: 'event', key: `event:${encodeURIComponent(key)}`, row, count: 1 });
  }
  const entries: AgentFeedEntry[] = [
    ...technical.filter(row => ['NEEDS_ADMIN', 'AWAITING_APPROVAL', 'APPROVED', 'APPLYING', 'FAILED'].includes(row.status))
      .map(row => ({ kind: 'technical' as const, key: `technical:${row.id}`, row })),
    ...operational.filter(row => row.status === 'OPEN' || row.status === 'ACKNOWLEDGED')
      .map(row => ({ kind: 'operational' as const, key: `operational:${row.id}`, row })),
  ];
  // Always prioritize saved open issues; recent events never replace their current state.
  return [
    ...[...new Map([...entries].reverse().map(entry => [entry.key, entry])).values()]
      .sort((a, b) => Date.parse(b.row.created_at) - Date.parse(a.row.created_at) || a.key.localeCompare(b.key)),
    ...[...events.values()].slice(0, 20),
  ];
}
