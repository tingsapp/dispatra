import { api } from './api';
import { RECOVERY_EVENT, type RecoveryKind } from './readRecovery';

/** Only code locations and fixed error categories; never messages, stacks, URLs or page data. */
export function codeLocation(event: ErrorEvent, origin = globalThis.location?.origin) {
  const names = ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'URIError', 'EvalError'] as const;
  type ErrorName = typeof names[number];
  const result: { code_path?: string; code_line?: number; error_type?: ErrorName } = {};
  if (names.includes(event.error?.name)) result.error_type = event.error.name as ErrorName;
  try {
    const url = new URL(event.filename);
    const path = url.pathname.replace(/^\//, '');
    if (url.origin === origin && /^src\/[A-Za-z0-9_/-]+\.(tsx?|jsx?)$/.test(path) && path.length <= 240) {
      result.code_path = path;
      if (Number.isInteger(event.lineno) && event.lineno > 0 && event.lineno <= 100000) result.code_line = event.lineno;
    }
  } catch { /* Source location is optional; messages and raw URLs never leave the browser. */ }
  return result;
}

export function installRuntimeDiagnostics(target: EventTarget, report = api.reportRuntime) {
  const sent = new Map<string, number>();
  const record = (kind: 'RUNTIME_ERROR' | 'UNHANDLED_REJECTION' | RecoveryKind, location?: ReturnType<typeof codeLocation>) => {
    const time = Date.now();
    if (time - (sent.get(kind) ?? -Infinity) < 60_000) return;
    sent.set(kind, time);
    void report(kind, location).catch(() => undefined);
  };
  const error = (event: Event) => record('RUNTIME_ERROR', codeLocation(event as ErrorEvent));
  const rejection = () => record('UNHANDLED_REJECTION');
  const recovery = (event: Event) => {
    const kind: unknown = (event as CustomEvent).detail;
    if (kind === 'READ_RECOVERED' || kind === 'READ_RECOVERY_FAILED') record(kind);
  };
  target.addEventListener('error', error);
  target.addEventListener('unhandledrejection', rejection);
  target.addEventListener(RECOVERY_EVENT, recovery);
  return () => { target.removeEventListener('error', error); target.removeEventListener('unhandledrejection', rejection); target.removeEventListener(RECOVERY_EVENT, recovery); };
}
