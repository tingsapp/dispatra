import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogBody, DialogHeader } from '../components/ui/Dialog';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { operations } from '../operations/api';
import { DriverChoiceBadges } from './DriverChoiceBadges';
import { driverIssueReport, driverReportChoices, driverReportReady, toggleReason, type DriverReportReason } from './driverReportOptions';
import type { DriverDayStop } from './driverDayPlan';
import { Button, Notice } from './ui';

export function DriverStopReportDialog({ slug, row, onClose }: { slug: string; row: DriverDayStop; onClose: () => void }) {
  const [reasons, setReasons] = useState<DriverReportReason[]>([]);
  const [description, setDescription] = useState('');
  const cache = useQueryClient();
  const report = useMutation({
    mutationFn: () => {
      const issue = driverIssueReport(reasons, row.stop.kind, description);
      return operations.reportStopIssue(slug, row.stop.id, issue.kind, issue.description);
    },
    onSuccess: async () => {
      await Promise.all(['driver-orders', 'driver-routes'].map(key => cache.invalidateQueries({ queryKey: [key, slug] })));
      onClose();
    },
  });
  const close = useCallback(() => { if (!report.isPending) onClose(); }, [onClose, report.isPending]);
  useEntityDialog(true, close);
  const stopName = row.stop.kind === 'PICKUP' ? 'Pickup' : 'Delivery';
  const other = reasons.includes('OTHER');
  return <Dialog size="form" onClose={close}>
    <DialogHeader title="Report a stop issue" description={`${row.order.number} · ${stopName} · ${row.stop.address.text}`} onClose={close} closeDisabled={report.isPending} />
    <DialogBody>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); report.mutate(); }}>
        <DriverChoiceBadges choices={driverReportChoices} value={reasons} disabled={report.isPending} onSelect={reason => setReasons(current => toggleReason(current, reason))} />
        <label className="block text-sm font-medium">{other ? 'Additional details (required for Another issue)' : 'Additional details (optional)'}
          <textarea className="app-input mt-1 min-h-28 w-full" value={description} onChange={event => setDescription(event.target.value)}
            maxLength={1900} disabled={report.isPending} required={other} placeholder="Add context that will help dispatch respond" />
        </label>
        <Notice error={report.error} />
        <Button type="submit" loading={report.isPending} disabled={report.isPending || !driverReportReady(reasons, description)}>
          {report.isPending ? 'Sending report…' : 'Send report'}
        </Button>
      </form>
    </DialogBody>
  </Dialog>;
}
