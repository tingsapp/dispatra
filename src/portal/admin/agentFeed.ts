import type { AgentActivity, OperationalIncident, TechnicalIssue } from '../api';

export type AgentFeedEntry =
  | { kind: 'technical'; key: string; row: TechnicalIssue }
  | { kind: 'operational'; key: string; row: OperationalIncident }
  | { kind: 'activity'; key: string; row: AgentActivity; entries: AgentActivity[] };

export const technicalStatus: Record<TechnicalIssue['status'], string> = {
  NEEDS_ADMIN: 'Needs investigation', AWAITING_APPROVAL: 'Awaiting approval', APPROVED: 'Approved · queued', APPLYING: 'Repair in progress',
  FAILED: 'Repair failed', FIXED: 'Fixed', REJECTED: 'Dismissed', SUPERSEDED: 'State changed',
};
export const operationalStatus = { OPEN: 'Needs attention', ACKNOWLEDGED: 'Acknowledged · still open', RESOLVED: 'Resolved', SUPERSEDED: 'Plan changed' };
export const certaintyLabel = { OBSERVED: 'Recorded fact', PREDICTED: 'Prediction', REPORTED: 'Reported by a person', NEEDS_CONFIRMATION: 'Needs confirmation' };

/** Saved issue statuses determine whether problems are still open; immutable logs cannot. */
export function agentFeed(technical: TechnicalIssue[], operational: OperationalIncident[], activity: AgentActivity[], allLevels = false): AgentFeedEntry[] {
  const logs = [...new Map([...activity.filter(row => allLevels || row.level === 'INFO')].reverse().map(row => [row.id, row])).values()]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
  const entries: AgentFeedEntry[] = [
    ...technical.filter(row => ['NEEDS_ADMIN', 'AWAITING_APPROVAL', 'APPROVED', 'APPLYING', 'FAILED'].includes(row.status))
      .map(row => ({ kind: 'technical' as const, key: `technical:${row.id}`, row })),
    ...operational.filter(row => row.status === 'OPEN' || row.status === 'ACKNOWLEDGED')
      .map(row => ({ kind: 'operational' as const, key: `operational:${row.id}`, row })),
    ...(logs.length ? [{ kind: 'activity' as const, key: 'activity', row: logs[logs.length - 1], entries: logs }] : []),
  ];
  // Page boundaries can overlap as new records arrive. Keep the first (freshest) copy.
  return [...new Map([...entries].reverse().map(entry => [entry.key, entry])).values()]
    .sort((a, b) => Date.parse(a.row.created_at) - Date.parse(b.row.created_at) || a.key.localeCompare(b.key));
}
