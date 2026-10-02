/** Canonical paths inside a dispatch company's workspace. */
export const PAGE_PATHS: Record<string, string> = {
  monitor: '/',
  jobs: '/orders',
  drivers: '/drivers',
  vehicles: '/vehicles',
  customers: '/shippers',
  reports: '/analytics',
  'rate-cards': '/settings',
  profile: '/profile',
  help: '/help',
};

const RESERVED = new Set(['admin', 'platform', 'prototype', 'api', 'assets', 'health', 'ready', 'login', 'customer', 'dispatch', 'www']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const trim = (path: string) => path.replace(/\/+$/, '') || '/';

export function companySlugForPath(pathname: string): string | undefined {
  const first = pathname.split('/')[1];
  return first && SLUG.test(first) && !RESERVED.has(first) ? first : undefined;
}

/** Legacy /prototype stays available while the live API workspace is built. */
export function pageForPath(pathname: string): string | undefined {
  const path = trim(pathname);
  const slug = companySlugForPath(path);
  const prefix = slug ? `/${slug}` : path === '/prototype' || path.startsWith('/prototype/') ? '/prototype' : undefined;
  if (!prefix) return undefined;
  const suffix = path.slice(prefix.length) || '/';
  if (suffix === '/settings/company') return 'profile';
  if (suffix === '/shipper') return 'customers';
  if (suffix === '/settings/pricing' || suffix === '/pricing') return 'rate-cards';
  return Object.keys(PAGE_PATHS).find(page => PAGE_PATHS[page] === suffix);
}

export function pathForPage(page: string, pathname: string): string | undefined {
  const path = PAGE_PATHS[page];
  if (path === undefined) return undefined;
  const slug = companySlugForPath(pathname);
  const prefix = slug ? `/${slug}` : pathname === '/prototype' || pathname.startsWith('/prototype/') ? '/prototype' : undefined;
  return prefix ? path === '/' && !slug ? prefix : `${prefix}${path}` : undefined;
}

export const companySlugForCurrentPath = () => companySlugForPath(typeof location === 'undefined' ? '' : location.pathname);
