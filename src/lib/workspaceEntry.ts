import type { Account } from '../portal/api';
import { companySlugForPath, roleHome } from './pageRoutes';

export type WorkspaceRole = 'dispatcher' | 'shipper' | 'driver';
const roles = { dispatcher: 'DISPATCHER', shipper: 'SHIPPER', driver: 'DRIVER' } as const;
export const WORKSPACE_ENTRY_KEY = 'dispatra_public_workspace_v1';

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
export function workspaceDestination(input: string, role: WorkspaceRole): string | undefined {
  const slug = workspaceSlug(input);
  return slug ? roleHome(slug, roles[role]) : undefined;
}
export function readWorkspaceEntry(): { slug: string; role: WorkspaceRole } {
  const fallback = { slug: '', role: 'dispatcher' as const };
  try {
    const stored = JSON.parse(localStorage.getItem(WORKSPACE_ENTRY_KEY) ?? 'null');
    return stored && typeof stored.slug === 'string' && workspaceSlug(stored.slug) === stored.slug
      && Object.hasOwn(roles, stored.role) ? { slug: stored.slug, role: stored.role } : fallback;
  } catch { return fallback; }
}
export function rememberWorkspaceEntry(slug: string, role: WorkspaceRole) {
  try { localStorage.setItem(WORKSPACE_ENTRY_KEY, JSON.stringify({ slug, role })); } catch { /* Entry works without browser storage. */ }
}
export function accountWorkspace(account?: Account): string | undefined {
  if (!account) return undefined;
  if (account.role === 'ADMIN' && !account.organization) return '/admin';
  if (!['DISPATCHER', 'SHIPPER', 'DRIVER'].includes(account.role)) return undefined;
  const slug = workspaceSlug(account.organization?.slug ?? '');
  return slug ? roleHome(slug, account.role) : undefined;
}
