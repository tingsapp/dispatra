import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installStaleReleaseReload } from '../src/lib/staleRelease';

test('a missing page file from an earlier build reloads the tab once, not in a loop', () => {
  const events = new EventTarget();
  let reloads = 0;
  const store = new Map<string, string>();
  const target = Object.assign(events, { location: { reload: () => { reloads++; } } }) as unknown as Window;
  installStaleReleaseReload(target, { getItem: key => store.get(key) ?? null, setItem: (key, value) => { store.set(key, value); } });
  const failed = () => { const event = new Event('vite:preloadError', { cancelable: true }); events.dispatchEvent(event); return event.defaultPrevented; };
  assert.equal(failed(), true);
  assert.equal(reloads, 1);
  assert.equal(failed(), false, 'a second failure within a minute shows the error instead of reloading again');
  assert.equal(reloads, 1);
});
