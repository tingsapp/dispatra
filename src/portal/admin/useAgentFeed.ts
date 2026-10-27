import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, type AgentName } from '../api';
import { agentKeys } from './queryKeys';
import { agentFeed } from './agentFeed';

const polling = { initialPageParam: undefined as string | undefined, refetchInterval: 5_000, refetchOnWindowFocus: false };
const nextPage = (cursor: string | null, cursors: (string | undefined)[]) => cursor && !cursors.includes(cursor) ? cursor : undefined;

/** Drain open-report pages automatically so older unresolved problems remain visible. */
function useAllOpenPages(query: { hasNextPage: boolean; isFetching: boolean; isError: boolean; fetchNextPage: (options: { cancelRefetch: boolean }) => Promise<unknown> }, enabled: boolean) {
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    if (enabled && hasNextPage && !isFetching && !isError) void fetchNextPage({ cancelRefetch: false });
  }, [enabled, hasNextPage, isFetching, isError, fetchNextPage]);
}

export function useAgentFeed(accountId: string, agent?: AgentName) {
  const technicalEnabled = agent !== 'OPERATIONAL' && agent !== 'CHAT';
  const operationalEnabled = !agent || agent === 'OPERATIONAL';
  const technical = useInfiniteQuery({ ...polling, queryKey: [...agentKeys, 'reports', accountId, 'OPEN', agent],
    queryFn: ({ pageParam }) => api.technicalReports('OPEN', pageParam, 12, agent), getNextPageParam: (page, _pages, _last, cursors) => nextPage(page.next_before, cursors), enabled: technicalEnabled });
  const operational = useInfiniteQuery({ ...polling, queryKey: [...agentKeys, 'operational', accountId, 'OPEN'],
    queryFn: ({ pageParam }) => api.operationalIssues('OPEN', pageParam), getNextPageParam: (page, _pages, _last, cursors) => nextPage(page.next_before, cursors), enabled: operationalEnabled });
  // Server-side severity filters prevent routine heartbeats from crowding out real errors.
  const errors = useInfiniteQuery({ ...polling, queryKey: [...agentKeys, 'logs', accountId, agent, 'ERROR', 'recent'],
    queryFn: () => api.agentLogs(agent, 'ERROR', undefined, 25), getNextPageParam: () => undefined });
  const warnings = useInfiniteQuery({ ...polling, queryKey: [...agentKeys, 'logs', accountId, agent, 'WARNING', 'recent'],
    queryFn: () => api.agentLogs(agent, 'WARNING', undefined, 25), getNextPageParam: () => undefined });
  useAllOpenPages(technical, technicalEnabled);
  useAllOpenPages(operational, operationalEnabled);
  const rows = agentFeed(technicalEnabled ? technical.data?.pages.flatMap(page => page.items) ?? [] : [],
    operationalEnabled ? operational.data?.pages.flatMap(page => page.items) ?? [] : [], [...(errors.data?.pages.flatMap(page => page.items) ?? []), ...(warnings.data?.pages.flatMap(page => page.items) ?? [])]);
  const queries = [errors, warnings, ...(technicalEnabled ? [technical] : []), ...(operationalEnabled ? [operational] : [])];
  return { rows, queries, loadingReports: (technicalEnabled && technical.hasNextPage) || (operationalEnabled && operational.hasNextPage) };
}
