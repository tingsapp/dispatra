import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type Account } from '../../portal/api';
import type { ChatChannel } from '../../chat/api';
import { Dialog, DialogBody, DialogHeader } from '../ui/Dialog';
import { useEntityDialog } from '../entities/useEntityDialog';

/** Presentation only: the server still determines participants and send permissions. */
export function counterpartRole(channel: ChatChannel, role: Account['role'], company: string) {
  if (role === 'DISPATCHER') return channel.kind === 'DISPATCH_DRIVER' ? 'Driver'
    : channel.kind === 'DISPATCH_SHIPPER' ? 'Shipper' : 'Driver · Shipper';
  if (role === 'SHIPPER') return channel.kind === 'DRIVER_SHIPPER' ? 'Driver' : company;
  return channel.kind === 'DRIVER_SHIPPER' ? 'Shipper' : company;
}

/** Shared portal avoids clipping and stays above the order/profile that opened it. */
export function ChatPopup({ slug, channel, orderNumber, onClose, children }: { slug: string; channel?: ChatChannel; orderNumber?: string; onClose: () => void; children: ReactNode }) {
  // Observe the already authenticated account; opening a chat performs no extra account request.
  const account = useQuery<Account>({ queryKey: ['account'], queryFn: api.me, enabled: false }).data;
  const currentAccount = account?.organization?.slug === slug ? account : undefined;
  const title = channel?.title ?? 'Conversation';
  const role = channel && currentAccount ? counterpartRole(channel, currentAccount.role, currentAccount.organization?.name ?? 'Company') : undefined;
  useEntityDialog(true, onClose, `Chat with ${title}${orderNumber ? ` · ${orderNumber}` : ''}`);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  return createPortal(<Dialog size="md" zIndex="z-[160]" onClose={onClose} className="app-chat-popup max-w-[480px] rounded-2xl">
    <DialogHeader onClose={onClose} title={<span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>} description={role || orderNumber ? <>{role}{role && orderNumber && ' · '}{orderNumber}</> : undefined}
      leading={<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600" aria-hidden="true">{channel ? title.slice(0, 1).toUpperCase() : '…'}</span>} />
    <DialogBody className="app-chat-body">{children}</DialogBody>
  </Dialog>, document.body);
}
