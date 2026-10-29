import { useEffect, useState } from 'react';

const PUBLIC_PATHS = new Set(['/', '/plans', '/about', '/how-it-works', '/help', '/contact', '/ask-dispatra', '/terms', '/privacy', '/docs/integrations']);
const ENTRY_KEY = 'dispatraPublicEntry';
type Position = { left: number; top: number };
type PublicLocation = { pathname: string; search: string; hash: string; position?: Position; focus: boolean; visit: number };
const publicPath = (pathname: string) => pathname.replace(/\/+$/, '') || '/';
const readLocation = (): PublicLocation => {
  if (publicPath(window.location.pathname) === '/how-it-works') {
    history.replaceState(history.state, '', '/');
  }
  if (publicPath(window.location.pathname) === '/ask-dispatra') {
    history.replaceState(history.state, '', `/contact${window.location.search}${window.location.hash}`);
  }
  return { pathname: publicPath(window.location.pathname), search: window.location.search, hash: window.location.hash, focus: false, visit: 0 };
};

/** Keep real anchors; intercept only ordinary clicks between public website pages. */
export function usePublicNavigation() {
  const [route, setRoute] = useState(readLocation);
  const active = PUBLIC_PATHS.has(route.pathname);
  useEffect(() => {
    if (!active) return;
    const positions = new Map<string, Position>();
    let entry = crypto.randomUUID();
    let visit = 0;
    const originalRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    history.replaceState({ ...history.state, [ENTRY_KEY]: entry }, '');
    const savePosition = () => positions.set(entry, { left: window.scrollX, top: window.scrollY });
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof window.Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof window.HTMLAnchorElement) || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self') || anchor.rel.split(/\s+/).includes('external')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !PUBLIC_PATHS.has(publicPath(url.pathname))) return;
      event.preventDefault();
      if (url.href === window.location.href && !url.hash) return;
      savePosition();
      if (url.href !== window.location.href) {
        entry = crypto.randomUUID();
        history.pushState({ [ENTRY_KEY]: entry }, '', url);
      }
      setRoute({ ...readLocation(), focus: true, visit: ++visit });
    };
    const onPopState = () => {
      if (!PUBLIC_PATHS.has(publicPath(window.location.pathname))) return;
      savePosition();
      entry = history.state?.[ENTRY_KEY] ?? crypto.randomUUID();
      setRoute({ ...readLocation(), position: positions.get(entry), focus: true, visit: ++visit });
    };
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPopState);
      history.scrollRestoration = originalRestoration;
    };
  }, [active]);

  useEffect(() => {
    if (!active || (!route.focus && !route.hash)) return;
    // Lazy pages can commit after this effect. Wait for their heading/anchor.
    const observer = new window.MutationObserver(() => restore());
    function restore() {
      const heading = document.querySelector<HTMLElement>('main h1');
      let target: HTMLElement | null = null;
      try { target = route.hash ? document.getElementById(decodeURIComponent(route.hash.slice(1))) : null; } catch { /* An invalid fragment falls back to the page heading. */ }
      if (!heading) return;
      observer.disconnect();
      if (route.focus) {
        const focusTarget = target ?? heading;
        if (!focusTarget.hasAttribute('tabindex')) focusTarget.tabIndex = -1;
        focusTarget.focus({ preventScroll: true });
      }
      if (route.position) window.scrollTo({ ...route.position, behavior: 'instant' });
      else if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      else window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    }
    observer.observe(document.body, { childList: true, subtree: true });
    restore();
    return () => observer.disconnect();
  }, [active, route]);
  return route;
}
