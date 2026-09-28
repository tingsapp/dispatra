import { companySlugForPath } from './pageRoutes';

/** Local demo records stay isolated until operational data moves to the API database. */
export function scopedStorageKey(key: string, pathname = typeof location === 'undefined' ? '' : location.pathname): string {
  const slug = companySlugForPath(pathname);
  return slug ? `${key}:company:${slug}` : key;
}
