import { useLayoutEffect, type RefObject } from 'react';

/** Publishes an element's live height as a root CSS variable, so the Monitor's stacked floating panels can size around each other. */
export function usePublishedHeight(ref: RefObject<HTMLElement | null>, variable: string) {
  useLayoutEffect(() => {
    const element = ref.current, root = document.documentElement;
    if (!element) return;
    const publish = () => root.style.setProperty(variable, `${element.offsetHeight}px`);
    publish();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(publish) : undefined;
    observer?.observe(element);
    return () => { observer?.disconnect(); root.style.removeProperty(variable); };
  }, [ref, variable]);
}
