import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useSpring } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { MonitorPreview } from './MonitorPreview';
import { deliveryPreviewEvents, type PreviewStageRequest } from './deliveryPreviewData';

export function DeliveryDemo() {
  const [stage, setStage] = useState(0);
  const [request, setRequest] = useState<PreviewStageRequest>();
  const steps = useRef<HTMLOListElement>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media?.matches ?? false);
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, []);
  const spring = { stiffness: 420, damping: 42, mass: .7 };
  const x = useSpring(0, spring), y = useSpring(0, spring);
  const width = useSpring(0, spring), height = useSpring(0, spring);
  const positioned = useRef(false);
  useLayoutEffect(() => {
    const list = steps.current;
    if (!list) return;
    const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>('.home-demo-step'));
    const update = (immediate = false) => {
      const selected = buttons[stage];
      if (!selected) return;
      const origin = list.getBoundingClientRect(), target = selected.getBoundingClientRect();
      const values = [[x, target.left - origin.left], [y, target.top - origin.top], [width, target.width], [height, target.height]] as const;
      for (const [value, next] of values) {
        if (immediate || reducedMotion || !positioned.current) value.jump(next);
        else value.set(next);
      }
      positioned.current = true;
    };
    update();
    // Follow the description's changing height without remounting the highlight.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => update());
    buttons.forEach(button => observer?.observe(button));
    const resize = () => update(true);
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [stage, reducedMotion, x, y, width, height]);
  return <section id="how-it-works" aria-labelledby="workflow-title" className="home-section home-demo">
    <div className="home-section-heading"><div><p className="home-eyebrow">From the first request to the final stop</p><h2 id="workflow-title">See a delivery day come together.</h2></div><p>Select a step to explore the workflow.<br />One order. One connected team.</p></div>
    <div className="home-demo-layout">
      <ol ref={steps} className="home-demo-steps" aria-label="Explore the sample order workflow">{deliveryPreviewEvents.map(({ label, description, icon: Icon }, index) => <li key={label}>
        {index === 0 && <motion.span aria-hidden="true" className="home-demo-highlight" style={{ x, y, width, height }} />}
        <button type="button" className="home-demo-step" aria-label={`Step ${index + 1}: ${label}`} aria-describedby={stage === index ? `home-step-description-${index}` : undefined} aria-current={stage === index ? 'step' : undefined} aria-controls="home-demo-screen" onClick={() => setRequest(value => ({ index, request: (value?.request ?? 0) + 1 }))}>
          <span className="home-demo-step-icon"><Icon size={17} strokeWidth={1.5} aria-hidden="true" /></span><span className="home-demo-step-copy"><span className="home-demo-step-label"><span className="home-demo-number">0{index + 1}</span>{label}</span><span id={`home-step-description-${index}`} className="home-demo-step-description" aria-hidden={stage !== index}><span>{description}</span></span></span><ChevronRight size={14} className="home-demo-chevron" aria-hidden="true" />
        </button>
      </li>)}</ol>
      <div id="home-demo-screen"><MonitorPreview onStageChange={setStage} requestedStage={request} /></div>
    </div>
    <p className="home-demo-control-note">Your team stays in control. Choose Manual assignment or let Auto dispatch eligible Ready Orders. Both optimize routes after assignment.</p>
  </section>;
}
