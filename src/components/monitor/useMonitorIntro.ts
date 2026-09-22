import { useCallback, useEffect, useRef, useState } from 'react';
import { markMonitorVisited, REDUCED_MOTION_QUERY, shouldPlayMonitorIntro } from './introSession';
import { INTRO_TIMING } from './introTiming';
import { ARRIVAL_TIMING, ArrivalPhase } from './arrival';

export function useMonitorIntro(skipIntro: boolean) {
  const [playing, setPlaying] = useState(() => shouldPlayMonitorIntro(skipIntro));
  // 'idle' means no sequence (intro never played); it starts once the flight lands.
  const [arrival, setArrival] = useState<ArrivalPhase>('idle');
  const [sequence, setSequence] = useState(false);
  const [brief, setBrief] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const landed = useRef(false);
  const finish = useCallback(() => {
    const restoreFocus = intro.current?.contains(document.activeElement);
    setPlaying(false);
    if (!landed.current) { landed.current = true; setArrival('stops'); setSequence(true); }
    if (restoreFocus) requestAnimationFrame(() => content.current?.focus({ preventScroll: true }));
  }, []);
  const dismissBrief = useCallback(() => setBrief(false), []);

  // Layered arrival: stops drop in, drivers slide on, routes draw, then the day's brief.
  useEffect(() => {
    if (!sequence) return;
    const reduced = window.matchMedia?.(REDUCED_MOTION_QUERY).matches;
    if (reduced) { setArrival('done'); setBrief(true); return; }
    const timers = [
      window.setTimeout(() => setArrival('drivers'), ARRIVAL_TIMING.drivers),
      window.setTimeout(() => setArrival('routes'), ARRIVAL_TIMING.routes),
      window.setTimeout(() => setBrief(true), ARRIVAL_TIMING.brief),
      window.setTimeout(() => setArrival('done'), ARRIVAL_TIMING.done),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [sequence]);
  useEffect(() => {
    if (!brief) return;
    const timer = window.setTimeout(dismissBrief, ARRIVAL_TIMING.briefAutoHide);
    return () => window.clearTimeout(timer);
  }, [brief, dismissBrief]);

  useEffect(markMonitorVisited, []);
  useEffect(() => { if (skipIntro) { landed.current = true; setArrival('done'); finish(); } }, [skipIntro, finish]);
  useEffect(() => {
    if (!playing) return;
    const preference = window.matchMedia?.(REDUCED_MOTION_QUERY);
    const reduce = () => { if (preference?.matches) finish(); };
    const visibility = () => { if (document.hidden) finish(); };
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(); };
    // Slow tiles, unavailable WebGL or a backgrounded tab must never hold the workspace hostage.
    const timeout = window.setTimeout(finish, INTRO_TIMING.timeout);
    preference?.addEventListener('change', reduce);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('keydown', keyboard);
    return () => {
      window.clearTimeout(timeout);
      preference?.removeEventListener('change', reduce);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('keydown', keyboard);
    };
  }, [playing, finish]);

  return { playing, finish, content, intro, arrival, brief, dismissBrief };
}
