/** Bounded recovery for reviewed, side-effect-free reads. Never replay writes or provider calls. */
export type RecoveryKind = 'READ_RECOVERED' | 'READ_RECOVERY_FAILED';
export const RECOVERY_EVENT = 'dispatra:read-recovery';
const RETRYABLE = new Set([502, 503, 504]);

export function recoverableRead(request: Request, origin: string) {
  const url = new URL(request.url, origin);
  if (request.method !== 'GET' || url.origin !== origin) return false;
  return /^\/api\/v1\/platform\/(agents\/(monitor|logs|issues|operational\/issues)|notifications|organizations)$/.test(url.pathname)
    || /^\/api\/v1\/companies\/[^/]+\/(orders|routes|shippers|drivers|vehicles|catalog|rate-cards|settings|profile|activity|notifications|monitor)(\/[0-9a-f-]{36})?$/.test(url.pathname)
    || /^\/api\/v1\/companies\/[^/]+\/driver\/(orders|routes|profile|operational\/questions)$/.test(url.pathname);
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export function createReadRecovery({ send = (request: Request) => globalThis.fetch(request),
  origin = () => globalThis.location?.origin ?? 'http://localhost',
  online = () => globalThis.navigator?.onLine !== false,
  wait = pause,
  report = (kind: RecoveryKind) => globalThis.window?.dispatchEvent(new CustomEvent(RECOVERY_EVENT, { detail: kind })),
}: { send?: (request: Request) => Promise<Response>; origin?: () => string; online?: () => boolean;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>; report?: (kind: RecoveryKind) => void } = {}) {
  let retryBudget = 6, windowStarted = 0;
  return async (request: Request): Promise<Response> => {
    if (!recoverableRead(request, origin())) return send(request);
    let attempted = false;
    const notify = (kind: RecoveryKind) => { try { report(kind); } catch { /* Diagnostics must not break requests. */ } };
    for (let attempt = 0; ; attempt++) {
      if (request.signal.aborted) throw request.signal.reason;
      let response: Response | undefined, failure: unknown;
      try { response = await send(request.clone()); }
      catch (error) { failure = error; }
      if (request.signal.aborted) throw request.signal.reason;
      if (response && !RETRYABLE.has(response.status)) {
        if (attempted && response.ok) notify('READ_RECOVERED');
        else if (attempted && response.status >= 500) notify('READ_RECOVERY_FAILED');
        return response;
      }
      // Offline/abort/auth/validation failures aren't evidence of a broken server.
      if (!online()) { if (response) return response; throw failure; }
      const now = Date.now();
      if (now - windowStarted >= 60_000) { retryBudget = 6; windowStarted = now; }
      const retryAfter = response?.headers.get('Retry-After');
      const delay = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - now) : 0;
      if (attempt >= 2 || retryBudget <= 0 || delay > 5000) {
        notify('READ_RECOVERY_FAILED');
        if (response) return response;
        throw failure;
      }
      retryBudget--; attempted = true;
      // Release the failed response before retrying; don't retain bodies or customer data.
      await response?.body?.cancel().catch(() => undefined);
      await wait(Math.max(attempt === 0 ? 500 : 1500, Number.isFinite(delay) ? delay : 0), request.signal);
    }
  };
}
