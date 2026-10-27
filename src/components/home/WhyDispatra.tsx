import { MailCheck, Pause, Play, Radar, Route, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RouteConstellation } from './RouteConstellation';

const benefits = [
  { icon: MailCheck, title: 'Less entry, more momentum', description: 'Turn incoming order emails into prepared orders. Give your team more time to keep deliveries moving.' },
  { icon: Route, title: 'A smarter way to dispatch', description: 'Match ready orders with eligible drivers in Auto mode, then let route optimization connect the stops.' },
  { icon: Radar, title: 'One view of the whole day', description: 'Keep orders, drivers, and delivery progress together. See what is moving and what needs your attention.' },
  { icon: ScanLine, title: 'Clarity through completion', description: 'Connect your dispatchers, shippers, and drivers from the first request to captured proof of delivery.' },
];

export function WhyDispatra() {
  const section = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media?.matches ?? false);
    const updateVisibility = () => setHidden(document.hidden);
    media?.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '80px' });
    if (section.current) observer?.observe(section.current);
    return () => {
      media?.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
      observer?.disconnect();
    };
  }, []);
  const running = !paused && !reducedMotion && visible && !hidden;
  return <section ref={section} id="why-dispatra" aria-labelledby="why-dispatra-title" className="why-dispatra">
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="why-dispatra-heading">
        <p className="home-eyebrow">Why Dispatra</p>
        <h2 id="why-dispatra-title">Every moving part in<br className="sm:hidden" /> one smooth operation</h2>
        <p className="why-dispatra-intro">Less busywork between the order and the doorstep.</p>
      </div>
      <div className="why-dispatra-body">
        <figure className="why-dispatra-figure" aria-label="Illustrative route constellation" data-running={running}>
          <div className="why-dispatra-sculpture" aria-hidden="true">
            <div className="why-dispatra-orbit-label"><span />Connected by Dispatra</div>
            <RouteConstellation running={running} />
            <div className="why-dispatra-flow"><span>Orders</span><span aria-hidden="true">↗</span><span>Drivers</span><span aria-hidden="true">↗</span><span>Deliveries</span></div>
          </div>
          <figcaption className="why-dispatra-caption"><span>One connected delivery network <span className="why-dispatra-sample">· Illustration</span></span>
            {!reducedMotion && <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Play route constellation animation' : 'Pause route constellation animation'} className="why-dispatra-pause">{paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}</button>}
          </figcaption>
        </figure>
        <div className="why-dispatra-benefits">{benefits.map(({ icon: Icon, title, description }, i) => <article className="why-dispatra-benefit" key={title}>
          <div className="why-dispatra-benefit-top"><Icon size={25} strokeWidth={1.35} aria-hidden="true" /><span>0{i + 1}</span></div>
          <div><h3>{title}</h3><p>{description}</p></div>
        </article>)}</div>
      </div>
    </div>
  </section>;
}
