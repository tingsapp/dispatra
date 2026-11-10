import { chat, type ChatChannel, type ChatInboxItem } from './api';
import type { ChatTarget } from './navigation';

export type SelectedChat = ChatChannel & Partial<Pick<ChatInboxItem, 'order_id' | 'order_number' | 'order_status'>>;
export async function resolveChatTarget(slug: string, target: ChatTarget): Promise<SelectedChat> {
  if ('conversationId' in target) { const row = await chat.detail(slug, target.conversationId); return { ...row, driver_id: row.driver_id ?? null, closed_reason: row.closed_reason ?? null }; }
  if ('orderId' in target) {
    const channels = await chat.channels(slug, target.orderId);
    const channel = channels.find(row => row.kind === target.kind && (!target.driverId || row.driver_id === target.driverId));
    if (!channel) throw new Error('This conversation is no longer available.');
    return { ...channel, order_id: target.orderId };
  }
  if ('admin' in target) return chat.support(slug, target.dispatcherId);
  return 'driverId' in target ? chat.companyChannel(slug, target.driverId) : chat.shipperCompanyChannel(slug, target.shipperId);
}

