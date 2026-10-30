import { BrandLogo } from '../layout/AppBrand';
import { useRef, useState } from 'react';
import { ArrowRight, Check, MapPinned, Package, Truck } from 'lucide-react';
const roles = [
  { id: 'dispatcher', label: 'Dispatcher', icon: MapPinned, title: 'Less coordinating. More control.', description: 'Let AI handle routine assignments and route planning while you oversee the day and focus on exceptions.', features: ['Automatic assignments and planned routes', 'Delivery progress and exceptions', 'Manual control when you need it'], href: '/dispatch' },
  { id: 'driver', label: 'Driver', icon: Truck, title: 'Your next move, already clear.', description: 'Get assigned orders, planned stops, and delivery instructions together. Share progress and capture proof as you go.', features: ['Assigned orders and stop instructions', 'Pickup and delivery progress', 'Proof of delivery'], href: '/driver' },
  { id: 'shipper', label: 'Shipper', icon: Package, title: 'Place the order. Stay in the loop.', description: 'Submit orders, follow delivery progress, and stay connected to the dispatch team without chasing updates.', features: ['Submit and review orders', 'Follow delivery progress', 'Message your dispatch team'], href: '/shipper' },
] as const;
export function HomeTeam() {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const role = roles[selected];
  return <section id="home-team" aria-labelledby="home-team-title" className="home-team-wrap"><div className="home-section">
    <div className="home-section-heading home-heading-centered"><p className="home-eyebrow">Connected team</p><h2 id="home-team-title">AI keeps your whole team in sync</h2><p>From the first request to the final delivery, Dispatra connects the work and keeps updates flowing. Less chasing, fewer manual handoffs, and everyone clear on what comes next.</p></div>
    <div role="tablist" aria-label="Explore team workspaces" className="home-team-tabs" onKeyDown={event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? roles.length - 1 : (selected + (event.key === 'ArrowRight' ? 1 : -1) + roles.length) % roles.length;
      setSelected(next); buttons.current[next]?.focus();
    }}>{roles.map(({ id, label, icon: Icon }, i) => <button ref={el => { buttons.current[i] = el; }} key={id} type="button" id={`home-tab-${id}`} role="tab" aria-selected={i === selected} aria-controls="home-team-panel" tabIndex={i === selected ? 0 : -1} onClick={() => setSelected(i)}><Icon size={16} strokeWidth={1.5} aria-hidden="true" />{label}</button>)}</div>
    <div id="home-team-panel" role="tabpanel" aria-labelledby={`home-tab-${role.id}`} className="home-team-content">
      <div className="home-team-copy"><h3>{role.title}</h3><p>{role.description}</p><ul>{role.features.map(feature => <li key={feature}><Check size={15} aria-hidden="true" />{feature}</li>)}</ul><a className="home-text-link" href={role.href}>Sign in as a {role.label.toLowerCase()}<ArrowRight size={14} aria-hidden="true" /></a></div>
      <figure className="home-team-screen" data-role={role.id}><div className="home-screen-bar"><span aria-hidden="true">● ● ●</span><span>Dispatra / {role.label.toLowerCase()}</span></div><div className="home-team-viewport"><img key={role.id} src={`/home/${role.id}-preview.png`} alt={role.id === 'dispatcher' ? 'Dispatcher map portal with Today’s plan and delivery route' : `${role.label} workspace showing delivery orders`} width={role.id === 'dispatcher' ? 1920 : 1200} height={role.id === 'dispatcher' ? 1080 : 760} loading="lazy" /><span className="home-team-brand" aria-hidden="true"><BrandLogo /></span></div></figure>
    </div>
  </div></section>;
}
