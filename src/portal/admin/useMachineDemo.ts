import { useEffect, useState } from 'react';

export const SAMPLE_FLOW = [
  { node: 'inputs', message: 'A sample booking arrives by email.' },
  { node: 'ORDER', message: 'Order engine extracts and validates the booking.' },
  { node: 'data', message: 'Validated order, price and stops enter the shared data store.' },
  { node: 'DISPATCH', message: 'Dispatch engine checks drivers and builds an optimized route.' },
  { node: 'delivery', message: 'The route moves through pickup, delivery and proof.' },
  { node: 'OPERATIONAL', message: 'Operational agent reviews progress and arrival risks.' },
  { node: 'TECHNICAL', message: 'Technical agent checks the platform and reports problems.' },
  { node: 'CHAT', message: 'Chat agent answers a question using authorized workspace records.' },
];
export function useMachineDemo(demo = false) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => { setStep(0); setPaused(false); }, [demo]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media?.matches ?? false);
    const visibility = () => setHidden(document.hidden);
    media?.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { media?.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!demo || paused || hidden || reduced) return;
    const timer = window.setInterval(() => setStep(value => (value + 1) % SAMPLE_FLOW.length), 1800);
    return () => window.clearInterval(timer);
  }, [demo, paused, hidden, reduced]);
  return { demo, step, paused, reduced, moving: demo && !paused && !hidden && !reduced,
    toggle: () => setPaused(value => !value), next: () => setStep(value => (value + 1) % SAMPLE_FLOW.length) };
}
