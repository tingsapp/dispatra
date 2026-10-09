import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'getComputedStyle']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
}
let resize = () => {};
Object.assign(globalThis, {
  requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
  cancelAnimationFrame: clearTimeout,
  ResizeObserver: class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} },
  google: { maps: {
    LatLngBounds: class { points: { lat: number; lng: number }[] = []; extend(point: { lat: number; lng: number }) { this.points.push(point); } },
    event: { addListenerOnce: () => ({ remove() {} }) },
  } },
});
const { renderHook, cleanup, act, waitFor } = await import('@testing-library/react');
const { useShipperMapCamera } = await import('../src/components/orders/useShipperMapCamera');
afterEach(() => { cleanup(); document.body.innerHTML = ''; });
const home = { lat: 49.28, lng: -123.1 };
const points = [home, { lat: 49.3, lng: -123.05 }];
function fixture(width = 1180) {
  const main = document.createElement('main');
  const canvas = document.createElement('div');
  const marker = document.createElement('button'); canvas.append(marker); main.append(canvas); document.body.append(main);
  let currentWidth = width;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: currentWidth, bottom: 900, width: currentWidth, height: 900 } as DOMRect);
  const fits: { points: typeof points; padding: google.maps.Padding }[] = [];
  const listeners = new Map<string, () => void>();
  const map = { getDiv: () => canvas, setOptions() {},
    fitBounds: (bounds: { points: typeof points }, padding: google.maps.Padding) => fits.push({ points: bounds.points, padding }),
    addListener: (name: string, callback: () => void) => { listeners.set(name, callback); return { remove: () => listeners.delete(name) }; },
  } as unknown as google.maps.Map;
  return { map, canvas, marker, fits, listeners, setWidth: (value: number) => { currentWidth = value; } };
}
const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); };

test('marker pointer and keyboard interactions retain automatic fitting after resize', async () => {
  const f = fixture(); renderHook(() => useShipperMapCamera(f.map, points, home, true));
  await waitFor(() => assert.equal(f.fits.length, 1));
  for (const name of ['pointerdown', 'keydown']) f.marker.dispatchEvent(new dom.window.Event(name, { bubbles: true }));
  f.marker.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  f.setWidth(320); act(() => resize());
  await waitFor(() => assert.equal(f.fits.length, 2));
  assert.ok(f.fits[1].padding.left < f.fits[0].padding.left);
});

test('automatic framing follows changed route extents but ignores identical refreshes', async () => {
  const f = fixture();
  const hook = renderHook(({ locations }) => useShipperMapCamera(f.map, locations, home, true), { initialProps: { locations: points } });
  await waitFor(() => assert.equal(f.fits.length, 1));
  hook.rerender({ locations: points.map(point => ({ ...point })) }); await flush(); assert.equal(f.fits.length, 1);
  const distant = { lat: 50, lng: -122 };
  hook.rerender({ locations: [...points, distant] });
  await waitFor(() => assert.equal(f.fits.length, 2)); assert.deepEqual(f.fits[1].points.at(-1), distant);
});

test('actual dragging preserves the camera until explicitly fitting again', async () => {
  const f = fixture();
  const hook = renderHook(({ locations }) => useShipperMapCamera(f.map, locations, home, true), { initialProps: { locations: points } });
  await waitFor(() => assert.equal(f.fits.length, 1));
  act(() => f.listeners.get('dragstart')?.());
  hook.rerender({ locations: [...points, { lat: 50, lng: -122 }] });
  f.setWidth(390); act(() => resize()); await flush(); assert.equal(f.fits.length, 1);
  act(() => hook.result.current.fitOrders()); assert.equal(f.fits.length, 2);
  act(() => resize()); await waitFor(() => assert.equal(f.fits.length, 3));
});

test('a zero-size initial canvas can fit once it becomes visible', async () => {
  const f = fixture(0); renderHook(() => useShipperMapCamera(f.map, points, home, true));
  await flush(); assert.equal(f.fits.length, 0);
  f.setWidth(1180); act(() => resize()); await waitFor(() => assert.equal(f.fits.length, 1));
});

test('pending road/card data waits for readiness even during resizing', async () => {
  const f = fixture();
  const hook = renderHook(({ ready }) => useShipperMapCamera(f.map, points, home, ready), { initialProps: { ready: false } });
  act(() => resize()); await flush(); assert.equal(f.fits.length, 0);
  hook.rerender({ ready: true }); await waitFor(() => assert.equal(f.fits.length, 1));
  hook.rerender({ ready: false });
  f.setWidth(320); act(() => resize()); await flush(); assert.equal(f.fits.length, 1);
  hook.rerender({ ready: true }); await waitFor(() => assert.equal(f.fits.length, 2));
});

test('native wheel and keyboard zoom retain manual camera framing after resize', async () => {
  for (const event of [new dom.window.WheelEvent('wheel', { deltaY: 10, bubbles: true }),
    new dom.window.KeyboardEvent('keydown', { key: '+', bubbles: true })]) {
    const f = fixture(); renderHook(() => useShipperMapCamera(f.map, points, home, true));
    await waitFor(() => assert.equal(f.fits.length, 1));
    act(() => { f.canvas.dispatchEvent(event); f.setWidth(320); resize(); });
    await flush(); assert.equal(f.fits.length, 1);
    cleanup();
  }
});
