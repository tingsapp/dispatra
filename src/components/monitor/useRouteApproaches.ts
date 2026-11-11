import { useQueries } from '@tanstack/react-query';
import { operations, type Route } from '../../operations/api';
import type { Job } from '../../types';
import type { MapVehicle } from './mapLocations';

/** One approach per assigned route; hiding its next order also hides its approach. */
export function useRouteApproaches(slug: string | null, routes: Route[], jobs: Job[], vehicles: MapVehicle[], active: boolean) {
  const visibleStops = new Set(jobs.flatMap(job => job.pricingInput?.stops.map(stop => stop.id) ?? []));
  const visibleRoutes = routes.filter(route => {
    const next = [...route.stops].sort((a, b) => a.position - b.position).find(stop => stop.status !== 'COMPLETED');
    return ['PLANNED', 'IN_PROGRESS'].includes(route.status) && next && visibleStops.has(next.stop_id);
  });
  const queries = useQueries({ queries: visibleRoutes.map(route => {
    const vehicle = vehicles.find(row => row.id === route.vehicle_id);
    return {
      queryKey: ['operations', slug, 'route-approach', route.id, route.version, route.generation,
        vehicle?.source, vehicle?.lat, vehicle?.lng],
      queryFn: () => operations.routeApproach(slug!, route.id),
      enabled: !!slug && active, staleTime: 30_000, gcTime: 60_000,
      refetchInterval: active ? 30_000 : false as const,
      retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    };
  }) });
  return {
    paths: queries.flatMap((query, index) => !query.isError && query.data?.points.length
      ? [{ id: visibleRoutes[index].id, ...query.data }] : []),
    failed: queries.filter(query => query.isError).length,
  };
}
