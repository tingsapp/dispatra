import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, MessageSquare, Bell, AlertTriangle } from 'lucide-react';
import { ADMIN_CHAT } from '../../chat/api';
import { operations } from '../../operations/api';
import { api } from '../../portal/api';
import { BrandMark } from '../layout/AppBrand';

export type LiveNotice = { id: string; title: string; body: string; kind: string; severity: string; conversation_id?: string | null; order_id?: string | null; read_at: string | null };
export type LiveFeedback = { text: string; tone: 'default' | 'error' };
const VISIBLE = 3;
const SHOW_MS = 8_000;

/** Bottom-center stack, newest first: page feedback plus each new inbox notification (chat, orders, assignments, alerts).
 * Persisted bell notifications are authoritative; old notices never replay on login. Chat notices stay until read or dismissed. */
export function LiveNotices<T extends LiveNotice = LiveNotice>({ slug, accountId, onOpen, feedback }: {
  slug?: string | null; accountId?: string; onOpen: (row: T) => void; feedback?: LiveFeedback | null;
}) {
  const admin = slug === ADMIN_CHAT;
  const company = useQuery({ queryKey: ['notifications', slug], queryFn: () => operations.notifications(slug!), enabled: Boolean(slug) && !admin });
  const platform = useQuery({ queryKey: ['platform', 'notifications', accountId], queryFn: api.platformNotifications, enabled: admin, refetchInterval: 4_000 });
  // The caller picks the row type matching its account: company `AppNotification` or admin `PlatformNotification`.
  const rows = (admin ? platform.data?.items : company.data) as unknown as T[] | undefined;
  const seen = useRef<Set<string> | null>(null);
  const [notices, setNotices] = useState<T[]>([]);
  useEffect(() => {
    if (!rows) return;
    const previous = seen.current;
    seen.current = new Set(rows.map(row => row.id));
    if (!previous) return;
    // Rows arrive newest first; read elsewhere means no longer news.
    const incoming = rows.filter(row => !row.read_at && !previous.has(row.id));
    setNotices(current => [...incoming, ...current.filter(notice => rows.some(row => row.id === notice.id && !row.read_at))].slice(0, VISIBLE));
  }, [rows]);
  const dismiss = (id: string) => setNotices(current => current.filter(notice => notice.id !== id));
  if (!notices.length && !feedback) return null;
  return <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex flex-col items-center gap-2 px-4">
    {feedback && <div className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-xl bg-slate-900/95 px-4 py-2.5 text-xs font-medium text-white shadow-xl shadow-slate-900/20">
      <BrandMark size={16} /><span className={feedback.tone === 'error' ? 'text-rose-200' : undefined}>{feedback.text}</span>
    </div>}
    {notices.map(notice => <NoticeCard key={notice.id} notice={notice} onOpen={() => { onOpen(notice); dismiss(notice.id); }} onDismiss={() => dismiss(notice.id)} />)}
  </div>;
}

function NoticeCard({ notice, onOpen, onDismiss }: { notice: LiveNotice; onOpen: () => void; onDismiss: () => void }) {
  const chat = notice.kind === 'message.created' && Boolean(notice.conversation_id);
  useEffect(() => {
    if (chat) return;
    const timer = window.setTimeout(onDismiss, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [chat, notice.id]);
  const Icon = chat ? MessageSquare : notice.severity === 'INFO' ? Bell : AlertTriangle;
  return <div className="pointer-events-auto flex w-[min(380px,100%)] items-center gap-3 rounded-xl border border-app-border bg-white p-3 shadow-lg">
    <Icon className={`size-4 shrink-0 ${notice.severity === 'CRITICAL' ? 'text-rose-600' : notice.severity === 'WARNING' ? 'text-amber-600' : 'text-slate-700'}`} />
    <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
      <span className="block truncate text-sm font-medium">{notice.title}</span>
      <span className="block truncate text-xs text-app-muted">{chat ? 'Open conversation' : notice.body}</span>
    </button>
    <button type="button" aria-label="Dismiss notification" onClick={onDismiss}><X className="size-4" /></button>
  </div>;
}
