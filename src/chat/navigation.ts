import type { ChatKind } from './api';
export type ChatTarget = { conversationId: string } | { driverId: string } | { shipperId: string } | { admin: true; dispatcherId?: string } | { orderId: string; kind: ChatKind; driverId?: string };
export const OPEN_CHAT = 'dispatra-open-chat';
export function openDispatcherChat(target: ChatTarget) {
  window.dispatchEvent(new CustomEvent<ChatTarget>(OPEN_CHAT, { detail: target }));
}
