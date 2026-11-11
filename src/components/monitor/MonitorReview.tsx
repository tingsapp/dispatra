import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { operations } from '../../operations/api';
import { dateTime } from '../../lib/dateTimeFormat';
import { EMAIL_DRAFT_STATUSES } from '../orders/EmailIntake';
import { TmsReview } from '../integrations/TmsReview';
import { useEntityDialog } from '../entities/useEntityDialog';
import { Dialog, DialogBody, DialogHeader } from '../ui/Dialog';
import { Button } from '../ui/button';

export function useMonitorReview(slug: string | null) {
  const drafts = useQuery({ queryKey: ['operations', slug, 'email-intakes', 'drafts'], queryFn: () => operations.emailIntakes(slug!, EMAIL_DRAFT_STATUSES), enabled: !!slug });
  const imports = useQuery({ queryKey: ['operations', slug, 'tms-inbox'], queryFn: () => operations.tmsInbox(slug!), enabled: !!slug, refetchInterval: 30_000 });
  return { drafts, imports };
}

type Review = ReturnType<typeof useMonitorReview>;
export function MonitorReviewNotice({ review, onOpen }: { review: Review; onOpen: () => void }) {
  const count = (review.drafts.data?.length ?? 0) + (review.imports.data?.length ?? 0);
  const failed = review.drafts.isError || review.imports.isError;
  const pending = review.drafts.isPending || review.imports.isPending;
  // The email endpoint returns at most 200 records. Do not present a capped count as a total.
  const capped = (review.drafts.data?.length ?? 0) >= 200 || (review.imports.data?.length ?? 0) >= 50;
  if (!count && !failed && !pending) return null;
  return <div className="mx-3 mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
    <div role="status" aria-live="polite" aria-atomic="true" className="flex items-start gap-2">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{count ? `${count}${capped ? '+' : ''} ${count === 1 ? 'order needs' : 'orders need'} review` : failed ? 'Review queue unavailable' : 'Checking incoming orders…'}</p>
        <p className="mt-1 text-xs">{count ? 'Incomplete requests are waiting for dispatch review.' : failed ? 'Open the queue to try again.' : 'Checking for incomplete requests.'}</p>
        {!!count && (failed || pending) && <p className="mt-1 text-xs">Some sources are {failed ? 'unavailable' : 'still loading'}.</p>}
      </div>
    </div>
    <Button className="mt-2" size="sm" onClick={onOpen}>Review requests <ChevronRight className="size-3" /></Button>
  </div>;
}

export function MonitorReviewDialog({ slug, review, timeZone, onClose, onOpenDraft }: {
  slug: string; review: Review; timeZone?: string; onClose: () => void; onOpenDraft: (id: string) => void;
}) {
  useEntityDialog(true, onClose);
  const rows = [...(review.drafts.data ?? [])].sort((a, b) => a.received_at.localeCompare(b.received_at));
  return <Dialog size="lg" onClose={onClose}>
    <DialogHeader title="Requests needing review" description="These requests have not become orders. Review the missing details before dispatch." onClose={onClose} />
    <DialogBody className="space-y-4">
      {(review.drafts.isPending || review.imports.isPending) && <p role="status">Loading requests…</p>}
      {(review.drafts.isError || review.imports.isError) && <div role="alert">Some requests could not be loaded. <Button variant="outline" onClick={() => Promise.all([review.drafts.refetch(), review.imports.refetch()])}>Try again</Button></div>}
      {rows.length > 0 && <section aria-label="Email drafts">
        <h4 className="mb-2 text-sm font-medium">Email drafts</h4>
        {rows.length >= 200 && <p className="mb-2 text-xs text-app-muted">Showing the latest 200 drafts. More may be waiting.</p>}
        <ul className="space-y-2">{rows.map(row => <li key={row.id}>
          <button type="button" aria-haspopup="dialog" onClick={() => onOpenDraft(row.id)} className="w-full rounded-xl border border-app-border p-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-app-accent">
            <span className="flex items-center justify-between gap-3"><span className="font-medium">{row.shipper_name || row.from_name || row.from_address}</span><ChevronRight className="size-4 shrink-0" /></span>
            <span className="mt-1 block text-xs text-app-muted">Email · {dateTime(row.received_at, timeZone)} · {row.subject || 'No subject'}</span>
            <span className="mt-2 block text-xs text-amber-800">{row.status === 'UNKNOWN_SENDER' ? 'Shipper needs confirmation. ' : ''}{row.missing.join(' · ') || row.summary || 'Details need review.'}</span>
            {row.completion_requested_at && <span className="mt-1 block text-xs text-app-muted">{row.completion_submitted_at ? 'Shipper supplied details — ready for review' : 'Waiting for shipper details'}</span>}
          </button>
        </li>)}</ul>
      </section>}
      <TmsReview slug={slug} />
      {review.drafts.isSuccess && review.imports.isSuccess && !rows.length && !review.imports.data?.length && <p>No requests need review.</p>}
    </DialogBody>
  </Dialog>;
}
