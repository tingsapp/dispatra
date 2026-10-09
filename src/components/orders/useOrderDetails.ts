import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { allOperations, operations } from '../../operations/api';
import { changeAssignment } from '../../operations/assignment';
import { apiPricingContext } from '../../operations/pricingAdapters';
import { api } from '../../portal/api';
import { companySettingsKey } from '../../portal/WorkspaceAccount';
import { loadPricingContext } from '../../lib/orderPricing';
import { validateAssignment } from '../../lib/organizationWorkflows';
import { orderEditable, orderLifecycle } from '../../domain/validation';
import { confirmDialog } from '../ui/ConfirmDialog';
import type { Driver, Job } from '../../types';

/** Company pricing context from API settings, catalogue, Rate Cards and Shippers (shared query cache). Null until loaded or outside a company. */
export function useCompanyPricingContext(slug: string | null | undefined) {
  const settings = useQuery({ queryKey: companySettingsKey(slug!), queryFn: () => api.companySettings(slug!), enabled: !!slug });
  const catalog = useQuery({ queryKey: ['operations', slug, 'catalog'], queryFn: () => allOperations.catalog(slug!), enabled: !!slug });
  const rates = useQuery({ queryKey: ['operations', slug, 'rates'], queryFn: () => allOperations.rates(slug!), enabled: !!slug });
  const shippers = useQuery({ queryKey: ['operations', slug, 'shippers'], queryFn: () => allOperations.shippers(slug!), enabled: !!slug });
  const ctx = useMemo(() => settings.data && catalog.data && rates.data && shippers.data ? apiPricingContext(settings.data, catalog.data, rates.data, shippers.data) : null,
    [settings.data, catalog.data, rates.data, shippers.data]);
  return { ctx, settings, catalog, rates, shippers };
}

/** Driver (re)assignment shared by the Orders list and the Monitor. Resolves `{}` when saved through the API,
 *  `{ updated }` for a local prototype change, or null when nothing changed. */
export function useOrderAssignment({ slug, jobs, drivers, onUpdateJob, onNotification }: {
  slug: string | null | undefined; jobs: Job[]; drivers: Driver[]; onUpdateJob: (job: Job) => void; onNotification: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: ['operations', slug, 'orders'], queryFn: () => allOperations.orders(slug!), enabled: !!slug });
  const routes = useQuery({ queryKey: ['operations', slug, 'routes'], queryFn: () => allOperations.routes(slug!), enabled: !!slug });
  return async (job: Job, driverId: string): Promise<{ updated?: Job } | null> => {
    if (slug) {
      const record = orders.data?.find(row => row.id === job.id);
      if (!record) return null;
      try {
        const selectedDriver = driverId === 'unassigned' ? undefined : drivers.find(row => row.id === driverId);
        if (driverId !== 'unassigned' && !selectedDriver?.currentVehicleId) throw new Error('The driver needs an attached vehicle.');
        const route = record.route_id ? routes.data?.find(row => row.id === record.route_id) : undefined;
        if (driverId === 'unassigned' && !route) return null;
        if (route && driverId === route.driver_id) return null;
        if (route) {
          const affected = orders.data?.filter(row => row.route_id === route.id).length ?? 1;
          if (!(await confirmDialog({ title: driverId === 'unassigned' ? 'Release route?' : 'Change driver?', message: affected > 1 ? `This planned route has ${affected} orders. Releasing it will leave the other orders unassigned.` : 'The planned route will be released before the assignment changes.', confirmLabel: driverId === 'unassigned' ? 'Release route' : 'Change driver' }))) return null;
        }
        await changeAssignment(slug, record, driverId === 'unassigned' ? null : driverId, selectedDriver?.currentVehicleId ?? null, route);
        onNotification('Assignment saved.');
        return {};
      } catch (error) { onNotification(error instanceof Error ? error.message : 'Could not change assignment.'); return null; }
      finally { await Promise.all([queryClient.invalidateQueries({ queryKey: ['operations', slug, 'orders'] }), queryClient.invalidateQueries({ queryKey: ['operations', slug, 'routes'] }), queryClient.invalidateQueries({ queryKey: ['operations', slug, 'monitor'] })]); }
    }
    if (!orderEditable(job)) { onNotification('This order is locked for operational changes.'); return null; }
    const driver = drivers.find((d) => d.id === driverId);
    if (driver) { const errors = validateAssignment(job, driver, jobs, loadPricingContext()); if (errors.length) { onNotification(errors.join(' ')); return null; } }
    const updated: Job = {
      ...job,
      assignedDriverId: driverId === 'unassigned' ? undefined : driverId,
      driverName: driver ? driver.name : undefined,
      lifecycleStatus: driverId === 'unassigned' ? 'NEW' : 'ASSIGNED',
      version: (job.version ?? 1) + 1,
      status: driverId === 'unassigned' ? 'no_driver' : 'on_time',
      statusLabel: driverId === 'unassigned' ? 'No Driver' : 'On Time',
      riskText: driver ? `Assigned to ${driver.name} (${driver.id})` : 'Needs dispatch'
    };
    onUpdateJob(updated);
    onNotification(`Job ${job.jobNumber} reassigned to ${driver ? `${driver.name} (${driver.id})` : 'Unassigned'}`);
    return { updated };
  };
}

/** A dispatcher can complete an assigned or in-progress Order by hand, without driver proof of delivery. */
export const orderCompletable = (job: Job) => ['ASSIGNED', 'IN_PROGRESS'].includes(orderLifecycle(job));

/** Manual completion shared by the Orders list and the Monitor. Resolves like `useOrderAssignment`. */
export function useOrderCompletion({ slug, onUpdateJob, onNotification }: {
  slug: string | null | undefined; onUpdateJob: (job: Job) => void; onNotification: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: ['operations', slug, 'orders'], queryFn: () => allOperations.orders(slug!), enabled: !!slug });
  return async (job: Job): Promise<{ updated?: Job } | null> => {
    if (!orderCompletable(job)) return null;
    if (!(await confirmDialog({ title: 'Complete order?', message: `${job.jobNumber} will be marked Completed.`, confirmLabel: 'Complete order' }))) return null;
    if (slug) {
      const record = orders.data?.find(row => row.id === job.id);
      if (!record) return null;
      try {
        await operations.completeOrder(slug, record);
        onNotification(`${job.jobNumber} completed.`);
        return {};
      }
      catch (error) { onNotification(error instanceof Error ? error.message : 'Could not complete the order.'); return null; }
      finally { await Promise.all([queryClient.invalidateQueries({ queryKey: ['operations', slug, 'orders'] }), queryClient.invalidateQueries({ queryKey: ['operations', slug, 'routes'] }), queryClient.invalidateQueries({ queryKey: ['operations', slug, 'monitor'] })]); }
    }
    const updated: Job = { ...job, lifecycleStatus: 'COMPLETED', status: 'completed', statusLabel: 'Completed', version: (job.version ?? 1) + 1 };
    onUpdateJob(updated);
    onNotification(`${job.jobNumber} completed.`);
    return { updated };
  };
}
