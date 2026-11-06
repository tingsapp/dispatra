import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type Ref } from 'react';

type OutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>;
type Scope = { ids: string[]; open: boolean; close: () => void };
export const OutsideDismissContext = createContext<Scope | null>(null);

/** Portalled descendants belong to their parent menu, even though their DOM nodes do not. */
export function useOutsideDismissRoot({ open, defaultOpen = false, onOpenChange }: {
  open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const parent = useContext(OutsideDismissContext);
  const id = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const currentOpen = open ?? internalOpen;
  const changeOpen = (next: boolean) => { setInternalOpen(next); onOpenChange?.(next); };
  const ids = useMemo(() => [...(parent?.ids ?? []), id], [parent?.ids, id]);
  return { open: currentOpen, onOpenChange: changeOpen, scope: { ids, open: currentOpen, close: () => changeOpen(false) } };
}

export function useOutsideDismissScope() {
  return useContext(OutsideDismissContext)?.ids.join(' ');
}

/** Fallback when map, table or dialog event handlers prevent Radix's bubbling listener from running. */
export function useOutsideDismissContent({ ref, onPointerDownOutside, onInteractOutside, onCloseAutoFocus }: {
  ref?: Ref<HTMLDivElement>;
  onPointerDownOutside?: (event: OutsideEvent) => void;
  onInteractOutside?: (event: OutsideEvent | CustomEvent<{ originalEvent: FocusEvent }>) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const scope = useContext(OutsideDismissContext);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const handled = useRef(new WeakSet<Event>());
  const outsideClose = useRef(false);
  const latest = useRef({ scope, onPointerDownOutside, onInteractOutside });
  latest.current = { scope, onPointerDownOutside, onInteractOutside };
  const setRef = useCallback((value: HTMLDivElement | null) => {
    setNode(value);
    if (typeof ref === 'function') ref(value);
    else if (ref) ref.current = value;
  }, [ref]);
  useEffect(() => {
    if (!scope?.open || !node) return;
    outsideClose.current = false;
    const owner = node.ownerDocument;
    let pointer: PointerEvent | undefined;
    const remember = (event: PointerEvent) => { pointer = event; };
    const dismiss = (event: MouseEvent) => {
      const originalEvent = pointer ?? event as PointerEvent;
      pointer = undefined;
      const target = event.target;
      const id = latest.current.scope?.ids.at(-1);
      if (!(target instanceof Element) || !id || target.closest('[data-outside-dismiss-scope]')?.getAttribute('data-outside-dismiss-scope')?.split(' ').includes(id)) return;
      // Let normal Radix dismissal and the clicked control finish first. Never consume the outside click.
      queueMicrotask(() => {
        if (!node.isConnected || node.dataset.state !== 'open' || handled.current.has(originalEvent)) return;
        const outside = new CustomEvent('dispatra.pointerDownOutside', { cancelable: true, detail: { originalEvent } });
        latest.current.onPointerDownOutside?.(outside);
        latest.current.onInteractOutside?.(outside);
        if (!outside.defaultPrevented) { outsideClose.current = true; latest.current.scope?.close(); }
      });
    };
    owner.addEventListener('pointerdown', remember, true);
    owner.addEventListener('click', dismiss, true);
    return () => { owner.removeEventListener('pointerdown', remember, true); owner.removeEventListener('click', dismiss, true); };
  }, [scope?.open, node]);
  return {
    ref: setRef,
    'data-outside-dismiss-scope': scope?.ids.join(' '),
    onPointerDownOutside: (event: OutsideEvent) => { handled.current.add(event.detail.originalEvent); onPointerDownOutside?.(event); },
    onCloseAutoFocus: (event: Event) => { onCloseAutoFocus?.(event); if (outsideClose.current) event.preventDefault(); },
  };
}
