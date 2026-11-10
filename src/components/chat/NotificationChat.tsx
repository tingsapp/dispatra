import { ActionButton } from '../ui/button';
import { useQuery } from '@tanstack/react-query';
import { chat } from '../../chat/api';
import { ChatPopup } from './ChatPopup';
import { ChatThread } from './ChatThread';

/** Notification identifiers are always resolved through an authorized conversation read. */
export function NotificationChat({ slug, identity, onClose, timeZone }: { slug: string; identity: string; onClose: () => void; timeZone?: string }) {
  const query = useQuery({ queryKey: ['chat', slug, 'detail', identity], queryFn: () => chat.detail(slug, identity) });
  const channel = query.data ? { ...query.data, driver_id: query.data.driver_id ?? null, closed_reason: query.data.closed_reason ?? null } : undefined;
  return <ChatPopup slug={slug} channel={channel} orderNumber={channel?.order_number ?? undefined} onClose={onClose}>
    {query.isPending ? <p role="status">Loading conversation…</p> : query.error ? <p role="alert">This conversation is unavailable. <ActionButton className="underline" onClick={() => query.refetch()}>Try again</ActionButton></p> : channel &&
      <ChatThread slug={slug} channel={channel} orderId={channel.order_id ?? undefined} driverId={channel.driver_id ?? undefined} shipperId={channel.shipper_id ?? undefined} timeZone={timeZone} />}
  </ChatPopup>;
}
