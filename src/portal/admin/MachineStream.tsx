import { useQuery } from '@tanstack/react-query';
import { Terminal } from 'lucide-react';
import { api, type MachineTelemetry } from '../api';
import { agentKeys } from './queryKeys';
import { AGENTS } from './agentPresentation';
import { clockTime } from '../../lib/dateTimeFormat';
import { SAMPLE_FLOW } from './useMachineDemo';

const labels: Record<string, string> = { inputs: 'Booking inputs', data: 'Order data', delivery: 'Delivery', ...Object.fromEntries(Object.entries(AGENTS).map(([key, value]) => [key, value.name])) };
function observedAge(value: string, observed: string) {
  const seconds = Math.max(0, Math.floor((Date.parse(observed) - Date.parse(value)) / 1000));
  return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
}
export function MachineStream({ accountId, demo, step, machine }: { accountId: string; demo: boolean; step: number; machine?: MachineTelemetry | null }) {
  const query = useQuery({ queryKey: [...agentKeys, 'machine-stream', accountId], queryFn: () => api.agentLogs(undefined, undefined, undefined, 5), refetchInterval: 5_000, enabled: !demo && !machine });
  return <section aria-label="Processing stream" className="machine-stream">
    <div className="machine-stream-header"><h3><Terminal size={15} aria-hidden="true" />Processing stream</h3><span>{demo ? 'DEMONSTRATION · SAMPLE DATA' : machine ? 'COMMITTED HANDOFFS & AGENT STEPS' : 'RECORDED EVENTS'}</span></div>
    {demo ? <div className="machine-demo-event" aria-live="polite"><span className="machine-event-prefix">SAMPLE / {String(step + 1).padStart(2, '0')}</span><span>{SAMPLE_FLOW[step].message}</span></div>
      : machine ? <>
        {!machine.activity.length && <p className="machine-stream-empty">No recorded activity in the last 24 hours. Queue counts and engine states above are current.</p>}
        <ol aria-label="Recent processing events">{machine.activity.slice(0, 8).map(entry => <li key={entry.id} data-machine-event={entry.id}>
          <time dateTime={entry.created_at} title={entry.created_at}>{clockTime(entry.created_at)}</time><span className="machine-event-age">{observedAge(entry.created_at, machine.observed_at)}</span><span className={`machine-event-level level-${entry.level.toLowerCase()}`}>{entry.level}</span>
          <span className="machine-event-agent">{entry.from_node ? `${labels[entry.from_node]} → ${labels[entry.to_node]}` : labels[entry.to_node]}</span>
          <span className="machine-event-message">{entry.title}{entry.reference && <strong> · {entry.reference}</strong>}{entry.company_name && <small> · {entry.company_name}</small>}</span>
        </li>)}</ol>
        {machine.activity.length > 8 && <p className="machine-stream-limit">Latest 8 events from the last 24 hours.{machine.activity_truncated && ' Activity is busy; this is a bounded recent view.'}</p>}
      </> : query.isPending ? <p role="status" className="machine-stream-empty">Loading recorded activity…</p>
      : query.isError ? <p role="alert" className="machine-stream-empty">{query.data ? 'Latest activity refresh failed. Showing saved events.' : 'Activity unavailable.'} <button type="button" onClick={() => query.refetch()}>Retry activity</button></p>
      : !query.data?.items.length ? <p className="machine-stream-empty">Waiting for live machine telemetry. No transfers are being simulated.</p> : null}
    {!demo && !machine && !!query.data?.items.length && <ol aria-label="Recent processing events">{query.data.items.map(entry => <li key={entry.id}>
      <time dateTime={entry.created_at}>{clockTime(entry.created_at)}</time><span className={`machine-event-level level-${entry.level.toLowerCase()}`}>{entry.level}</span>
      <span className="machine-event-agent">{AGENTS[entry.agent].name}</span><span className="machine-event-message">{entry.message}{entry.company_name && <small> · {entry.company_name}</small>}</span>
    </li>)}</ol>}
  </section>;
}
