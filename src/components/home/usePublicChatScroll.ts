import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Follow new replies only while the reader is at the end of this page-based conversation. */
export function usePublicChatScroll(started: boolean, turns: unknown, status: string, progress = 0) {
  const end = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [showLatest, setShowLatest] = useState(false);

  function followLatest() { following.current = true; setShowLatest(false); }
  function jumpToLatest() {
    followLatest();
    if (!end.current || !dock.current) return;
    const target = window.scrollY + end.current.getBoundingClientRect().bottom + dock.current.getBoundingClientRect().height - (window.visualViewport?.height ?? window.innerHeight) - (window.visualViewport?.offsetTop ?? 0);
    window.scrollTo({ top: Math.max(0, target), behavior: 'instant' });
  }
  useLayoutEffect(() => {
    if (!started || !following.current) return;
    jumpToLatest();
    const frame = window.requestAnimationFrame(() => { if (following.current) jumpToLatest(); });
    return () => window.cancelAnimationFrame(frame);
  }, [started, turns, status, progress]);

  useEffect(() => {
    if (!started) return;
    function observePosition() {
      if (!end.current || !dock.current) return;
      const field = dock.current.getBoundingClientRect();
      const distance = end.current.getBoundingClientRect().bottom + field.height - (window.visualViewport?.height ?? window.innerHeight) - (window.visualViewport?.offsetTop ?? 0);
      const nearEnd = Math.abs(distance) <= 64;
      following.current = nearEnd && field.bottom > 0 && field.top < (window.visualViewport?.height ?? window.innerHeight) + (window.visualViewport?.offsetTop ?? 0);
      setShowLatest(!following.current);
    }
    const viewport = window.visualViewport;
    function resize() {
      const covered = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      dock.current?.style.setProperty('--chat-keyboard-inset', `${covered}px`);
      if (following.current) jumpToLatest(); else observePosition();
    }
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('scroll', observePosition, { passive: true });
    window.addEventListener('resize', resize);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    if (dock.current) observer?.observe(dock.current);
    return () => {
      window.removeEventListener('scroll', observePosition);
      window.removeEventListener('resize', resize);
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      dock.current?.style.removeProperty('--chat-keyboard-inset');
      observer?.disconnect();
    };
  }, [started]);

  return { end, dock, showLatest, followLatest, jumpToLatest };
}
