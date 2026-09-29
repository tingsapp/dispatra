/** Platform administration URLs. `/platform` remains a compatibility entry for the Companies list. */
export type AdminRoute = { page: 'companies' } | { page: 'company'; id: string } | { page: 'profile' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAdminPath(path: string) {
  return /^\/(?:admin|platform)(?:\/.*)?$/.test(path);
}

export function adminRoute(path: string): AdminRoute | null {
  const parts = path.replace(/\/+$/, '').split('/').slice(1);
  if (!isAdminPath(path)) return null;
  const [, section, id, ...rest] = parts;
  if (rest.length) return null;
  if (!section || section === 'login' || (section === 'companies' && !id)) return { page: 'companies' };
  if (section === 'companies' && id && UUID.test(id)) return { page: 'company', id: id.toLowerCase() };
  if (section === 'profile' && !id) return { page: 'profile' };
  return null;
}

export const adminHref = (route: AdminRoute) => route.page === 'company' ? `/admin/companies/${route.id}` : route.page === 'profile' ? '/admin/profile' : '/admin/companies';
