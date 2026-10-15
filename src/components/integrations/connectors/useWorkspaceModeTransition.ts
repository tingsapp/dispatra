import { useEffect, useRef, useState } from 'react';

export function useWorkspaceModeTransition(nativeTms: boolean) {
  const shown = useRef(nativeTms);
  const [displayedMode, setDisplayedMode] = useState(nativeTms);
  const [phase, setPhase] = useState<'idle' | 'out' | 'loading' | 'in'>('idle');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media?.matches ?? false);
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reducedMotion || shown.current === nativeTms) {
      shown.current = nativeTms;
      setDisplayedMode(nativeTms);
      setPhase('idle');
      return;
    }
    setPhase('out');
    const loading = window.setTimeout(() => setPhase('loading'), 180);
    const reveal = window.setTimeout(() => {
      shown.current = nativeTms;
      setDisplayedMode(nativeTms);
      setPhase('in');
    }, 780);
    const finish = window.setTimeout(() => setPhase('idle'), 1000);
    return () => { window.clearTimeout(loading); window.clearTimeout(reveal); window.clearTimeout(finish); };
  }, [nativeTms, reducedMotion]);
  return { displayedMode, phase };
}
