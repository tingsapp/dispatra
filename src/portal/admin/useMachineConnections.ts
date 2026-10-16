import type { MachineActivity } from '../api';
import { useLayoutEffect, useRef, useState } from 'react';

export type MachineLink = { id: string; from: string; to: string; route?: 'bypass' | 'bus' | 'return'; active: boolean; problem?: boolean; waiting?: boolean; event?: MachineActivity };
export function useMachineConnections(links: MachineLink[]) {
  const root = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState({ width: 1, height: 1, paths: [] as { id: string; d: string }[] });
  const layoutKey = links.map(link => `${link.id}:${link.from}:${link.to}:${link.route}`).join('|');
  useLayoutEffect(() => {
    const canvas = root.current;
    if (!canvas) return;
    const update = () => {
      const box = canvas.getBoundingClientRect();
      const vertical = (window.matchMedia?.('(max-width: 899px)').matches ?? window.innerWidth < 900);
      const paths = links.flatMap(link => {
        const source = canvas.querySelector<HTMLElement>(`[data-machine-port="${link.from}"]`);
        const target = canvas.querySelector<HTMLElement>(`[data-machine-port="${link.to}"]`);
        if (!source || !target) return [];
        const a = source.getBoundingClientRect(), b = target.getBoundingClientRect();
        const ax = a.left + a.width / 2 - box.left, ay = a.top + a.height / 2 - box.top;
        const bx = b.left + b.width / 2 - box.left, by = b.top + b.height / 2 - box.top;
        let d: string;
        if (link.route === 'bypass') {
          d = vertical ? `M ${a.left - box.left} ${ay} H ${a.left - box.left - 15} V ${by} H ${b.left - box.left}`
            : `M ${ax} ${a.top - box.top} V ${a.top - box.top - 58} H ${bx} V ${b.top - box.top}`;
        } else if (link.route === 'return') {
          const middle = Math.max(a.bottom, b.bottom) - box.top + 92;
          d = vertical ? `M ${a.right - box.left} ${ay} H ${box.width - 6} V ${by} H ${b.right - box.left}` : `M ${ax} ${a.bottom - box.top} V ${middle} H ${bx} V ${b.bottom - box.top}`;
        } else if (link.route === 'bus') {
          const middle = vertical ? by - b.height / 2 - 25 : b.top - box.top - 30;
          d = vertical ? `M ${a.left - box.left} ${ay} H ${a.left - box.left - 8} V ${middle} H ${bx} V ${b.top - box.top}` : `M ${ax} ${a.bottom - box.top} V ${middle} H ${bx} V ${b.top - box.top}`;
        } else {
          d = vertical ? `M ${ax} ${a.bottom - box.top} V ${b.top - box.top}` : `M ${a.right - box.left} ${ay} H ${b.left - box.left}`;
        }
        return [{ id: link.id, d }];
      });
      setDrawing({ width: box.width || 1, height: box.height || 1, paths });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(canvas);
    canvas.querySelectorAll<HTMLElement>('[data-machine-node]').forEach(node => observer?.observe(node));
    window.addEventListener('resize', update);
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); };
    // Signal state does not change geometry; measure only when structure or size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);
  return { root, drawing };
}
