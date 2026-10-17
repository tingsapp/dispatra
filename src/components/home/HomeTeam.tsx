import { useRef, useState } from 'react';
import { ArrowRight, Check, MapPinned, Package, Truck } from 'lucide-react';
const roles = [
  { id: 'dispatcher', label: 'Dispatcher', icon: MapPinned, title: 'The whole delivery day, in view.', description: 'Bring orders, drivers, and routes together. Follow progress and give your attention to the decisions that need it.', features: ['Review orders and delivery progress', 'Choose Manual or Auto assignment', 'Keep the team connected'], href: '/dispatch' },
  { id: 'driver', label: 'Driver', icon: Truck, title: 'A clear next step at every stop.', description: 'Give drivers access to their assigned orders, pickup and delivery details, and the tools to capture completion.', features: ['See assigned orders and stop instructions', 'Work through pickup and delivery', 'Capture delivery proof'], href: '/driver' },
  { id: 'shipper', label: 'Shipper', icon: Package, title: 'Keep your customers in the loop.', description: 'Give shippers their own view to create orders, follow deliveries, and stay connected to your team.', features: ['Create and review their own orders', 'Follow delivery progress', 'Message about an order'], href: '/shipper' },
] as const;
export function HomeTeam() {
  const [selected, setSelected] = useState(1);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const role = roles[selected];
  return <section id="home-team" aria-labelledby="home-team-title" className="home-team-wrap"><div className="home-section">
    <div className="home-section-heading home-heading-centered"><p className="home-eyebrow">Different roles. The same delivery.</p><h2 id="home-team-title">One connected team.</h2><p>Give everyone a clear view of their part of the day.</p></div>
    <div role="tablist" aria-label="Explore team workspaces" className="home-team-tabs" onKeyDown={event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? roles.length - 1 : (selected + (event.key === 'ArrowRight' ? 1 : -1) + roles.length) % roles.length;
      setSelected(next); buttons.current[next]?.focus();
    }}>{roles.map(({ id, label, icon: Icon }, i) => <button ref={el => { buttons.current[i] = el; }} key={id} type="button" id={`home-tab-${id}`} role="tab" aria-selected={i === selected} aria-controls="home-team-panel" tabIndex={i === selected ? 0 : -1} onClick={() => setSelected(i)}><Icon size={16} strokeWidth={1.5} aria-hidden="true" />{label}</button>)}</div>
    <div id="home-team-panel" role="tabpanel" aria-labelledby={`home-tab-${role.id}`} className="home-team-content">
      <div className="home-team-copy"><span className="home-team-role">For your {role.label.toLowerCase()}s</span><h3>{role.title}</h3><p>{role.description}</p><ul>{role.features.map(feature => <li key={feature}><Check size={15} aria-hidden="true" />{feature}</li>)}</ul><a className="home-text-link" href={role.href}>Sign in as a {role.label.toLowerCase()}<ArrowRight size={14} aria-hidden="true" /></a></div>
      <figure className="home-team-screen" data-role={role.id}><div className="home-screen-bar"><span aria-hidden="true">● ● ●</span><span>Dispatra / {role.label.toLowerCase()}</span><span className="home-screen-sample">Sample workspace</span></div><div className="home-team-viewport"><img key={role.id} src={`/home/${role.id}-preview.png`} alt={role.id === 'dispatcher' ? 'Dispatcher Monitor with expanded sidebar and Live activity panel' : `${role.label} workspace with sample delivery orders`} width={role.id === 'dispatcher' ? 1920 : 1200} height={role.id === 'dispatcher' ? 1080 : 760} loading="lazy" /></div><figcaption>Actual Dispatra interface · Sample data</figcaption></figure>
    </div>
  </div></section>;
}
