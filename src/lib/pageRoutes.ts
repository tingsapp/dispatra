/** Explicit operational routes keep tenant/customer URLs out of the local prototype. */
export const PAGE_PATHS: Record<string, string> = {
  monitor: '/',
  jobs: '/orders',
  drivers: '/drivers',
  vehicles: '/vehicles',
  customers: '/shippers',
  reports: '/analytics',
  'rate-cards': '/settings/pricing',
  profile: '/profile',
  help: '/help',
};

export function pageForPath(pathname: string): string | undefined {
  const path = pathname.replace(/^\/prototype(?=\/|$)/, '').replace(/\/+$/, '') || '/';
  if (path === '/settings/company') return 'profile';
  return Object.keys(PAGE_PATHS).find(page => PAGE_PATHS[page] === path);
}

export function pathForPage(page: string, pathname: string): string | undefined {
  const path = PAGE_PATHS[page];
  if (path === undefined) return undefined;
  return /^\/prototype(?:\/|$)/.test(pathname) ? `/prototype${path === '/' ? '' : path}` : path;
}
