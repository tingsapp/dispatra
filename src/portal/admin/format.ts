import { dateTime } from '../../lib/dateTimeFormat';
import { ApiError } from '../api';

export const formatWhen = (value?: string | null, empty = 'Never') => dateTime(value) || empty;

const AUDIT_LABELS: Record<string, string> = {
  'organization.created': 'Company created',
  'organization.updated': 'Company details edited',
  'organization.suspended': 'Company suspended',
  'organization.activated': 'Company activated',
  'subscription.company_payment_saved': 'Company payment method saved',
  'subscription.company_payment_removed': 'Company payment method removed',
  'subscription.company_card_consent': 'Company card setup authorized',
  'subscription.company_updated': 'Company subscription updated',
  'dispatcher.created': 'Dispatcher account created',
  'dispatcher.updated': 'Dispatcher account edited',
  'dispatcher.activated': 'Dispatcher account activated',
  'dispatcher.deactivated': 'Dispatcher account deactivated',
  'dispatcher.password_reset': 'Dispatcher password reset',
  'dispatcher.password_changed': 'Dispatcher password changed',
  'dispatcher.sessions_revoked': 'Dispatcher sessions signed out',
  'connector.admin_pause': 'TMS connection paused',
  'connector.admin_resume': 'TMS connection resumed',
  'connector.admin_retry': 'TMS synchronization retry queued',
  'connector.setup_requested': 'TMS setup requested',
  'connector.setup_in_progress': 'TMS setup started',
  'connector.setup_completed': 'TMS setup completed',
  'connector.setup_cancelled': 'TMS setup cancelled',
  'connector.provider_enabled': 'TMS provider enabled',
  'connector.provider_paused': 'TMS provider paused',
};
export const auditLabel = (action: string) => AUDIT_LABELS[action] ?? action;

/** A 409 means another administrator (or tab) changed the record; the page offers a reload. */
export const isConflict = (error: unknown) => error instanceof ApiError && error.status === 409 && /changed|reload/i.test(error.message);
