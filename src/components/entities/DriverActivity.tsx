import { useQuery } from '@tanstack/react-query';
import { companySlugForCurrentPath } from '../../lib/pageRoutes';
import { operations } from '../../operations/api';
import { Driver, Job } from '../../types';
import { connectivity } from '../../lib/driverStorage';
import { ReadFields } from './Fields';

/** Read-only app activity for this driver. */
export function DriverActivity({ driver, jobs }: { driver: Driver; jobs: Job[] }) {
  const slug = companySlugForCurrentPath();
  const activityQuery = useQuery({ queryKey: ['operations', slug, 'driver-activity', driver.id], queryFn: () => operations.driverActivity(slug!, driver.id), enabled: !!slug });
  const activity = activityQuery.data;
  // Show the route by its orders' public numbers, not its internal ID.
  const routeId = activity?.current_route ?? (slug ? undefined : driver.routeId);
  const routeOrders = routeId ? jobs.filter(job => job.routeId === routeId).map(job => job.jobNumber) : [];
  const currentRoute = routeId ? routeOrders.length ? routeOrders.join(', ') : 'Planned route' : undefined;

  return <section aria-label="Activity" className="space-y-4 text-sm">
    <h3 className="app-section-title">Activity</h3>
    <ReadFields values={{
      'App connectivity': activity ? activity.app_connectivity : slug ? 'Unknown' : connectivity(driver.appLastSeenAt),
      'App last seen': activity?.app_last_seen ?? (slug ? undefined : driver.appLastSeenAt),
      'GPS captured': activity?.gps_captured ?? (slug ? undefined : driver.locationCapturedAt),
      'Location permission': activity?.location_permission ?? (slug ? 'UNKNOWN' : driver.locationPermissionStatus ?? 'UNKNOWN'),
      'Current route': currentRoute,
    }} />
  </section>;
}
