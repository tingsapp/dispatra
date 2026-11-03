import { useEffect, useRef } from 'react';
import { AgentMap } from './AgentMap';
import { StopMarkerCircle } from '../map/StopMarkerCircle';
import { ArrowUp, Bell, Cog, PackageCheck, FileText, Globe, Monitor, Network, ScanEye, MailOpen, Truck, Route, MessagesSquare } from 'lucide-react';

/** Illustrative homepage scenes only; operational records remain API-owned. */
export function StackedAgentFeatures() {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const motion = window.matchMedia?.('(prefers-reduced-motion:reduce)');
    const syncMotion = () => {
      const scenes = new Set(Array.from(element.querySelectorAll('animateMotion'), node => node.ownerSVGElement));
      scenes.forEach(svg => {
        if (!svg) return;
        const paused = document.hidden || Boolean(motion?.matches) || !svg.closest('.feature')?.classList.contains('active');
        if (paused) svg.pauseAnimations?.();
        else svg.unpauseAnimations?.();
      });
    };
    const onVisibility = () => { element.dataset.paused = String(document.hidden); syncMotion(); };
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('active', entry.isIntersecting));
      syncMotion();
    }, { threshold: .15 });
    element.querySelectorAll('.feature').forEach(row => observer?.observe(row));
    document.addEventListener('visibilitychange', onVisibility);
    motion?.addEventListener('change', syncMotion);
    onVisibility();
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', onVisibility); motion?.removeEventListener('change', syncMotion); };
  }, []);
  useEffect(() => {
    const element = section.current;
    const stage = element?.querySelector<HTMLElement>('.feature-stage');
    if (!element || !stage || !stage.getClientRects().length) return;
    const rows = Array.from(stage.querySelectorAll<HTMLElement>('.feature'));
    const screen = stage.querySelector<HTMLElement>('.feature-screen');
    const media = window.matchMedia?.('(min-height:701px) and (prefers-reduced-motion:no-preference)');
    let frame = 0;
    const update = () => {
      frame = 0;
      const stacked = Boolean(media?.matches);
      if (element.dataset.stacked !== String(stacked)) element.dataset.stacked = String(stacked);
      // Only this section's stage and the viewport determine the stack motion.
      const screenHeight = screen?.getBoundingClientRect().height || 676;
      const pinTop = Math.max(0, (window.innerHeight - screenHeight) / 2);
      const stride = Math.max(...rows.map(row => row.offsetHeight)) || 444;
      element.style.setProperty('--stack-top', `${pinTop}px`);
      element.style.setProperty('--stage-height', `${(rows.length - 1) * stride + screenHeight}px`);
      const progress = Math.max(0, pinTop - stage.getBoundingClientRect().top);
      const scale = window.devicePixelRatio || 1;
      rows.forEach((row, index) => {
        row.style.setProperty('--layer-index', String(index));
        const y = stacked ? Math.round(Math.max(index * 58, index * stride - progress) * scale) / scale : 0;
        const transform = `translate3d(0, ${y}px, 0)`;
        if (row.style.transform !== transform) row.style.transform = transform;
      });
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    media?.addEventListener('change', schedule);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    if (screen) resizeObserver?.observe(screen);
    rows.forEach(row => resizeObserver?.observe(row));
    update();
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      media?.removeEventListener('change', schedule);
    };
  }, []);
  return (<section id="how-it-works" aria-label="Dispatra agents at work" className="home-section home-stacked-features" ref={section}>
<div className="feature-stage"><div className="feature-screen">
<div className="agent-section-intro">
<p className="home-eyebrow">How it works</p>
<h2>Dispatra at work</h2>
<p>AI agents work together to run your dispatch, with Chat answering questions on demand.</p>
</div>
<div className="feature-viewport">
<section className="feature active" data-step="0">
<div className="feature-copy">
<span className="num">01</span>
<div>
<h3>Order Agent</h3>
<p>Reads incoming requests, extracts delivery details and creates orders.</p>
</div>
</div>
<div className="visual intake">
<FileText className="layer-corner-icon" size={19} aria-hidden="true" />

<svg className="order-connections" viewBox="0 0 600 405" preserveAspectRatio="none" aria-hidden="true">
{[90,165,240,315].map((y, index) => {
 const port = 168 + index * 18;
 const bend = [260, 230, 230, 260][index];
 const path = `M174 ${y} H${bend - 10} Q${bend} ${y} ${bend} ${y < port ? y + 10 : y - 10} V${port + (y < port ? -10 : 10)} Q${bend} ${port} ${bend + 10} ${port} H282`;
 return <g key={y}><path d={path}/><circle r="3"><animateMotion dur="16s" begin={`${index * 4}s`} calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines=".4 0 .2 1" repeatCount="indefinite" path={path}/></circle><circle className="order-port" cx="282" cy={port} r="3"/></g>;
})}
<path d="M366 202H420" />

</svg>
<div className="order-sources">{[
 { name: 'Email', Icon: MailOpen },
 { name: 'Shipper portal', Icon: Globe },
 { name: 'Dispatra portal', Icon: Monitor },
 { name: 'External TMS', Icon: Network },
].map(({ name, Icon }) => <div className="order-source" key={name}><Icon size={21} aria-hidden="true" /><span>{name}</span></div>)}</div>
<div className="order-processing"><span><Cog size={38} aria-hidden="true" /></span><strong>Order Agent</strong></div>
<div className="order-result"><PackageCheck size={30} aria-hidden="true" /><small>ORDER CREATED</small><strong>D-1042</strong><span className="order-result-lines" aria-hidden="true"><i/><i/><i/></span><b>✓ Verified</b></div>
</div>
</section>
<section className="feature active" data-step="1">
<div className="feature-copy">
<span className="num">02</span>
<div>
<h3>Dispatch Agent</h3>
<p>Checks driver availability and vehicle capacity, then assigns the order.</p>
</div>
</div>
<div className="visual assignment">
<Truck className="layer-corner-icon" size={19} aria-hidden="true" />

<div className="assignment-title">
<small>ORDER D-1042</small>
<strong>Choose an eligible driver</strong>
<span>48 kg · Richmond → Kitsilano · before 2 PM</span>
</div>
<div className="dispatch-phone" aria-label="Driver phone receives an assignment notification"><div className="phone-status"><span>12:02</span><span aria-hidden="true">▮▮▮ ▰</span></div><span className="phone-camera"/><span className="lock-date">Tuesday, November 3</span><strong className="lock-time">12:02</strong><div className="driver-notification"><span className="push-app-icon"><Truck size={15} aria-hidden="true"/></span><div><span className="push-app-name">Dispatra <small>now</small></span><strong>New delivery assigned</strong><span className="push-preview">D-1042 · Tap to view delivery</span></div></div><div className="lock-shortcuts" aria-hidden="true"><span>◉</span><span>▣</span></div></div>
<div className="dispatch-roster">
<div className="dispatch-hand" aria-hidden="true"><svg viewBox="0 0 32 38"><path d="M11 19V5a3 3 0 0 1 6 0v10-3a3 3 0 0 1 5 0v3a3 3 0 0 1 5 1v2a3 3 0 0 1 4 3v6c0 6-4 10-10 10h-3c-3 0-5-1-7-4L3 23c-2-3 2-6 4-4l4 4Z" fill="#fff" stroke="#20242a" strokeWidth="1.5" strokeLinejoin="round"/></svg></div>
<div className="driver j">
<img src="/home/agents/jamie.jpg" alt="Sample driver portrait" />
<div>
<strong>Jamie Lee</strong>
<small>On delivery until 2:20 PM</small>
</div>
<span className="check">
</span>
</div>
<div className="driver a">
<img src="/home/agents/alex.jpg" alt="Sample driver portrait" />
<div>
<strong>Alex Morgan</strong>
<small>Available · V-08 · 172 kg free</small>
</div>
<span className="check">✓</span>
</div>
<div className="driver s">
<img src="/home/agents/sam.jpg" alt="Sample driver portrait" />
<div>
<strong>Sam Patel</strong>
<small>Available · V-12 · 32 kg free</small>
</div>
<span className="check">
</span>
</div>
</div><div className="assigned">✓ Alex + V-08 assigned · 124 kg remaining</div>
</div>
</section>
<section className="feature active" data-step="2">
<div className="feature-copy">
<span className="num">03</span>
<div>
<h3>Route Agent</h3>
<p>Sequences pickup and delivery stops and optimizes the route around delivery requirements.</p>
</div>
</div>
<div className="visual route">
<AgentMap />
<Route className="layer-corner-icon" size={19} aria-hidden="true" />

<svg viewBox="0 0 600 405" preserveAspectRatio="none" className="route-map route-simple" aria-label="Pickup and delivery connected by an optimized route">
<path className="route-simple-line" d="M110 225H248Q258 225 258 215V165Q258 155 268 155H450" pathLength="1"/>
</svg>
{([{ x:110, y:225, label:'Pickup', kind:'PICKUP' },{ x:450, y:155, label:'Drop-off', kind:'DROPOFF' }] as const).map(({ x,y,label,kind }) => <div className="route-stop-marker" key={label} style={{ left:`${x / 6}%`, top:`${y / 4.05}%` }}><svg width="24" height="24" viewBox="0 0 24 24"><StopMarkerCircle kind={kind}/></svg><span>{label}</span></div>)}

<div className="route-simple-status"><Cog size={16} aria-hidden="true"/><span>Route optimized</span><span className="route-status-check">✓</span></div>
</div>
</section>
<section className="feature active" data-step="3">
<div className="feature-copy">
<span className="num">04</span>
<div>
<h3>Chat Agent</h3>
<p>Available at any step, using order, driver, assignment and route context.</p>
</div>
</div>
<div className="visual chat-scene">
<MessagesSquare className="layer-corner-icon" size={19} aria-hidden="true" />
<div className="chat-window">
<div className="demo-chat-header">Dispatra <span className="chat-online">●</span></div>
<div className="chat-conversation">
<div className="chat-question"><small>You</small><span>Where is order D-1042?</span></div>
<div className="chat-typing" aria-hidden="true"><i/><i/><i/></div>
<div className="reply"><small>Dispatra</small><span className="chat-answer-line chat-answer-first">Alex is on the way with Maya’s chairs.</span><strong className="chat-answer-line chat-answer-second">Expected arrival: 12:48 PM.</strong><div className="chat-order-reference">D-1042 <span>Out for delivery</span></div></div>
</div>
<div className="demo-composer" aria-label="Example chat composer"><span className="chat-composer-placeholder">Ask about an order…</span><span className="demo-send" aria-hidden="true"><ArrowUp size={14}/></span></div>
</div>
</div>
</section>
<section className="feature active" data-step="4">
<div className="feature-copy"><span className="num">05</span><div><h3>Supervisor Agent</h3><p>Monitors the other four agents, receives their reports and flags anything that needs attention.</p></div></div>
<div className="visual supervisor-scene">
<ScanEye className="layer-corner-icon" size={19} aria-hidden="true" />
<svg className="supervisor-connections" viewBox="0 0 600 405" preserveAspectRatio="none" aria-hidden="true">
{[85,165,245,325].map((y, index) => {
 const port = 178 + index * 16;
 const bend = [350, 375, 375, 350][index];
 const path = `M420 ${y} H${bend + 10} Q${bend} ${y} ${bend} ${y < port ? y + 10 : y - 10} V${port + (y < port ? -10 : 10)} Q${bend} ${port} ${bend - 10} ${port} H240`;
 return <g key={y}><path d={path}/><circle r="3"><animateMotion dur="16s" begin={`${index * 4}s`} calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines=".4 0 .2 1" repeatCount="indefinite" path={path}/></circle></g>;
})}
</svg>
<div className="supervisor-monitor"><span className="supervisor-hub-icon"><ScanEye size={34} aria-hidden="true" /><span className="supervisor-bell"><Bell size={16} /><i /></span></span><strong>Supervisor</strong></div>
<div className="supervisor-agents">{[
  { name: 'Order', Icon: FileText },
  { name: 'Dispatch', Icon: Truck },
  { name: 'Route', Icon: Route },
  { name: 'Chat', Icon: MessagesSquare },
].map(({ name, Icon }) => <div key={name} className="supervisor-agent"><span className="agent-working-icon"><Icon size={24} aria-hidden="true" /><Cog className="agent-gear" size={18} aria-hidden="true" /></span><strong>{name}</strong></div>)}</div>

</div>
</section>
</div>
</div>
</div>
</section>);
}
