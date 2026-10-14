/** Platform administration URLs. `/platform` remains a compatibility entry for the Companies list. */
export type AdminRoute = { page: 'companies' } | { page: 'company'; id: string; tab?: 'subscription' } | { page: 'profile' } | { page: 'monitor' } | { page: 'billing' } | { page: 'revenue' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAdminPath(path: string) {
  return /^\/(?:admin|platform)(?:\/.*)?$/.test(path);
}

export function adminRoute(path: string): AdminRoute | null {
  const parts = path.replace(/\/+$/, '').split('/').slice(1);
  if (!isAdminPath(path)) return null;
  const [, section, id, ...rest] = parts;
  if (section === 'companies' && id && UUID.test(id) && rest.length === 1 && rest[0] === 'subscription') return { page: 'company', id: id.toLowerCase(), tab: 'subscription' };
  if (rest.length) return null;
  if (!section || section === 'login' || (section === 'companies' && !id)) return { page: 'companies' };
  if (section === 'companies' && id && UUID.test(id)) return { page: 'company', id: id.toLowerCase() };
  if (section === 'profile' && !id) return { page: 'profile' };
  if (section === 'monitor' && !id) return { page: 'monitor' };
  if (section === 'billing' && !id) return { page: 'billing' };
  if (section === 'revenue' && !id) return { page: 'revenue' };
  return null;
}

export const adminHref = (route: AdminRoute) => route.page === 'company' ? `/admin/companies/${route.id}${route.tab ? '/subscription' : ''}` : route.page === 'companies' ? '/admin/companies' : `/admin/${route.page}`;
