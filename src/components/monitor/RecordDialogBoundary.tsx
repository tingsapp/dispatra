import { useEffect, useRef } from 'react';
import { useEntityDialog } from '../entities/useEntityDialog';
import { Dialog, DialogBody, DialogHeader } from '../ui/Dialog';
import { Button } from '../ui/button';

/** Loading, failed/deleted records and dismissal for shared page dialogs hosted on the map. */
export function RecordDialogBoundary({ open, pending, error, onRetry, onClose }: {
  open: boolean; pending: boolean; error?: unknown; onRetry: () => unknown; onClose: () => void;
}) {
  const opened = useRef(false);
  useEffect(() => {
    if (open) opened.current = true;
    else if (opened.current) onClose();
  }, [open, onClose]);
  const waiting = !open && !opened.current;
  useEntityDialog(waiting, onClose);
  if (!waiting) return null;
  return <Dialog onClose={onClose}>
    <DialogHeader title="Record details" onClose={onClose} />
    <DialogBody>
      {pending ? <p role="status">Loading details…</p> : <>
        <p role="alert">{error instanceof Error ? error.message : 'This record is no longer available.'}</p>
        {!!error && <Button variant="outline" onClick={onRetry}>Try again</Button>}
      </>}
    </DialogBody>
  </Dialog>;
}
