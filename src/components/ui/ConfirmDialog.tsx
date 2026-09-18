import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

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
  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-150" onMouseDown={event => { if (event.target === event.currentTarget) settle(false); }}>
    <div data-confirm-dialog role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} className="w-full max-w-sm rounded-2xl bg-white shadow-2xl shadow-slate-900/20 border border-slate-200 p-6 animate-in zoom-in-95 fade-in duration-150">
      <div className="flex items-start gap-4">
        <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'}`}>
          {danger ? <AlertTriangle className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-sm font-semibold text-slate-900">{options.title}</h2>
          <p id={`${id}-message`} className="mt-1.5 text-xs leading-5 text-slate-600">{options.message}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button ref={cancelRef} type="button" onClick={() => settle(false)} className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">{options.cancelLabel ?? 'Cancel'}</button>
        <button type="button" onClick={() => settle(true)} className={`px-3.5 py-2 text-xs font-medium rounded-lg text-white shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'}`}>{options.confirmLabel ?? 'Confirm'}</button>
      </div>
    </div>
  </div>;
}
