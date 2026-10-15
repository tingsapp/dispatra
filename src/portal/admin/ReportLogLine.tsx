import { clockTime } from '../../lib/dateTimeFormat';
import { formatWhen } from './format';

/** One saved report or activity, presented like a console entry; details stay in its native button. */
export function ReportLogLine({ title, company, severity, createdAt, status, certainty, source, expanded, controls, onClick }: {
  title: string; company: string | null; severity: 'WARNING' | 'CRITICAL' | 'INFO'; createdAt: string;
  status: string; certainty?: string; source?: string; expanded: boolean; controls?: string; onClick: () => void;
}) {
  return <button type="button" aria-label={`Details: ${title}`} aria-expanded={expanded} aria-controls={controls}
    onClick={onClick} className="agent-report-line">
    <time dateTime={createdAt} title={formatWhen(createdAt)} aria-label={formatWhen(createdAt)} className="agent-report-time">{clockTime(createdAt)}</time>
    <span className={`agent-report-level ${severity === 'INFO' ? 'text-app-accent' : severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}`}>{severity === 'INFO' ? 'Activity' : severity === 'CRITICAL' ? 'Error' : 'Warning'}</span>
    <span className="agent-report-message"><span className="block break-words text-[13px] leading-5 text-app-text">{title}</span>
      <span className="mt-0.5 flex min-w-0 gap-2 text-[11px] font-normal text-app-muted"><span className="min-w-0 truncate" title={company ?? 'Platform'}>{company ?? 'Platform'}</span>
        {source && <span className="shrink-0">{source}</span>}
        {certainty && <span className="shrink-0">{certainty}</span>}
      </span>
    </span>
    <span className="agent-report-status">{status}</span>
  </button>;
}
