/** After a release a tab opened earlier still asks for the previous build's page files. When one fails to load,
 * reload once to get the current build; a reload within the last minute does not repeat, so an offline tab cannot loop. */
export function installStaleReleaseReload(target: Window, storage: Pick<Storage, 'getItem' | 'setItem'> = target.sessionStorage) {
  const reload = (event: Event) => {
    const last = Number(storage.getItem('dispatra-stale-reload') ?? 0);
    if (Date.now() - last < 60_000) return;
    event.preventDefault();
    storage.setItem('dispatra-stale-reload', String(Date.now()));
    target.location.reload();
  };
  target.addEventListener('vite:preloadError', reload);
  return () => target.removeEventListener('vite:preloadError', reload);
}
