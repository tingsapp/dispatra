import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../ui';

/** Cursor history replaces the visible page instead of accumulating records on the canvas. */
export function useMonitorPages() {
  const [cursors, setCursors] = useState<string[]>([]);
  return { before: cursors.at(-1), page: cursors.length + 1,
    earlier: (cursor: string) => setCursors(current => [...current, cursor]),
    newer: () => setCursors(current => current.slice(0, -1)), latest: () => setCursors([]) };
}

export function MonitorPagination({ page, count, next, busy, label, onEarlier, onNewer }: {
  page: number; count: number; next?: string | null; busy: boolean; label: 'logs' | 'reports'; onEarlier: (cursor: string) => void; onNewer: () => void;
}) {
  if (page === 1 && !next) return null;
  return <footer className="flex flex-wrap items-center justify-between gap-3 pt-2">
    <p className="text-xs text-app-muted">Page {page} <span className="mx-1">·</span> {count} {label === 'logs' ? 'entries' : 'reports'}</p>
    <div className="flex max-w-full flex-wrap gap-2">
      <Button type="button" variant="ghost" size="sm" disabled={page === 1 || busy} onClick={onNewer}><ArrowLeft size={14} />Newer {label}</Button>
      <Button type="button" variant="ghost" size="sm" disabled={!next || busy} onClick={() => next && onEarlier(next)}><ArrowRight size={14} />Earlier {label}</Button>
    </div>
  </footer>;
}
