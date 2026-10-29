import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AgentProcessPanel, agentProcessSteps } from './AgentProcessPanel';

export function DeliveryDemo() {
  const [stage, setStage] = useState(0);
  const section = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motionChanged = () => setReducedMotion(media?.matches ?? false);
    const visibilityChanged = () => setHidden(document.hidden);
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .15 });
    if (section.current) observer?.observe(section.current);
    media?.addEventListener('change', motionChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => { observer?.disconnect(); media?.removeEventListener('change', motionChanged); document.removeEventListener('visibilitychange', visibilityChanged); };
  }, []);
  useEffect(() => {
    if (hovered || focused || hidden || !visible || reducedMotion) return;
    const timer = window.setTimeout(() => setStage(current => (current + 1) % agentProcessSteps.length), 7000);
    return () => window.clearTimeout(timer);
  }, [stage, hovered, focused, hidden, visible, reducedMotion]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <section ref={section} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }} id="how-it-works" aria-labelledby="workflow-title" className="home-section home-demo home-agent-demo">
    <div className="home-section-heading"><div><p className="home-eyebrow">How it works</p><h2 id="workflow-title">Dispatra at work</h2></div><p>AI agents working together.<br />From incoming orders to completed deliveries.</p></div>
    <div className="home-demo-layout">
      <ol className="home-demo-steps" aria-label="Explore the dispatch process" onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (stage + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) + 4) % 4;
        setStage(next); buttons.current[next]?.focus();
      }}>{agentProcessSteps.map(({ label, subtitle, icon: Icon }, index) => <li key={label}>
        <button ref={button => { buttons.current[index] = button; }} type="button" className="home-demo-step" aria-label={label} aria-current={stage === index ? 'step' : undefined} aria-controls="home-demo-screen" onClick={() => setStage(index)}>
          <span className="home-demo-step-icon"><Icon size={19} strokeWidth={1.5} aria-hidden="true" /></span><span className="home-demo-step-copy"><span className="home-demo-step-label">{label}</span><span className="agent-step-subtitle">{subtitle}</span></span>
        </button>
      </li>)}</ol>
      <div id="home-demo-screen" role="region" aria-label={`${agentProcessSteps[stage].label} demonstration`}><AnimatePresence mode="wait" initial={false}><motion.div key={stage} className="agent-panel-slide" data-stage={stage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: reducedMotion ? 0 : .28, ease: [.22, 1, .36, 1] }}><AgentProcessPanel stage={stage} /></motion.div></AnimatePresence></div>
    </div>
  </section>;
}
