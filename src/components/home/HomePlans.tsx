import { ArrowRight, Check, Layers3, Workflow } from 'lucide-react';
import { Button } from '../ui/button';
const offerings = [
  { id: 'full', icon: Layers3, label: 'Your operation, in one workspace', title: 'TMS + Smart Dispatching', description: 'Bring your delivery operation into Dispatra, from order intake and pricing to dispatch and delivery.', features: ['Orders, shippers, drivers, and vehicles', 'Rate cards and order pricing', 'Smart dispatching and route optimization', 'Driver and shipper access'], action: 'Explore the full workspace' },
  { id: 'dispatch', icon: Workflow, label: 'Built around your existing TMS', title: 'Smart Dispatching', description: 'Keep your current TMS and bring Dispatra into your dispatch workflow. We’ll help confirm the right connection.', features: ['Your existing TMS stays in place', 'Eligible-driver assignment in Auto mode', 'Route optimization and delivery progress', 'Connection support from our team'], action: 'Explore Smart Dispatching' },
];
export function HomePlans() {
  return <section id="home-plans" aria-labelledby="home-plans-title" className="home-section home-plans">
    <div className="home-section-heading home-heading-centered"><p className="home-eyebrow">Two ways to move forward</p><h2 id="home-plans-title">Your operation. Your way.</h2><p>Start with the full workspace, or connect the dispatching you need.</p></div>
    <div className="home-plan-grid">{offerings.map(({ id, icon: Icon, label, title, description, features, action }) => <article id={`home-plan-${id}`} className="home-plan" key={id}>
      <div className="home-plan-label"><Icon size={23} strokeWidth={1.4} aria-hidden="true" /><span>{label}</span></div><h3>{title}</h3><p className="home-plan-description">{description}</p>
      <ul>{features.map(feature => <li key={feature}><Check size={15} aria-hidden="true" />{feature}</li>)}</ul>
      <Button asChild variant={id === 'full' ? 'default' : 'outline'} className="w-fit"><a href={`/plans#plan-${id}`}>{action}<ArrowRight size={15} aria-hidden="true" /></a></Button>
      <a href={`/contact?plan=${id}`} className="home-text-link">Talk to us about this plan<ArrowRight size={13} aria-hidden="true" /></a>
    </article>)}</div>
    <p className="home-plan-note">Monthly pricing is per registered vehicle. <a href="/plans">View current plans and pricing <span aria-hidden="true">↗</span></a></p>
  </section>;
}
