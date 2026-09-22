export const MONITOR_INTRO_KEY = 'dispatra:monitor-intro:v1';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
let visited = false;

/** Read without consuming: React StrictMode may evaluate initial state twice. */
export function shouldPlayMonitorIntro(skip: boolean): boolean {
  if (skip || window.matchMedia?.(REDUCED_MOTION_QUERY).matches) return false;
  try { return window.sessionStorage.getItem(MONITOR_INTRO_KEY) !== 'seen'; }
  catch { return !visited; }
}

export function markMonitorVisited() {
  visited = true;
  try { window.sessionStorage.setItem(MONITOR_INTRO_KEY, 'seen'); }
  catch { /* The in-memory flag still prevents replay if browser storage is unavailable. */ }
}
