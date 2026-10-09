import { useEffect, useRef } from 'react';
/** Accessibility for the existing page drawers; nested calendar popovers keep their own focus scope. */
export function useEntityDialog(open: boolean, onClose: () => void) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!open) return;
    // Dialogs can stack (a catalogue modal over a list dialog): bind to the newest one and only react while it is topmost.
    const panels = document.querySelectorAll<HTMLElement>('[data-entity-dialog]');
    const panel = panels[panels.length - 1];
    if (!panel) return;
    const topmost = () => { const all = document.querySelectorAll('[data-entity-dialog]'); return all[all.length - 1] === panel; };
    const previous = document.activeElement as HTMLElement | null;
    panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
    panel.setAttribute('aria-label',panel.querySelector('h3')?.textContent ?? 'Edit record');
    panel.querySelectorAll<HTMLButtonElement>('button').forEach(b => { if (!b.textContent?.trim() && !b.getAttribute('aria-label') && !b.title) b.setAttribute('aria-label','Close dialog'); });
    (panel.querySelector<HTMLElement>('input,button,select,textarea') ?? panel).focus();
    const keydown = (e: KeyboardEvent) => {
      if (!topmost() || document.querySelector('[data-slot="popover-content"][data-state="open"]') || panel.querySelector('[role="listbox"]:not([aria-hidden="true"])')) return;
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key !== 'Tab') return;
      const fields = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea,select,summary,[tabindex="0"]')).filter(el => el.getClientRects().length > 0);
      const first = fields[0], last = fields.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown',keydown);
    return () => { document.removeEventListener('keydown',keydown); previous?.focus(); };
  },[open]);
}
