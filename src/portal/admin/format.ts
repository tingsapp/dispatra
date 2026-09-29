import { ApiError } from '../api';

const DATE = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
export const formatWhen = (value?: string | null, empty = 'Never') => value ? DATE.format(new Date(value)) : empty;

const AUDIT_LABELS: Record<string, string> = {
  'organization.created': 'Company created',
  'organization.updated': 'Company details edited',
  'organization.suspended': 'Company suspended',
  'organization.activated': 'Company activated',
  'dispatcher.created': 'Dispatcher account created',
  'dispatcher.updated': 'Dispatcher account edited',
  'dispatcher.activated': 'Dispatcher account activated',
  'dispatcher.deactivated': 'Dispatcher account deactivated',
  'dispatcher.password_reset': 'Dispatcher password reset',
  'dispatcher.sessions_revoked': 'Dispatcher sessions signed out',
};
export const auditLabel = (action: string) => AUDIT_LABELS[action] ?? action;

/** A 409 means another administrator (or tab) changed the record; the page offers a reload. */
export const isConflict = (error: unknown) => error instanceof ApiError && error.status === 409 && /changed|reload/i.test(error.message);
