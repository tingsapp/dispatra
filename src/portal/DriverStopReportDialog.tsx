import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogBody, DialogHeader } from '../components/ui/Dialog';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { operations } from '../operations/api';
import { DriverChoiceBadges } from './DriverChoiceBadges';
import { driverIssueDescription, driverIssueKind, driverReportChoices, type DriverReportSelection } from './driverReportOptions';
import type { DriverDayStop } from './driverDayPlan';
import { Button, Notice } from './ui';

export function DriverStopReportDialog({ slug, row, onClose }: { slug: string; row: DriverDayStop; onClose: () => void }) {
  const [reason, setReason] = useState<DriverReportSelection>('');
  const [description, setDescription] = useState('');
  const cache = useQueryClient();
  const report = useMutation({
    mutationFn: () => {
      if (!reason) throw new Error('Choose what is happening before sending the report.');
      return operations.reportStopIssue(slug, row.stop.id, driverIssueKind(reason, row.stop.kind), driverIssueDescription(reason, description));
    },
    onSuccess: async () => {
      await Promise.all(['driver-orders', 'driver-routes'].map(key => cache.invalidateQueries({ queryKey: [key, slug] })));
      onClose();
    },
  });
  const close = useCallback(() => { if (!report.isPending) onClose(); }, [onClose, report.isPending]);
  useEntityDialog(true, close);
  const stopName = row.stop.kind === 'PICKUP' ? 'Pickup' : 'Delivery';
  return <Dialog size="form" onClose={close}>
    <DialogHeader title="Report a stop issue" description={`${row.order.number} · ${stopName} · ${row.stop.address.text}`} onClose={close} closeDisabled={report.isPending} />
    <DialogBody>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); report.mutate(); }}>
        <DriverChoiceBadges choices={driverReportChoices} value={reason} disabled={report.isPending} onSelect={setReason} />
        <label className="block text-sm font-medium">Additional details (optional)
          <textarea className="app-input mt-1 min-h-28 w-full" value={description} onChange={event => setDescription(event.target.value)}
            maxLength={1900} disabled={report.isPending} placeholder="Add context that will help dispatch respond" />
        </label>
        <Notice error={report.error} />
        <Button type="submit" loading={report.isPending} disabled={report.isPending || !reason}>
          {report.isPending ? 'Sending report…' : 'Send report'}
        </Button>
      </form>
    </DialogBody>
  </Dialog>;
}
