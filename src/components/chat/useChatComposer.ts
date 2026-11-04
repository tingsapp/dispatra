import { useLayoutEffect, type RefObject } from 'react';

/** Size from rendered text, including soft wraps; keep the action row outside long drafts. */
export function useChatComposer(ref: RefObject<HTMLTextAreaElement | null>, value: string, context?: unknown) {
  useLayoutEffect(() => {
    const field = ref.current;
    const composer = field?.closest<HTMLElement>('.public-chat-composer');
    if (!field || !composer) return;
    const measure = () => {
      // Measure in the compact layout first so wrapping cannot toggle the layout back and forth.
      composer.dataset.multiline = 'false';
      field.style.height = '0px';
      const lineHeight = Number.parseFloat(window.getComputedStyle(field).lineHeight) || 24;
      const multiline = field.scrollHeight > lineHeight + 1;
      composer.dataset.multiline = String(multiline);
      field.style.height = '0px';
      const height = Math.min(lineHeight * 6, Math.max(lineHeight, field.scrollHeight));
      field.style.height = `${height}px`;
      field.style.overflowY = field.scrollHeight > height ? 'auto' : 'hidden';
      field.closest<HTMLElement>('.company-activity-panel')?.style.setProperty('--assistant-composer-height', `${composer.getBoundingClientRect().height}px`);
    };
    measure();
    let width = composer.getBoundingClientRect().width;
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => {
      const next = composer.getBoundingClientRect().width;
      if (next !== width) { width = next; measure(); }
    });
    observer?.observe(composer);
    return () => observer?.disconnect();
  }, [ref, value, context]);
}
