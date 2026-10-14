import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '../ui';

function useMotionPreferences() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media?.matches ?? false);
    const visibility = () => setVisible(!document.hidden);
    media?.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => { media?.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return { reduced, visible };
}

/** Scroll real rows only. Hover, focus, manual input and open details stop movement. */
export function AutoScrollingIssueList({ children, controls, contentKey, resetKey, enabled, holding }: {
  children: ReactNode; controls: ReactNode; contentKey: string; resetKey: string; enabled: boolean; holding: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const { reduced, visible } = useMotionPreferences();
  const running = enabled && overflow && !paused && !hovered && !focused && !holding && !reduced && visible;
  useEffect(() => { if (viewport.current) viewport.current.scrollTop = 0; }, [resetKey]);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => setOverflow(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(node);
    if (node.firstElementChild) observer?.observe(node.firstElementChild);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [contentKey, holding]);
  useEffect(() => {
    const node = viewport.current;
    if (!node || !running) return;
    let frame = 0, previous = 0, position = node.scrollTop, restingUntil = window.performance.now() + 1200;
    const tick = (time: number) => {
      const elapsed = previous ? Math.min(time - previous, 50) : 0;
      previous = time;
      const maximum = node.scrollHeight - node.clientHeight;
      if (maximum > 0 && time >= restingUntil) {
        if (position >= maximum) { position = 0; node.scrollTop = 0; restingUntil = time + 1800; }
        else {
          position = Math.min(maximum, position + elapsed * .018);
          node.scrollTop = position;
          if (position >= maximum) restingUntil = time + 2400;
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [running, contentKey]);
  return <div className="space-y-3">
    {(controls || (enabled && overflow && !reduced)) && <div className="flex items-center justify-end gap-2">
      {controls}
      {enabled && overflow && !reduced && <Button type="button" variant="ghost" size="icon-xs" aria-pressed={paused}
        aria-label={paused ? 'Resume scrolling' : 'Pause scrolling'} title={paused ? 'Resume scrolling' : 'Pause scrolling'} onClick={() => setPaused(value => !value)}>
        {paused ? <Play size={13} /> : <Pause size={13} />}
      </Button>}
    </div>}
    <div ref={viewport} role="region" aria-label="Report entries" tabIndex={0} data-auto-scroll={running ? 'running' : 'paused'}
      className="agent-report-viewport" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
      onWheel={() => setPaused(true)} onTouchStart={() => setPaused(true)} onKeyDownCapture={event => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) setPaused(true);
      }}>
      <div>{children}</div>
    </div>
  </div>;
}
