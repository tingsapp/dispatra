import { useQuery } from '@tanstack/react-query';
import { Camera, ClipboardList, MessageCircleQuestion } from 'lucide-react';
import type { components } from '../../portal/schema';
import { operations } from '../../operations/api';
import { evidenceUrl } from './ProofOfDelivery';
import { formatWhen } from './OrderDossierSections';
import { PhotoThumbnails } from '../ui/PhotoViewer';

type Update = components['schemas']['ProgressUpdateView'];

const RESPONSIBILITY = { SHIPPER: 'Shipper responsible', CARRIER: 'Carrier responsible', UNDECIDED: 'Responsibility undecided' } as const;
const STATUS: Record<Update['kind'], Partial<Record<Update['status'], [string, string]>>> = {
  QUESTION: { OPEN: ['Waiting for driver', 'border-amber-200 bg-amber-50 text-amber-800'], ANSWERED: ['Answered', 'border-slate-200 bg-white text-slate-700'], CLOSED: ['Closed', 'border-slate-200 bg-white text-slate-500'] },
  REPORT: { OPEN: ['Open', 'border-amber-200 bg-amber-50 text-amber-800'], RESOLVED: ['Resolved', 'border-slate-200 bg-white text-slate-500'] },
};
const place = (row: Update) => row.stop_kind ? `${row.stop_kind === 'PICKUP' ? 'Pickup' : 'Drop-off'}${row.address ? ` · ${row.address}` : ''}` : 'Whole order';

/** The Order's driver progress feed for dispatch, newest first: progress questions with the driver's answer, and stop
 * reports. Each shows its stop, reasons, who is responsible, the driver's notes and the photos (internal: never the shipper's). */
export function ProgressUpdates({ slug, orderId, timeZone }: { slug: string; orderId: string; timeZone: string }) {
  const feed = useQuery({ queryKey: ['progress-updates', slug, orderId], queryFn: () => operations.progressUpdates(slug, orderId) });
  if (feed.isPending) return <p role="status" className="text-sm text-slate-500">Loading progress updates…</p>;
  if (feed.error) return <p role="alert" className="text-sm text-red-700">{feed.error instanceof Error ? feed.error.message : 'Could not load progress updates.'}</p>;
  if (!feed.data.length) return <p className="text-sm text-slate-500">No progress updates yet. Questions sent to the driver and stop reports appear here.</p>;
  return <ol className="space-y-3" aria-label="Progress updates">
    {feed.data.map(row => {
      const [status, tone] = STATUS[row.kind][row.status] ?? [row.status, 'border-slate-200 bg-white text-slate-600'];
      const question = row.kind === 'QUESTION';
      const Icon = question ? MessageCircleQuestion : ClipboardList;
      const answered = !question || !!row.replied_at;
      return <li key={row.id} className="rounded-xl border border-slate-200 p-4 text-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"><Icon className="h-4 w-4" aria-hidden /></span>
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{question ? 'Progress question' : 'Stop report'}</p>
              <p className="truncate text-xs text-slate-500">{place(row)} · {question ? 'Asked' : 'Reported'} {formatWhen(row.at, timeZone)}{row.replied_at ? ` · Replied ${formatWhen(row.replied_at, timeZone)}` : ''}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${tone}`}>{status}</span>
        </div>
        {question && <p className="text-slate-700">{row.prompt}</p>}
        {answered && row.reasons.length > 0 && <div className={question ? 'rounded-lg bg-slate-50 p-3 space-y-2' : 'space-y-2'}>
          {question && <p className="text-xs font-medium text-slate-500">Driver’s answer</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            <ul className="contents" aria-label="Reasons">{row.reasons.map(reason => <li key={reason} className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-800 ring-1 ring-slate-200">{reason}</li>)}</ul>
            {row.responsibility && <span className="rounded-full px-2 py-0.5 text-xs text-slate-600">{RESPONSIBILITY[row.responsibility]}</span>}
          </div>
          {row.notes && <p className="whitespace-pre-line text-slate-700">“{row.notes}”</p>}
          {row.estimated_ready_at && <p className="text-xs text-slate-500">Expected ready {formatWhen(row.estimated_ready_at, timeZone)}</p>}
          {row.photo_ids.length > 0 && <div className="space-y-1.5">
            <p className="flex items-center gap-1 text-xs text-slate-500"><Camera className="h-3.5 w-3.5" aria-hidden />{row.photo_ids.length} photo{row.photo_ids.length === 1 ? '' : 's'}</p>
            <PhotoThumbnails thumbClassName="h-20 w-28 rounded-lg border border-slate-200 bg-white object-cover" photos={row.photo_ids.map((id, index) => ({ src: evidenceUrl(slug, id), alt: `Photo ${index + 1}, ${place(row)}`, caption: `${place(row)} · ${question ? 'Progress answer' : 'Stop report'}` }))} />
          </div>}
        </div>}
        {row.resolution && <p className="text-xs text-slate-500">Resolution: {row.resolution}</p>}
      </li>;
    })}
  </ol>;
}
