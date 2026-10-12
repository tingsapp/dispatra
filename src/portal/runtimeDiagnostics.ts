import { api } from './api';

/** Report only error categories. Runtime messages, stack traces and page data stay on the device. */
export function installRuntimeDiagnostics(target: EventTarget, report = api.reportRuntime) {
  const sent = new Map<string, number>();
  const record = (kind: 'RUNTIME_ERROR' | 'UNHANDLED_REJECTION') => {
    const time = Date.now();
    if (time - (sent.get(kind) ?? -Infinity) < 60_000) return;
    sent.set(kind, time);
    void report(kind).catch(() => undefined);
  };
  const error = () => record('RUNTIME_ERROR');
  const rejection = () => record('UNHANDLED_REJECTION');
  target.addEventListener('error', error);
  target.addEventListener('unhandledrejection', rejection);
  return () => { target.removeEventListener('error', error); target.removeEventListener('unhandledrejection', rejection); };
}
