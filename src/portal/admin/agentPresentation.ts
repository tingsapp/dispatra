import { Bot, Compass, ShieldCheck } from 'lucide-react';
import type { AgentName, AgentStatus } from '../api';

export const AGENTS: Record<AgentName, { name: string; description: string; icon: typeof Bot }> = {
  ORDER: { name: 'Order agent', description: 'Email intake and booking validation', icon: Bot },
  DISPATCH: { name: 'Dispatch agent', description: 'Driver feasibility and assignment', icon: Compass },
  TECHNICAL: { name: 'Technical agent', description: 'Platform checks and approved repairs', icon: ShieldCheck },
};
export function agentLabel(item: AgentStatus) {
  return item.stale ? 'Progress overdue' : !item.run ? 'Not started' : ({ QUEUED: 'Queued', RUNNING: 'Working', SUCCEEDED: 'Run completed', FAILED: 'Run failed' } as const)[item.run.status];
}
