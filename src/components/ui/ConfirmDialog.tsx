import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './button';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` styles the confirm button red for destructive actions. */
  tone?: 'default' | 'danger';
}
interface Request { options: ConfirmOptions; resolve: (ok: boolean) => void }

let host: ((request: Request | null) => void) | null = null;

/** Ask the user to confirm. Resolves true on confirm, false on cancel/Escape. Falls back to the browser dialog when no host is mounted. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!host) return Promise.resolve(window.confirm(options.message));
  return new Promise(resolve => host!({ options, resolve }));
}

/** Mount once near the app root. Renders the pending confirmation as an accessible alert dialog. */
export function ConfirmDialogHost() {
  const [request, setRequest] = useState<Request | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => { host = setRequest; return () => { host = null; }; }, []);
  useEffect(() => {
    if (!request) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); settle(false); }
      if (event.key === 'Tab') {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-confirm-dialog] button'));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);
  if (!request) return null;
  const { options } = request;
  const danger = options.tone === 'danger';
  const settle = (ok: boolean) => { request.resolve(ok); setRequest(null); };
  return <div className="app-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150" onMouseDown={event => { if (event.target === event.currentTarget) settle(false); }}>
    <div data-confirm-dialog role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} className="app-dialog-surface w-full max-w-md p-6 animate-in zoom-in-95 fade-in duration-150">
      <h2 id={`${id}-title`} className="text-slate-900">{options.title}</h2>
      <p id={`${id}-message`} className="mt-2 text-sm leading-6 text-slate-600">{options.message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button ref={cancelRef} type="button" variant="outline" onClick={() => settle(false)}>{options.cancelLabel ?? 'Cancel'}</Button>
        <Button type="button" variant={danger ? 'destructive' : 'default'} onClick={() => settle(true)}>{options.confirmLabel ?? 'Confirm'}</Button>
      </div>
    </div>
  </div>;
}
