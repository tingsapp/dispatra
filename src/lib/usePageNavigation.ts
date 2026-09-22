import { useCallback, useEffect, useRef, useState } from 'react';
import { SETTINGS_NAVIGATION_EVENT } from '../components/settings/useSettingsGuard';
import { pageForPath, pathForPage } from './pageRoutes';

const HISTORY_INDEX = 'dispatraPageIndex';
const requestNavigation = (proceed: () => void) => window.dispatchEvent(
  new CustomEvent(SETTINGS_NAVIGATION_EVENT, { cancelable: true, detail: { proceed } }),
);

export function usePageNavigation() {
  const [activeTab, updateActiveTab] = useState(() => pageForPath(window.location.pathname) ?? 'monitor');
  const current = useRef({ page: activeTab, index: window.history.state?.[HISTORY_INDEX] ?? 0 });

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, [HISTORY_INDEX]: current.current.index }, '');
    let afterRestore: (() => void) | undefined;
    let approvedIndex: number | undefined;
    const onPopState = (event: PopStateEvent) => {
      if (afterRestore) {
        const restored = afterRestore;
        afterRestore = undefined;
        restored();
        return;
      }
      const nextPage = pageForPath(window.location.pathname);
      const nextIndex: number | undefined = event.state?.[HISTORY_INDEX];
      // Entries outside this mounted operational workspace use normal document routing.
      if (nextPage === undefined || nextIndex === undefined) {
        window.location.reload();
        return;
      }
      const commit = () => {
        current.current = { page: nextPage, index: nextIndex };
        updateActiveTab(nextPage);
      };
      if (approvedIndex === nextIndex || nextPage === current.current.page) {
        approvedIndex = undefined;
        commit();
        return;
      }
      const delta = nextIndex - current.current.index;
      let restored = false;
      let approved = false;
      const retry = () => { approvedIndex = nextIndex; window.history.go(delta); };
      if (requestNavigation(() => { approved = true; if (restored) retry(); })) {
        commit();
      } else {
        // Restore the original URL/history entry while the existing discard dialog is open.
        afterRestore = () => { restored = true; if (approved) retry(); };
        window.history.go(-delta);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setActiveTab = useCallback((next: string) => {
    const path = pathForPage(next, window.location.pathname);
    const page = path === undefined ? undefined : pageForPath(path);
    if (path === undefined || page === undefined || page === current.current.page) return;
    const go = () => {
      // Repeated clicks can share an asynchronous confirmation.
      if (page === current.current.page) return;
      const index = current.current.index + 1;
      window.history.pushState({ [HISTORY_INDEX]: index }, '', path);
      current.current = { page, index };
      updateActiveTab(page);
    };
    if (requestNavigation(go)) go();
  }, []);

  return [activeTab, setActiveTab] as const;
}
