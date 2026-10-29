import { Radar, Route, SlidersHorizontal, Workflow } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RouteConstellation } from './RouteConstellation';

const benefits = [
  { icon: Workflow, title: 'Less chasing, more moving', description: 'Keep orders, drivers, and deliveries connected, with less daily coordination for your team.' },
  { icon: Route, title: 'More from your available fleet', description: 'Make better use of available drivers and vehicle space, with less unnecessary travel.' },
  { icon: Radar, title: 'Fewer gaps between handoffs', description: 'Keep delivery progress and proof together, so less gets lost between people and systems.' },
  { icon: SlidersHorizontal, title: 'Automation with you in control', description: 'Let AI handle routine dispatch while you stay informed and step in when needed.' },
];

export function WhyDispatra() {
  const section = useRef<HTMLElement>(null);
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
  const running = !reducedMotion && visible && !hidden;
  return <section ref={section} id="why-dispatra" aria-labelledby="why-dispatra-title" className="why-dispatra">
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="why-dispatra-heading">
        <p className="home-eyebrow">Why Dispatra</p>
        <h2 id="why-dispatra-title">Everything flowing together, automatically</h2>
        <p className="why-dispatra-intro">Dispatra handles routine dispatch and keeps orders, drivers, and deliveries in sync, so your day flows smoothly with less manual coordination.</p>
      </div>
      <div className="why-dispatra-body">
        <figure className="why-dispatra-figure" aria-label="Route constellation" data-running={running}>
          <div className="why-dispatra-sculpture" aria-hidden="true">
            <RouteConstellation running={running} />
            <div className="why-dispatra-flow"><span>Orders</span><span aria-hidden="true">↗</span><span>Drivers</span><span aria-hidden="true">↗</span><span>Deliveries</span></div>
          </div>

        </figure>
        <div className="why-dispatra-benefits">{benefits.map(({ icon: Icon, title, description }) => <article className="why-dispatra-benefit" key={title}>
          <div className="why-dispatra-benefit-top"><Icon size={25} strokeWidth={1.35} aria-hidden="true" /></div>
          <div><h3>{title}</h3><p>{description}</p></div>
        </article>)}</div>
      </div>
    </div>
  </section>;
}
