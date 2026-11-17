import { useQuery } from '@tanstack/react-query';
import { operations, type AssistantReply } from '../../operations/api';

export const briefingKey = (slug: string) => ['operations', slug, 'briefing'] as const;

/** Today's totals for an open briefing card; `/sync` invalidates them on order, route and incident changes. */
export function useLiveBriefing(slug: string | undefined, reply: AssistantReply) {
  const query = useQuery({ queryKey: briefingKey(slug ?? ''), queryFn: () => operations.briefing(slug!), enabled: !!slug && !!reply.briefing,
    refetchInterval: 60_000, refetchIntervalInBackground: false });
  const opening = reply.briefing ? { briefing: reply.briefing, observed_at: reply.observed_at } : undefined;
  return query.data && (!opening || Date.parse(query.data.observed_at) >= Date.parse(opening.observed_at)) ? query.data : opening;
}
