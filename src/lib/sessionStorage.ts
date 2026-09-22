// Local dispatcher session for the prototype. The portal uses the API's cookie session instead;
// this store only decides whether the local dispatch pages render or the login page does.
import { loadUserProfile } from './profileStorage';

export const SESSION_STORAGE_KEY = 'dispatra_session_v1';
export interface DispatcherSession { email: string; name: string; signedInAt: string }

const emailOK = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function loadSession(): DispatcherSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.email === 'string' && typeof parsed.name === 'string' ? parsed : null;
  } catch { return null; }
}

/** The prototype's single dispatcher login. Real credentials live in the API once dispatch pages use it. */
export const DISPATCHER_CREDENTIALS = { email: 'dispatcher@dispatra.com', password: '123456' } as const;

export function signIn(email: string, password: string, now = new Date()): DispatcherSession {
  const address = email.trim().toLowerCase();
  if (!emailOK(address)) throw new Error('Enter a valid email address.');
  if (!password) throw new Error('Enter your password.');
  if (address !== DISPATCHER_CREDENTIALS.email || password !== DISPATCHER_CREDENTIALS.password) throw new Error('Incorrect email or password.');
  const profile = loadUserProfile();
  const session: DispatcherSession = { email: DISPATCHER_CREDENTIALS.email, name: profile.name, signedInAt: now.toISOString() };
  try { localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session)); } catch { /* Session stays in memory when storage is unavailable. */ }
  return session;
}

export function signOut(): void {
  try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* nothing to clear */ }
}
