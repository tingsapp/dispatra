import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Check, CheckCheck, CircleCheck, FileCheck2, Mail, PackageCheck, Plug, UserRound, Users } from 'lucide-react';
import { PreviewMap } from './PreviewMap';
import { StopMarkerCircle } from '../map/StopMarkerCircle';

export function OrderIntake() {
  return <div className="process-scene process-intake" role="img" aria-label="Email, shipper portal, direct dispatcher entry and configured TMS or API connections become a prepared Dispatra order">
    <div className="process-sources">{[
      { name: 'Email', detail: 'Incoming requests', icon: Mail },
      { name: 'Shipper portal', detail: 'Direct bookings', icon: Users },
      { name: 'Dispatcher', detail: 'Direct order entry', icon: UserRound },
      { name: 'TMS / API', detail: 'Configured connections', icon: Plug },
    ].map(({ name, detail, icon: Icon }) => <div className="process-source" key={name}><Icon size={20} strokeWidth={1.4} aria-hidden="true" /><span><strong>{name}</strong><small>{detail}</small></span></div>)}</div>
    <div className="process-converge" aria-hidden="true"><svg viewBox="0 0 100 240" preserveAspectRatio="none"><path d="M0 25H20Q40 25 40 50V100Q40 120 60 120H100M0 88H20Q40 88 40 105Q40 120 60 120M0 152H20Q40 152 40 135Q40 120 60 120M0 215H20Q40 215 40 190V140Q40 120 60 120" /></svg><ArrowRight size={17} /></div>
    <ArrowDown className="process-mobile-arrow" size={20} aria-hidden="true" />
    <div className="process-prepared-order"><div className="process-order-heading"><FileCheck2 size={18} strokeWidth={1.5} aria-hidden="true" /><span>Dispatra order</span><span className="process-order-number">#1042</span></div><dl><div><dt>Pickup</dt><dd>Vancouver</dd></div><div><dt>Delivery</dt><dd>Richmond</dd></div><div><dt>Items</dt><dd>2 parcels</dd></div><div><dt>Requested</dt><dd>Today</dd></div></dl><span className="process-success"><CheckCheck size={16} aria-hidden="true" />Details prepared</span></div>
  </div>;
}

export function DriverComparison() {
  return <div className="process-scene process-comparison" aria-label="Driver comparison and selection">
    <div className="process-comparison-context"><PackageCheck size={17} aria-hidden="true" /><span>Order #1042</span><span className="process-comparison-context-end">Comparing drivers</span></div>
    <div className="process-driver-grid">{[
      { name: 'Jordan', eligibility: 'Eligible', distance: 'Farther pickup', vehicle: 'Vehicle fits', selected: false },
      { name: 'Alex', eligibility: 'Eligible', distance: 'Closer pickup', vehicle: 'Vehicle fits', selected: true },
      { name: 'Morgan', eligibility: 'Off duty', distance: 'Unavailable', vehicle: 'Not considered', selected: false },
    ].map(driver => <div className="process-driver" data-selected={driver.selected} key={driver.name}>
      <span className="process-driver-avatar"><UserRound size={25} strokeWidth={1.3} aria-hidden="true" /></span><strong>{driver.name}</strong><span className="process-driver-eligibility">{driver.eligibility}</span>
      <div className="process-driver-facts"><span>{driver.vehicle}</span><span>{driver.distance}</span></div>
      <span className="process-driver-outcome">{driver.selected ? <><CircleCheck size={14} aria-hidden="true" />Best match</> : driver.eligibility === 'Eligible' ? 'Compared' : 'Unavailable'}</span>
    </div>)}</div>
    <p className="process-selection"><CircleCheck size={16} aria-hidden="true" />Alex selected<span>Ready for the route</span></p>
  </div>;
}

const selectedRoute = 'M225 385V277Q225 265 237 265H293Q305 265 305 253V217Q305 205 317 205H453Q465 205 465 193V93';
export function RouteComparison() {
  const artwork = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState('120 70 460 340');
  useLayoutEffect(() => {
    const element = artwork.current;
    if (!element) return;
    const fit = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const aspect = width / height;
      const viewWidth = Math.max(460, 340 * aspect);
      const viewHeight = Math.max(340, 460 / aspect);
      setViewBox(`${350 - viewWidth / 2} ${240 - viewHeight / 2} ${viewWidth} ${viewHeight}`);
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  return <div className="process-scene process-routing" aria-label="Comparison of three routes with the best path selected">
    <div className="process-route-map"><div ref={artwork} className="process-route-art"><PreviewMap viewBox={viewBox} fit="meet" /><svg className="process-route-alternatives" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path className="process-route-option-halo" d="M225 385H157Q145 385 145 373V147Q145 135 157 135H453Q465 135 465 123V93" /><path className="process-route-option" d="M225 385H157Q145 385 145 373V147Q145 135 157 135H453Q465 135 465 123V93" /><path className="process-route-option-halo" d="M225 385H533Q545 385 545 373V217Q545 205 533 205H477Q465 205 465 193V93" /><path className="process-route-option" d="M225 385H533Q545 385 545 373V217Q545 205 533 205H477Q465 205 465 193V93" /><path className="process-route-selected" d={selectedRoute} pathLength="1" /><g data-process-stop-markers="true"><g className="process-stop-label"><rect x={144} y={349} width={68} height={28} rx={5} /><text x={178} y={367} textAnchor="middle">Pickup</text></g><g className="process-stop-label"><rect x={480} y={102} width={76} height={28} rx={5} /><text x={518} y={120} textAnchor="middle">Delivery</text></g><StopMarkerCircle kind="PICKUP" cx={225} cy={385} /><StopMarkerCircle kind="DROPOFF" cx={465} cy={93} /></g></svg></div></div>
    <div className="process-route-choices"><span><i />Longer route</span><span><i />Extra travel</span><span className="process-route-choice-selected"><Check size={14} aria-hidden="true" />Best path selected</span></div>
  </div>;
}

export function SignedDelivery() {
  return <div className="process-scene process-delivered" aria-label="Order 1042 completed with customer signature collected">
    <div className="process-completion"><span className="process-completion-icon"><PackageCheck size={39} strokeWidth={1.25} aria-hidden="true" /></span><span className="process-completion-number">Order #1042</span><strong>Delivered.</strong><span className="process-success"><CircleCheck size={16} aria-hidden="true" />Completed</span></div>
    <div className="process-signature"><div className="process-signature-heading"><FileCheck2 size={17} aria-hidden="true" /><span>Proof of delivery</span><Check size={16} aria-hidden="true" /></div><div className="process-signature-canvas"><svg viewBox="0 0 280 110" aria-label="Customer signature" role="img"><path pathLength="1" d="M27 79C43 57 64 13 57 24C43 43 34 80 48 69L81 40C61 63 71 81 82 64L96 48C82 75 96 77 112 57C100 78 120 75 135 51C122 82 145 76 155 59C141 85 168 64 178 55C167 77 184 76 201 57C189 80 215 69 235 60M64 91C102 84 159 86 246 82" /></svg><span>Customer signature</span></div><p><CheckCheck size={16} aria-hidden="true" />Signature collected</p></div>
  </div>;
}
