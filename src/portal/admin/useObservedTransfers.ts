import { useEffect, useRef, useState } from 'react';
import type { MachineActivity, MachineTelemetry } from '../api';

/** Observe a committed transfer once. Initial history and reconnect backlogs never become live traffic. */
export function useObservedTransfers(machine: MachineTelemetry | null | undefined, scope: string, disabled: boolean, updatedAt?: number) {
  const observed = useRef({ scope, ready: false, seen: new Set<string>() });
  const [signals, setSignals] = useState<MachineActivity[]>([]);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [clock, setClock] = useState(Date.now);
  const stale = !updatedAt || clock - updatedAt > 15_000;
  useEffect(() => {
    const visibility = () => { setClock(Date.now()); setHidden(document.hidden); observed.current.ready = false; setSignals([]); };
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => { document.removeEventListener('visibilitychange', visibility); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (observed.current.scope !== scope) observed.current = { scope, ready: false, seen: new Set() };
    const tracker = observed.current;
    if (!machine || disabled || hidden || stale) { tracker.ready = false; setSignals([]); return; }
    const now = Date.parse(machine.observed_at);
    const fresh = machine.activity.filter(entry => !tracker.seen.has(entry.id) && entry.from_node && entry.from_node !== entry.to_node && now - Date.parse(entry.created_at) <= 20_000 && now >= Date.parse(entry.created_at));
    const wasReady = tracker.ready;
    machine.activity.forEach(entry => tracker.seen.add(entry.id));
    if (tracker.seen.size > 1000) tracker.seen = new Set(machine.activity.map(entry => entry.id));
    tracker.ready = true;
    if (wasReady && fresh.length) setSignals(fresh.slice(0, 8));
    // Unchanged snapshots do not replay transfers or reset their lifetime.
  }, [machine, scope, disabled, hidden, stale]);
  useEffect(() => {
    if (!signals.length) return;
    const timer = window.setTimeout(() => setSignals([]), 3400);
    return () => window.clearTimeout(timer);
  }, [signals]);
  return { signals, stale };
}
