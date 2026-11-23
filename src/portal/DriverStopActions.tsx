import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Check, MapPin, MessageSquare, Route as RouteIcon, TriangleAlert } from 'lucide-react';
import { operations } from '../operations/api';
import type { DriverDayStop, DriverRoute } from './driverDayPlan';
import { ARRIVAL_LOCATION_ERROR, driverRouteStep, googleDirections, isCurrentStopNearby, issueReady, nextVisit, pickupQuantities, podReady, stepHere, type DriverFix, type DriverStep, type DriverStepKind } from './driverStopStep';
import { Button, Notice } from './ui';

const STEP_ICONS: Record<DriverStepKind, typeof RouteIcon> = { start: RouteIcon, navigate: RouteIcon, pickup: RouteIcon, arrive: MapPin, finish: Check, sync: RouteIcon };
const tooLate = (error: unknown) => error instanceof Error && error.message.toLowerCase().includes('too late')
  ? new Error('This order cannot start because its delivery time has passed. Ask dispatch to update it.') : error;

export interface DriverStepPort {
  slug: string;
  fix: DriverFix | null;
  shareLocation: () => Promise<void>;
  locate: () => Promise<DriverFix>;
  onStartRoute: (route: DriverRoute) => Promise<void>;
  onFinishRoute: (route: DriverRoute) => Promise<void>;
}

/** Runs a stop's route step with the driver app's checks; one step at a time across the day. */
export function useDriverStopSteps({ slug, shareLocation, locate, onStartRoute, onFinishRoute }: DriverStepPort) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<{ rowId: string; cause: unknown }>();
  const navigate = async (route: DriverRoute, tab: Window | null, skipVisitId?: string) => {
    await shareLocation();
    const visits = route.stops.filter(visit => visit.status !== 'COMPLETED' && visit.id !== skipVisitId);
    if (route.status !== 'IN_PROGRESS' || !visits.length) throw new Error('No next stop. Refresh the order.');
    const url = googleDirections(visits);
    if (tab) tab.location.href = url; else window.open(url, '_blank', 'noopener');
  };
  const run = async (row: DriverDayStop, route: DriverRoute, step: DriverStep) => {
    if (busy || step.disabled) return;
    // Directions open in a tab reserved during the click, so the browser does not block it after the request.
    const tab = step.kind === 'navigate' || step.kind === 'pickup' ? window.open('', '_blank') : null;
    if (tab) tab.opener = null;
    setBusy(row.id); setError(undefined);
    try {
      if (step.kind === 'start') await onStartRoute(route);
      else if (step.kind === 'sync') await operations.acknowledgeRoute(slug, route, crypto.randomUUID());
      else if (step.kind === 'navigate') await navigate(route, tab);
      else if (step.kind === 'finish') await onFinishRoute(route);
      else if (step.kind === 'arrive') {
        if (!isCurrentStopNearby(route, await locate())) throw new Error(ARRIVAL_LOCATION_ERROR);
        await operations.arriveStop(slug, route, step.visit!.id);
      } else {
        const visit = nextVisit(route);
        if (!visit || visit.id !== step.visit?.id || visit.stop.kind !== 'PICKUP' || !visit.arrived_at) throw new Error('Confirm arrival at the current pickup before confirming loading.');
        const loaded = pickupQuantities(route, visit);
        if (!Object.keys(loaded).length) throw new Error('Item links are missing. Contact dispatch.');
        await operations.completeStop(slug, route, visit.id, { quantities: loaded, recipient_name: '', unattended: false, safe_placement: false, evidence_ids: [] });
        await navigate(route, tab, visit.id);
      }
    } catch (cause) { tab?.close(); setError({ rowId: row.id, cause: tooLate(cause) }); }
    finally {
      await Promise.all(['driver-orders', 'driver-routes', 'driver-profile'].map(key => cache.invalidateQueries({ queryKey: [key, slug] })));
      setBusy(undefined);
    }
  };
  return { busy, error, run };
}

/** Message, Upload POD, Report and the route step, with the driver app's order and rules. */
export function DriverStopActions({ row, route, fix, busy, running, error, onChat, onProof, onReport, onStep }: {
  row: DriverDayStop; route?: DriverRoute; fix: DriverFix | null; busy: boolean; running: boolean; error?: unknown;
  onChat: () => void; onProof: () => void; onReport: () => void; onStep: (route: DriverRoute, step: DriverStep) => void;
}) {
  const { visit } = row;
  const name = row.stop.kind === 'PICKUP' ? 'Pickup' : 'Delivery';
  const completed = visit?.status === 'COMPLETED';
  const step = driverRouteStep(route, fix);
  const here = stepHere(step, route, visit);
  const StepIcon = step ? STEP_ICONS[step.kind] : RouteIcon;
  const issueHint = 'Available once your route has started and this is the order’s next stop.';
  const podHint = 'Available after you arrive at this stop.';
  const reportReady = issueReady(route, visit, row.order);
  const proofReady = podReady(route, visit);
  return <>
    <div className="driver-stop-actions">
      <Button type="button" size="xs" variant="outline" className="driver-stop-action" aria-label={`Message shipper for ${name} ${row.order.number}`} onClick={onChat}><MessageSquare aria-hidden="true" />Message</Button>
      {row.stop.kind === 'DROPOFF' && (completed ? <span className="driver-stop-action-note">POD submitted</span>
        : <Button type="button" size="xs" variant="outline" className="driver-stop-action" aria-label={`Upload POD for ${name} ${row.order.number}`}
          disabled={!proofReady || busy} title={proofReady ? undefined : podHint} onClick={onProof}><Camera aria-hidden="true" />Upload POD</Button>)}
      {!completed && <Button type="button" size="xs" variant="outline" className="driver-stop-action driver-stop-report" aria-label={`Report issue for ${name} ${row.order.number}`}
        disabled={!reportReady || busy} title={reportReady ? undefined : issueHint} onClick={onReport}><TriangleAlert aria-hidden="true" />Report</Button>}
      {here && step && route && <Button type="button" size="xs" className="driver-stop-action" aria-label={step.title} loading={running}
        disabled={!!step.disabled || busy} onClick={() => onStep(route, step)}><StepIcon aria-hidden="true" />{step.kind === 'navigate' || step.kind === 'pickup' ? 'Navigate' : step.title}</Button>}
    </div>
    {here && step?.kind === 'pickup' && <p className="driver-stop-action-hint">Tapping Navigate confirms all items at this pickup are loaded.</p>}
    {!!error && <div className="driver-stop-action-error"><Notice error={error} /></div>}
  </>;
}
