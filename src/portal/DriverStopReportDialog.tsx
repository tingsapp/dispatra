import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogBody, DialogHeader } from '../components/ui/Dialog';
import { useEntityDialog } from '../components/entities/useEntityDialog';
import { operations } from '../operations/api';
import { DriverChoiceBadges } from './DriverChoiceBadges';
import { driverReportProblem, notesRequired, reasonsForStop, toggleReason, useReportReasons } from './driverReportOptions';
import type { DriverDayStop } from './driverDayPlan';
import { Button, Notice } from './ui';

export function DriverStopReportDialog({ slug, row, onClose }: { slug: string; row: DriverDayStop; onClose: () => void }) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const list = useReportReasons(slug);
  const choices = reasonsForStop(list.data ?? [], row.stop.kind);
  const problem = driverReportProblem(reasons, description, choices);
  const cache = useQueryClient();
  const report = useMutation({
    mutationFn: () => {
      if (problem) throw new Error(problem);
      return operations.reportStopIssue(slug, row.stop.id, reasons, description);
    },
    onSuccess: async () => {
      await Promise.all(['driver-orders', 'driver-routes'].map(key => cache.invalidateQueries({ queryKey: [key, slug] })));
      onClose();
    },
  });
  const close = useCallback(() => { if (!report.isPending) onClose(); }, [onClose, report.isPending]);
  useEntityDialog(true, close);
  const stopName = row.stop.kind === 'PICKUP' ? 'Pickup' : 'Delivery';
  const other = notesRequired(reasons, choices);
  return <Dialog size="form" onClose={close}>
    <DialogHeader title="Report a stop issue" description={`${row.order.number} · ${stopName} · ${row.stop.address.text}`} onClose={close} closeDisabled={report.isPending} />
    <DialogBody>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); report.mutate(); }}>
        {list.isPending ? <p role="status" className="text-sm text-slate-500">Loading reasons…</p>
          : <DriverChoiceBadges choices={choices} value={reasons} disabled={report.isPending} onSelect={reason => setReasons(current => toggleReason(current, reason))} />}
        <label className="block text-sm font-medium">{other ? 'Additional details (required)' : 'Additional details (optional)'}
          <textarea className="app-input mt-1 min-h-28 w-full" value={description} onChange={event => setDescription(event.target.value)}
            maxLength={1900} disabled={report.isPending} required={other} placeholder="Add context that will help dispatch respond" />
        </label>
        {reasons.length > 0 && problem && <p className="text-sm text-slate-600">{problem}</p>}
        <Notice error={report.error || list.error} />
        <Button type="submit" loading={report.isPending} disabled={report.isPending || !!problem}>
          {report.isPending ? 'Sending report…' : 'Send report'}
        </Button>
      </form>
    </DialogBody>
  </Dialog>;
}
