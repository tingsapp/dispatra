import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, MessageSquare } from 'lucide-react';
import { ADMIN_CHAT } from '../../chat/api';
import { operations } from '../../operations/api';
import { api } from '../../portal/api';

type Notice = { id: string; title: string; conversation_id?: string | null; read_at: string | null; kind: string };
/** Persisted bell notifications are authoritative; this live banner never replays old notices on login. */
export function IncomingChatNotice({ slug, accountId, onOpen }: { slug: string; accountId?: string; onOpen: (id: string) => void }) {
  const admin = slug === ADMIN_CHAT;
  const company = useQuery({ queryKey: ['notifications', slug], queryFn: () => operations.notifications(slug), enabled: !admin });
  const platform = useQuery({ queryKey: ['platform', 'notifications', accountId], queryFn: api.platformNotifications, enabled: admin, refetchInterval: 4_000 });
  const rows: Notice[] | undefined = admin ? platform.data?.items : company.data;
  const seen = useRef<Set<string> | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    if (!rows) return;
    const previous = seen.current;
    seen.current = new Set(rows.map(row => row.id));
    if (!previous) return;
    const incoming = rows.find(row => row.kind === 'message.created' && row.conversation_id && !row.read_at && !previous.has(row.id));
    if (incoming) setNotice(incoming);
    else setNotice(current => current && rows.some(row => row.id === current.id && !row.read_at) ? current : null);
  }, [rows]);
  if (!notice?.conversation_id) return null;
  return <div role="status" className="fixed bottom-5 right-5 z-[80] flex max-w-[calc(100vw-40px)] items-center gap-3 rounded-xl border border-app-border bg-white p-4 shadow-lg">
    <MessageSquare className="size-5 shrink-0" />
    <button type="button" className="text-left" onClick={() => { onOpen(notice.conversation_id!); setNotice(null); }}><span className="block text-sm font-medium">{notice.title}</span><span className="text-xs text-app-muted">Open conversation</span></button>
    <button type="button" aria-label="Dismiss message notification" onClick={() => setNotice(null)}><X className="size-4" /></button>
  </div>;
}
