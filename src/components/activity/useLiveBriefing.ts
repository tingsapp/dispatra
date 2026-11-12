import { useQuery } from '@tanstack/react-query';
import { operations, type AssistantReply, type BriefingTotals } from '../../operations/api';

export const briefingKey = (slug: string) => ['operations', slug, 'briefing'] as const;
type Counts = Omit<BriefingTotals['briefing'], 'day' | 'time_zone' | 'evening'>;
const sameCounts = (a: Counts, b: Counts) => (['received', 'unassigned', 'assigned', 'in_progress', 'completed', 'open_incidents'] as const).every(key => a[key] === b[key]);

/** Today's totals for an open briefing card; `/sync` invalidates them on order, route and incident changes. */
export function useLiveBriefing(slug: string | undefined, reply: AssistantReply) {
  const query = useQuery({ queryKey: briefingKey(slug ?? ''), queryFn: () => operations.briefing(slug!), enabled: !!slug && !!reply.briefing,
    refetchInterval: 60_000, refetchIntervalInBackground: false });
  const opening = reply.briefing ? { briefing: reply.briefing, observed_at: reply.observed_at } : undefined;
  const live = query.data && (!opening || Date.parse(query.data.observed_at) >= Date.parse(opening.observed_at)) ? query.data : opening;
  // The AI recommendation describes the opening totals; hide it once they change instead of showing stale advice.
  return live && { ...live, recommendation: opening && sameCounts(live.briefing, opening.briefing) ? reply.message : undefined };
}
