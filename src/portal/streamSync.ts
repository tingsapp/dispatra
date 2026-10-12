import type { components } from './schema';
import { ApiError } from './api';

type SyncView = components['schemas']['SyncView'];
type Options = {
  read: (cursor?: string) => Promise<SyncView>;
  apply: (view: SyncView) => Promise<void>;
  expired: () => void;
};
const backoff = (attempt: number) => Math.min(60_000, 5_000 * 2 ** Math.min(attempt - 1, 4));

export function socketUrl(slug: string, cursor?: string) {
  const url = new URL(`/api/v1/companies/${encodeURIComponent(slug)}/ws`, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  if (cursor) url.searchParams.set('cursor', cursor);
  return url.href;
}

/** Serialized snapshots, cursor replay, heartbeat watchdog, and HTTP fallback on transport failure. */
export function streamSync(slug: string, options: Options) {
  let cursor: string | undefined, socket: WebSocket | undefined;
  let pollTimer: ReturnType<typeof setTimeout>, retryTimer: ReturnType<typeof setTimeout>, watchdog: ReturnType<typeof setTimeout>;
  let stopped = false, ready = false, running = false, epoch = 0, failures = 0, retries = 0;
  let queue = Promise.resolve();
  const schedule = (delay: number) => { clearTimeout(pollTimer); if (!stopped && !ready) pollTimer = setTimeout(poll, delay); };
  const stopSocket = () => { clearTimeout(watchdog); if (socket) { socket.onclose = null; socket.onmessage = null; socket.onerror = null; socket.close(); socket = undefined; } ready = false; };
  const stop = () => { stopped = true; epoch++; clearTimeout(pollTimer); clearTimeout(retryTimer); stopSocket(); };
  const apply = async (view: SyncView, generation: number) => {
    if (stopped || generation !== epoch) return;
    await options.apply(view);
    if (!stopped && generation === epoch) cursor = view.cursor;
  };
  function lost() {
    stopSocket(); epoch++;
    schedule(0);
    clearTimeout(retryTimer);
    if (!stopped) retryTimer = setTimeout(connect, backoff(++retries));
  }
  function connect() {
    if (stopped || socket || typeof WebSocket === 'undefined') return;
    try { socket = new WebSocket(socketUrl(slug, cursor)); } catch { lost(); return; }
    const current = socket;
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(lost, 40_000); };
    arm();
    current.onmessage = event => {
      if (stopped || socket !== current) return;
      let view: SyncView;
      try {
        view = JSON.parse(String(event.data));
        if (typeof view.cursor !== 'string' || !Array.isArray(view.changes) || typeof view.unread !== 'number'
            || typeof view.unread_messages !== 'number' || typeof view.reset !== 'boolean' || typeof view.next_poll_ms !== 'number') throw new Error('Invalid sync frame');
      } catch { lost(); return; }
      if (!ready) { ready = true; epoch++; clearTimeout(pollTimer); }
      retries = 0; arm();
      const generation = epoch;
      queue = queue.then(() => apply(view, generation)).catch(() => { if (!stopped && socket === current) lost(); });
    };
    current.onclose = () => { if (socket === current) lost(); };
    current.onerror = () => { if (socket === current) lost(); };
  }
  async function poll() {
    if (stopped || ready) return;
    if (running) { schedule(100); return; }
    running = true;
    const generation = epoch;
    try {
      const view = await options.read(cursor);
      if (stopped || generation !== epoch || ready) return;
      // Share one processing queue with the socket to avoid advancing a cursor before refetch completes.
      queue = queue.then(() => apply(view, generation));
      await queue;
      failures = 0;
      schedule(view.next_poll_ms);
      if (!retryTimer) connect();
    } catch (error) {
      queue = Promise.resolve();
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) { stop(); options.expired(); return; }
      schedule(backoff(++failures));
    } finally { running = false; }
  }
  void poll();
  return {
    stop,
    recover: () => { if (stopped) return; stopSocket(); epoch++; clearTimeout(retryTimer); retryTimer = undefined!; schedule(0); },
  };
}
