import { Bot, MessageCircle, Compass, ShieldCheck, Radar } from 'lucide-react';
import type { AgentName, AgentStatus } from '../api';

export const AGENTS: Record<AgentName, { name: string; description: string; icon: typeof Bot }> = {
  CHAT: { name: 'Chat agent', description: 'Dispatra AI answers and workspace search', icon: MessageCircle },
  ORDER: { name: 'Order agent', description: 'Email intake and booking validation', icon: Bot },
  DISPATCH: { name: 'Dispatch agent', description: 'Driver feasibility and assignment', icon: Compass },
  OPERATIONAL: { name: 'Operational agent', description: 'Order risks, driver clarification and suggested responses', icon: Radar },
  TECHNICAL: { name: 'Technical agent', description: 'Platform checks and approved repairs', icon: ShieldCheck },
};
export function agentLabel(item: AgentStatus) {
  return item.stale ? 'Progress overdue' : !item.run ? 'Not started' : ({ QUEUED: 'Queued', RUNNING: 'Working', SUCCEEDED: 'Run completed', FAILED: 'Run failed' } as const)[item.run.status];
}
