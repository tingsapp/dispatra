import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OPEN_CHAT, type ChatTarget } from '../../chat/navigation';
import { resolveChatTarget } from '../../chat/selection';
import { Button } from '../ui/button';
import { ChatPopup } from './ChatPopup';
import { ChatThread } from './ChatThread';

/** Contact actions share one overlay without changing the current page or its URL. */
export function DispatcherChatPopup({ slug, timeZone }: { slug: string; timeZone?: string }) {
  const [target, setTarget] = useState<ChatTarget | null>(null);
  useEffect(() => {
    const open = (event: Event) => setTarget((event as CustomEvent<ChatTarget>).detail);
    window.addEventListener(OPEN_CHAT, open);
    return () => window.removeEventListener(OPEN_CHAT, open);
  }, []);
  return target && <ConversationPopup key={JSON.stringify(target)} slug={slug} target={target} timeZone={timeZone} onClose={() => setTarget(null)} />;
}

function ConversationPopup({ slug, target, timeZone, onClose }: {
  slug: string; target: ChatTarget; timeZone?: string; onClose: () => void;
}) {
  const query = useQuery({ queryKey: ['chat', slug, 'detail', target], queryFn: () => resolveChatTarget(slug, target) });
  const channel = query.data;
  return <ChatPopup slug={slug} channel={channel} orderNumber={channel?.order_number ?? undefined} onClose={onClose}>
    {query.isPending ? <p role="status" className="m-auto text-sm text-app-muted">Loading conversation…</p>
      : query.error ? <div className="m-auto text-center"><p role="alert" className="text-sm text-red-700">This conversation could not be opened.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Try again</Button></div>
      : channel && <ChatThread slug={slug} channel={channel} orderId={channel.order_id ?? undefined} driverId={channel.driver_id ?? undefined} shipperId={channel.shipper_id ?? undefined} timeZone={timeZone} fullHeight />}
  </ChatPopup>;
}
