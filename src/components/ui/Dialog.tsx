import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Shared modal shell so every popup has the same surface, widths, spacing and controls.
 * Pages keep their own state and focus handling (`useEntityDialog` reads `data-entity-dialog`).
 * Sizes: `form` = single-column forms, `md` = record details, `lg` = monitor dossiers, `xl` = two-column editors.
 */
const SIZE = { form: 'app-form-dialog', md: 'max-w-2xl', lg: 'max-w-3xl', xl: 'max-w-6xl' } as const;

export function Dialog({ onClose, size = 'md', children, className, entity = true, zIndex = 'z-50' }: {
  onClose: () => void; size?: keyof typeof SIZE; children: React.ReactNode; className?: string; entity?: boolean; zIndex?: string;
}) {
  return <div {...(entity ? { 'data-entity-dialog': true } : {})} className={cn('app-dialog-backdrop fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-150', zIndex)} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={cn('app-dialog-surface w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-150', SIZE[size], className)} onMouseDown={e => e.stopPropagation()}>{children}</div>
  </div>;
}

export function DialogHeader({ title, description, onClose, leading, children, closeLabel = 'Close dialog' }: {
  title: React.ReactNode; description?: React.ReactNode; onClose: () => void; leading?: React.ReactNode; children?: React.ReactNode; closeLabel?: string;
}) {
  return <div className="app-dialog-header">
    <div className="flex min-w-0 items-center gap-3">
      {leading}
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-2 text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">{children}<button type="button" onClick={onClose} aria-label={closeLabel} className="app-dialog-close"><X className="w-5 h-5" /></button></div>
  </div>;
}

export function DialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('app-dialog-body', className)}>{children}</div>;
}

export function DialogFooter({ children, note, className }: { children: React.ReactNode; note?: React.ReactNode; className?: string }) {
  return <div className={cn('app-dialog-footer', className)}>{note && <span className="mr-auto text-xs text-slate-500">{note}</span>}{children}</div>;
}
