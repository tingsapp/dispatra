import { useLayoutEffect, useRef } from 'react';
import type { MachineActivity } from '../api';

/** One finite animation per newly observed committed handoff, with its real reference. */
export function MachineTransfer({ event, path, reduced }: { event: MachineActivity; path: { id: string; d: string }; reduced: boolean }) {
  const motion = useRef<SVGElement | null>(null);
  useLayoutEffect(() => {
    const animation = motion.current as SVGAnimationElement | null;
    if (!reduced && typeof animation?.beginElement === 'function') animation.beginElement();
  }, [event.id, reduced]);
  const label = (event.reference || event.title).slice(0, 35);
  if (reduced) return <text className="machine-transfer-label" data-transfer-id={event.id}><textPath href={`#machine-path-${path.id}`} startOffset="25%">{label}</textPath></text>;
  return <g key={event.id} className={`machine-transfer transfer-${event.level.toLowerCase()}`} data-transfer-id={event.id}>
    <circle r="4" /><rect x="-4" y="-23" rx="4" height="17" width={label.length * 5.6 + 10} />
    <text x="1" y="-11">{label}</text><animateMotion ref={motion} begin="indefinite" dur="2.8s" repeatCount="1" path={path.d} fill="freeze" />
  </g>;
}
