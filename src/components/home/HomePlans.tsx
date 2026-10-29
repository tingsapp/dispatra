import { ArrowRight, Check, Layers3, Workflow } from 'lucide-react';
import { Button } from '../ui/button';
const offerings = [
  { id: 'full', icon: Layers3, label: 'Built-in workspace', title: 'Full Workspace', description: 'Automate dispatch with your orders, drivers, and delivery details together in Dispatra.', features: ['Orders, drivers, and vehicles', 'Rate cards and order pricing', 'AI assignment and optimized routes', 'Driver and shipper access'], action: 'Explore Full Workspace' },
  { id: 'dispatch', icon: Workflow, label: 'Your existing TMS', title: 'AI Dispatch', description: 'Add AI dispatch to your current workflow. Our team helps confirm compatibility and connection options.', features: ['Keep your current TMS', 'AI assignment and optimized routes', 'Delivery progress in one view', 'Compatibility and connection support'], action: 'Explore AI Dispatch' },
];
export function HomePlans() {
  return <section id="home-plans" aria-labelledby="home-plans-title" className="home-section home-plans">
    <div className="home-section-heading home-heading-centered"><p className="home-eyebrow">Plans</p><h2 id="home-plans-title">AI dispatch that fits your operation</h2><p>Use Dispatra’s workspace, or explore a connection to your existing TMS.</p></div>
    <div className="home-plan-grid">{offerings.map(({ id, icon: Icon, label, title, description, features, action }) => <article id={`home-plan-${id}`} className="home-plan" key={id}>
      <div className="home-plan-label"><Icon size={23} strokeWidth={1.4} aria-hidden="true" /><span>{label}</span></div><h3>{title}</h3><p className="home-plan-description">{description}</p>
      <ul>{features.map(feature => <li key={feature}><Check size={15} aria-hidden="true" />{feature}</li>)}</ul>
      <Button asChild variant={id === 'full' ? 'default' : 'outline'} className="w-fit"><a href={`/plans#plan-${id}`} aria-label={`Explore ${title}`}>{action}<ArrowRight size={15} aria-hidden="true" /></a></Button>
    </article>)}</div>
  </section>;
}
