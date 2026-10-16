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
    const target = window.scrollY + end.current.getBoundingClientRect().bottom + dock.current.getBoundingClientRect().height - window.innerHeight;
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
      const distance = end.current.getBoundingClientRect().bottom + field.height - window.innerHeight;
      const nearEnd = Math.abs(distance) <= 64;
      following.current = nearEnd && field.bottom > 0 && field.top < window.innerHeight;
      setShowLatest(!following.current);
    }
    function resize() { if (following.current) jumpToLatest(); else observePosition(); }
    window.addEventListener('scroll', observePosition, { passive: true });
    window.addEventListener('resize', resize);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    if (dock.current) observer?.observe(dock.current);
    return () => {
      window.removeEventListener('scroll', observePosition);
      window.removeEventListener('resize', resize);
      observer?.disconnect();
    };
  }, [started]);

  return { end, dock, showLatest, followLatest, jumpToLatest };
}
