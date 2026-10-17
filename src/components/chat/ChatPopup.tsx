import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare } from 'lucide-react';
import { Dialog, DialogBody, DialogHeader } from '../ui/Dialog';
import { useEntityDialog } from '../entities/useEntityDialog';

/** Shared portal avoids clipping and stays above the order/profile that opened it. */
export function ChatPopup({ orderNumber, onClose, children }: { orderNumber?: string; onClose: () => void; children: ReactNode }) {
  useEntityDialog(true, onClose);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  return createPortal(<Dialog size="md" zIndex="z-[160]" onClose={onClose} className="max-w-[480px] rounded-2xl">
    <DialogHeader onClose={onClose} title={<span className="min-w-0 [overflow-wrap:anywhere]">{orderNumber ? `Messages · ${orderNumber}` : 'Messages'}</span>} description="A conversation connected to your order."
      leading={<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><MessageSquare size={19} strokeWidth={1.6} aria-hidden="true" /></span>} />
    <DialogBody className="space-y-4 p-4 sm:p-5">{children}</DialogBody>
  </Dialog>, document.body);
}
