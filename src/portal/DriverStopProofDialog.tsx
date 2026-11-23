import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogBody, DialogHeader } from '../components/ui/Dialog';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { VisitControls } from './DriverOrderDialog';
import type { DriverDayStop, DriverRoute } from './driverDayPlan';

/** Upload POD for the arrived delivery, with the same proof rules as order details. */
export function DriverStopProofDialog({ slug, row, route, onClose }: { slug: string; row: DriverDayStop; route: DriverRoute; onClose: () => void }) {
  useEntityDialog(true, onClose);
  const cache = useQueryClient();
  const done = async () => {
    await Promise.all(['driver-orders', 'driver-routes', 'driver-profile'].map(key => cache.invalidateQueries({ queryKey: [key, slug] })));
    onClose();
  };
  return <Dialog size="form" onClose={onClose}>
    <DialogHeader title="Upload POD" description={`${row.order.number} · Delivery · ${row.stop.address.text}`} onClose={onClose} />
    <DialogBody>
      <ol>{row.visit && <VisitControls slug={slug} route={route} visit={row.visit} current report={false} onChange={done} />}</ol>
    </DialogBody>
  </Dialog>;
}
