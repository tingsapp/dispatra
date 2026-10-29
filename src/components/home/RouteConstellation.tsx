import { useEffect, useRef } from 'react';

type Point = { x: number; y: number; z: number };
const TAU = Math.PI * 2;
const BLUE = '20,71,230';

// A fixed, front-facing trefoil matches the logo silhouette. Particles flow
// around one continuous woven curve instead of rotating its shape in 3D.
function project(angle: number, lane: number, orbit: number): Point {
  const t = angle + orbit * TAU / 3;
  const x = Math.sin(t) + 2 * Math.sin(2 * t);
  const y = -Math.cos(t) + 2 * Math.cos(2 * t);
  const dx = Math.cos(t) + 4 * Math.cos(2 * t);
  const dy = Math.sin(t) - 4 * Math.sin(2 * t);
  const length = Math.hypot(dx, dy);
  return {
    x: 260 + x * 70 - dy / length * lane * 2.2,
    y: 202 + y * 57 + dx / length * lane * 2.2,
    z: Math.sin(3 * t) * 90,
  };
}

function draw(ctx: CanvasRenderingContext2D, time: number) {
  ctx.clearRect(0, 0, 520, 460);
  const shadow = ctx.createRadialGradient(260, 410, 0, 260, 410, 158);
  shadow.addColorStop(0, 'rgba(51,74,118,.09)'); shadow.addColorStop(1, 'rgba(51,74,118,0)');
  ctx.fillStyle = shadow; ctx.save(); ctx.translate(0, 328); ctx.scale(1, .2); ctx.fillRect(65, 0, 390, 820); ctx.restore();
  // Hairline tracks establish a continuous route beneath the flowing dots.
  for (let orbit = 0; orbit < 1; orbit++) {
    ctx.beginPath();
    for (let n = 0; n <= 360; n++) {
      const p = project(n / 360 * TAU, 0, orbit);
      if (n === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = `rgba(${BLUE},.10)`; ctx.lineWidth = .65; ctx.stroke();
  }
  const dots: (Point & { orbit: number; lane: number; angle: number; packet: boolean })[] = [];
  for (let orbit = 0; orbit < 1; orbit++) {
    for (let lane = -3; lane <= 3; lane++) {
      for (let n = 0; n < 288; n++) {
        const angle = n / 288 * TAU + time * (.105 + orbit * .012);
        dots.push({ ...project(angle, lane, orbit), orbit, lane, angle, packet: false });
      }
    }
    for (let n = 0; n < 3; n++) {
      const angle = time * .32 + orbit * 1.9 + n * TAU / 3;
      dots.push({ ...project(angle, 0, orbit), orbit, lane: 0, angle, packet: true });
    }
  }
  dots.sort((a, b) => a.z - b.z);
  for (const p of dots) {
    const depth = (p.z + 200) / 400;
    const blue = Math.sin(p.angle * 2 + p.orbit + time * .12) > .4;
    if (p.packet) {
      // Solid order signals move along the same geometry as the route ribbons.
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle * .4);
      ctx.shadowColor = `rgba(${BLUE},.22)`; ctx.shadowBlur = 12;
      ctx.fillStyle = p.orbit === 1 ? '#172643' : '#1447e6';
      ctx.beginPath(); ctx.roundRect(-4.5, -4.5, 9, 9, 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-2, -.6, 4, 1.2); ctx.restore();
    } else {
      ctx.fillStyle = blue ? `rgba(${BLUE},${.20 + depth * .60})` : `rgba(82,105,134,${.10 + depth * .34})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, .65 + depth * .75, 0, TAU); ctx.fill();
    }
  }
}

export function RouteConstellation({ running }: { running: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    let frame = 0;
    let last = 0;
    const paint = () => draw(ctx, elapsed.current);
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = 520 * ratio; element.height = 460 * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); paint();
    };
    resize();
    window.addEventListener('resize', resize);
    const tick = (now: number) => {
      if (last) elapsed.current += Math.min((now - last) / 1000, .05);
      last = now; paint(); frame = requestAnimationFrame(tick);
    };
    if (running) frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, [running]);
  return <canvas ref={canvas} width={520} height={460} className="why-dispatra-canvas" aria-hidden="true" />;
}
