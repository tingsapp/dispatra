import { useEffect, useRef, useState } from 'react';

/** Modal keyboard behavior for the sidebar only on narrow screens. */
export function useSidebarDrawer(open: boolean, onClose: () => void, query = '(max-width: 639px)') {
  const panelRef = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [mobile, setMobile] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const change = () => { setMobile(media.matches); if (media.matches) close.current(); };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [query]);
  useEffect(() => {
    if (!open || !mobile || !panelRef.current) return;
    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'))
      .filter(element => !element.closest('[hidden], [inert], [aria-hidden="true"]'));
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('[data-slot="popover-content"][data-state="open"], [data-slot="dropdown-menu-content"][data-state="open"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const fields = controls(), first = fields[0], last = fields.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, [open, mobile]);
  return { mobile, panelRef };
}
