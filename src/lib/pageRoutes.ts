/** Canonical paths inside a dispatch company's workspace. */
export const PAGE_PATHS: Record<string, string> = {
  monitor: '/',
  jobs: '/orders',
  drivers: '/drivers',
  vehicles: '/vehicles',
  customers: '/shippers',
  reports: '/analytics',
  'rate-cards': '/settings',
  integrations: '/integrations',
  profile: '/profile',
  help: '/help',
};

/** First path segments that can never be a company slug (keep in sync with the API's reserved slugs). */
export const RESERVED_SLUGS = ['admin', 'platform', 'prototype', 'api', 'assets', 'static', 'app', 'health', 'ready', 'login', 'signup', 'customer', 'dispatch',
  'shipper', 'driver', 'www', 'pricing', 'about', 'contact', 'blog', 'help', 'docs', 'terms', 'privacy', 'support'];
const RESERVED = new Set(RESERVED_SLUGS);
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

/** One destination mapping shared by sign-in and the public workspace entry. */
export const roleHome = (slug: string, role: string) => role === 'SHIPPER' ? `/${slug}/shipper` : role === 'DRIVER' ? `/${slug}/driver` : `/${slug}/`;
