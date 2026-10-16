import type { Account } from '../portal/api';
import { companySlugForPath, roleHome } from './pageRoutes';

export const TMS_INTEGRATION_LABEL = 'Use Dispatra TMS';
export const COMPANY_PLANS = [
  { externalTms: false, label: 'TMS + Smart Dispatching', description: 'Full Dispatra TMS and smart dispatching.' },
  { externalTms: true, label: 'Smart Dispatching only', description: 'Connect smart dispatching to your existing TMS.' },
] as const;
export const companyPlanLabel = (externalTms?: boolean) => COMPANY_PLANS[externalTms === true ? 1 : 0].label;

export type WorkspaceRole = 'dispatcher' | 'shipper' | 'driver';
export const workspacePortals = { dispatcher: 'dispatch', shipper: 'customer', driver: 'driver' } as const;

export function workspaceSlug(input: string): string | undefined {
  const value = input.trim().toLowerCase();
  let path = value;
  if (/^https?:\/\//.test(value)) {
    try { path = new URL(value).pathname; } catch { return undefined; }
  } else if (!value.startsWith('/')) {
    return companySlugForPath(`/${value}/`) === value ? value : undefined;
  }
  return companySlugForPath(path);
}
export function accountWorkspace(account?: Account): string | undefined {
  if (!account) return undefined;
  if (account.role === 'ADMIN' && !account.organization) return '/admin';
  if (!['DISPATCHER', 'SHIPPER', 'DRIVER'].includes(account.role)) return undefined;
  const slug = workspaceSlug(account.organization?.slug ?? '');
  if (slug && account.role === 'DISPATCHER' && account.organization?.payment_required) return `/${slug}/profile`;
  if (slug && account.role === 'DISPATCHER' && account.tms_workspace) return `/${slug}/integrations`;
  return slug ? roleHome(slug, account.role) : undefined;
}

/** Only a company identifier is accepted; URLs cannot become signup destinations. */
export function signupDestination(input: string): string | undefined {
  const slug = input.trim().toLowerCase();
  return slug.length >= 2 && slug.length <= 63 && workspaceSlug(slug) === slug
    ? `/plans?company=${encodeURIComponent(slug)}` : undefined;
}

/** Monitor is shared by both dispatcher modes; External TMS keeps its other page restrictions. */
export function dispatcherPageAvailable(page: string | undefined, externalTms: boolean): boolean {
  return !externalTms || ['monitor', 'profile', 'help', 'integrations', 'subscription'].includes(page ?? '');
}
