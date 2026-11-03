import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Shared modal shell so every popup has the same surface, widths, spacing and controls.
 * Pages keep their own state and focus handling (`useEntityDialog` reads `data-entity-dialog`).
 * Sizes: `form` = single-column forms, `md` = record details, `lg` = monitor dossiers, `xl` = two-column editors.
 */
const SIZE = { form: 'app-form-dialog', md: 'max-w-2xl', lg: 'max-w-3xl', xl: 'max-w-6xl' } as const;

/** Icon-only dismissal shared by modal and rich-popup headers. */
export const DialogCloseButton = React.forwardRef<HTMLButtonElement, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { label?: string }>(
  function DialogCloseButton({ label = 'Close dialog', className, ...props }, ref) {
    return <button {...props} ref={ref} type="button" aria-label={label} className={cn('app-dialog-close shrink-0', className)}><X className="w-5 h-5" aria-hidden="true" /></button>;
  },
);

export function Dialog({ onClose, size = 'md', children, className, entity = true, modal = true, label, anchor, zIndex = 'z-50' }: {
  onClose: () => void; size?: keyof typeof SIZE; children: React.ReactNode; className?: string; entity?: boolean; modal?: boolean; label?: string; anchor?: HTMLElement | null; zIndex?: string;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'default' | 'error'>('default');
  const [anchorStyle, setAnchorStyle] = useState<React.CSSProperties>();
  useLayoutEffect(() => {
    if (!anchor || modal) { setAnchorStyle(undefined); return; }
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const panel = surface.current;
      if (!panel) return;
      const width = panel.offsetWidth, height = panel.offsetHeight;
      const right = rect.right + 12;
      const left = right + width <= window.innerWidth - 12 ? right : rect.left - width - 12;
      setAnchorStyle({ position: 'fixed', left: Math.max(12, Math.min(left, window.innerWidth - width - 12)), top: Math.max(12, Math.min(rect.top, window.innerHeight - height - 12)) });
    };
    update();
    const observer = new ResizeObserver(update);
    if (surface.current) observer.observe(surface.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [anchor, modal]);
  useEffect(() => {
    const panel = surface.current;
    const receive = (event: Event) => { const detail = (event as CustomEvent<{ message: string; tone: 'default' | 'error' }>).detail; setMessage(detail.message); setMessageTone(detail.tone); };
    panel?.addEventListener('popup-feedback', receive);
    return () => panel?.removeEventListener('popup-feedback', receive);
  }, []);
  return <div {...(entity ? { 'data-entity-dialog': true } : {})} className={cn('fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150', modal ? 'app-dialog-backdrop' : 'pointer-events-none', zIndex)} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={surface} style={anchorStyle} role={!modal ? "dialog" : undefined} aria-label={label} aria-modal={!modal ? false : undefined} data-popup-feedback className={cn('app-dialog-surface pointer-events-auto w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-150', SIZE[size], className)} onMouseDown={e => e.stopPropagation()}>
      {children}
      {message && <div role={messageTone === 'error' ? 'alert' : 'status'} aria-live={messageTone === 'error' ? 'assertive' : 'polite'} aria-atomic="true" className={cn("mx-5 mb-4 flex shrink-0 items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm", messageTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-800')}><span>{message}</span>
        <button type="button" aria-label="Dismiss message" onClick={() => setMessage('')} className="shrink-0 text-slate-500"><X className="h-4 w-4" /></button>
      </div>}
    </div>
  </div>;
}

export function DialogHeader({ title, description, onClose, leading, children, closeLabel = 'Close dialog', closeDisabled = false }: {
  title: React.ReactNode; description?: React.ReactNode; onClose: () => void; leading?: React.ReactNode; children?: React.ReactNode; closeLabel?: string; closeDisabled?: boolean;
}) {
  return <div className="app-dialog-header">
    <div className="flex min-w-0 items-center gap-3">
      {leading}
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-2 text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">{children}<DialogCloseButton onClick={onClose} disabled={closeDisabled} label={closeLabel} /></div>
  </div>;
}

export function DialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('app-dialog-body', className)}>{children}</div>;
}

export function DialogFooter({ children, note, className }: { children: React.ReactNode; note?: React.ReactNode; className?: string }) {
  return <div className={cn('app-dialog-footer', className)}>{note && <span className="mr-auto text-xs text-slate-500">{note}</span>}{children}</div>;
}
