import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { APIProviderContext, APILoadingStatus, type APIProviderContextValue } from '@vis.gl/react-google-maps';
import { GoogleRoundedRoute } from '../src/components/map/GoogleRoundedRoute';
import { roundedRoutePath } from '../src/components/map/roundedRoutePath';
import { INITIAL_JOBS } from '../src/data/mockData';
import { GoogleOrderMarkers, type LocatedOrderStop } from '../src/components/monitor/GoogleOrderMarkers';
import { ShipperStopMarker } from '../src/components/orders/ShipperStopMarker';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
const { render, screen, cleanup, fireEvent } = await import('@testing-library/react');
const pane = document.createElement('div');
const overlays = new Set<FakeOverlay>();
let cameraOffset = 0;
class FakeLatLng {
  constructor(public position: google.maps.LatLngLiteral) {}
}
class FakeOverlay {
  onAdd() {}
  draw() {}
  onRemove() {}
  getPanes() { return { overlayMouseTarget: pane, overlayLayer: pane }; }
  getProjection() {
    return { fromLatLngToDivPixel: ({ position }: FakeLatLng) => ({ x: position.lng * 100 + cameraOffset, y: position.lat * 100 }) };
  }
  setMap(map: unknown) {
    if (map) { overlays.add(this); this.onAdd(); this.draw(); }
    else { this.onRemove(); overlays.delete(this); }
  }
}
Object.defineProperty(globalThis, 'google', { configurable: true, value: { maps: { OverlayView: FakeOverlay, LatLng: FakeLatLng } } });
const context: APIProviderContextValue = {
  status: APILoadingStatus.LOADED, loadedLibraries: {}, importLibrary: async () => { throw new Error('Unexpected library load in overlay test'); },
  mapInstances: { default: { getCenter: () => new FakeLatLng({ lat: 0, lng: 0 }), getDiv: () => pane } as unknown as google.maps.Map }, addMapInstance() {}, removeMapInstance() {}, clearMapInstances() {},
  map3dInstances: {}, addMap3DInstance() {}, removeMap3DInstance() {}, clearMap3DInstances() {}, internalUsageAttributionIds: null,
};
const stops: LocatedOrderStop[] = [
  { id: 'pickup-1', type: 'PICKUP', label: 'Pickup warehouse', lat: 49.2, lng: -123.1 },
  { id: 'drop-1', type: 'DROPOFF', label: 'First delivery', lat: 49.25, lng: -123.15 },
  { id: 'drop-2', type: 'DROPOFF', label: 'Final delivery', lat: 49.3, lng: -123.2 },
];
const job = { ...INITIAL_JOBS[0], lat: stops[2].lat, lng: stops[2].lng };
const tree = (props: React.ComponentProps<typeof GoogleOrderMarkers>) => React.createElement(APIProviderContext.Provider,
  { value: context }, React.createElement(GoogleOrderMarkers, props));
afterEach(() => { cleanup(); pane.remove(); cameraOffset = 0; assert.equal(overlays.size, 0); });

test('all stop circles select their order at the clicked location with mouse, Enter and Space', () => {
  document.body.appendChild(pane);
  const selections: [string, [number, number]][] = [];
  let mapClicks = 0;
  const backgroundClick = () => { mapClicks++; };
  pane.addEventListener('click', backgroundClick);
  try {
    render(tree({ job, stops, onSelect: (number, position) => selections.push([number, position]) }));
    const buttons = screen.getAllByRole('button');
    assert.equal(buttons.length, stops.length, 'The final stop replaces the overlapping order icon');
    stops.forEach((stop, index) => {
      const marker = buttons[index];
      assert.match(marker.getAttribute('aria-label')!, new RegExp(stop.label));
      assert.equal(marker.tabIndex, 0);
      assert.ok(marker.querySelector('svg > circle'));
      assert.match(marker.title, /Pickup|Drop-off/);
      fireEvent.click(marker);
      fireEvent.keyDown(marker, { key: 'Enter' });
      fireEvent.keyDown(marker, { key: ' ' });
      fireEvent.keyDown(marker, { key: 'Escape' });
      assert.deepEqual(selections.slice(index * 3), Array.from({ length: 3 }, () => [job.jobNumber, [stop.lng, stop.lat]]));
    });
    assert.equal(screen.getAllByText(`${job.jobNumber} • At Risk`).length, 1, 'The order status is retained once');
    assert.equal(mapClicks, 0, 'Stop clicks do not dismiss order details through the map background');
  } finally { pane.removeEventListener('click', backgroundClick); }
});

test('overlays follow map projection and updated stop coordinates, then detach on unmount', () => {
  document.body.appendChild(pane);
  const view = render(tree({ job, stops, onSelect() {} }));
  const pickup = screen.getByRole('button', { name: /Pickup warehouse/ });
  const positioned = pickup.parentElement!;
  assert.equal(positioned.style.left, `${stops[0].lng * 100}px`);
  assert.equal(positioned.style.top, `${stops[0].lat * 100}px`);
  cameraOffset = 200;
  overlays.forEach(overlay => overlay.draw());
  assert.equal(positioned.style.left, `${stops[0].lng * 100 + 200}px`);
  const updated = stops.map(stop => stop.type === 'PICKUP' ? { ...stop, lat: 49.4, lng: -123.4 } : stop);
  view.rerender(tree({ job, stops: updated, onSelect() {} }));
  assert.equal(screen.getByRole('button', { name: /Pickup warehouse/ }), pickup, 'Position updates retain the marker DOM');
  assert.equal(positioned.style.left, `${-123.4 * 100 + 200}px`);
  assert.equal(positioned.style.top, `${49.4 * 100}px`);
  view.unmount();
  assert.equal(pane.childElementCount, 0);
});

test('orders without located stops retain their selectable status marker', () => {
  document.body.appendChild(pane);
  let selected: unknown;
  render(tree({ job, stops: [], onSelect: (...args) => { selected = args; } }));
  fireEvent.click(screen.getByRole('button', { name: `Order ${job.jobNumber}, At Risk` }));
  assert.deepEqual(selected, [job.jobNumber, [job.lng, job.lat]]);
  assert.equal(screen.getAllByRole('button').length, 1);
});

test('shipper shows the active pickup description and opens delivery details on click or keyboard focus', () => {
  document.body.appendChild(pane);
  const selections: string[] = [];
  render(React.createElement(APIProviderContext.Provider, { value: context },
    React.createElement(ShipperStopMarker, { position: { lat: 49.2, lng: -123.1 }, kind: 'PICKUP', number: 'DDO-1041', address: 'Warehouse', contactName: 'Dock team', selected: true, onSelect: () => selections.push('pickup') }),
    React.createElement(ShipperStopMarker, { position: { lat: 49.3, lng: -123.2 }, kind: 'DROPOFF', ordinal: 2, number: 'DDO-1041', address: 'Second recipient', selected: true, onSelect: () => selections.push('delivery') }),
    React.createElement(ShipperStopMarker, { position: { lat: 49.4, lng: -123.3 }, kind: 'PICKUP', number: 'DDO-1042', address: 'Other warehouse', selected: false, onSelect: () => selections.push('other') })));
  const pickup = screen.getByRole('button', { name: 'DDO-1041 · Pickup: Warehouse' });
  const delivery = screen.getByRole('button', { name: 'DDO-1041 · Drop-off 2: Second recipient' });
  assert.equal(screen.getAllByRole('tooltip').length, 1);
  assert.ok(screen.getByText('Warehouse')); assert.ok(screen.getByText('Contact: Dock team'));
  assert.equal(screen.queryByText('Delivery 2'), null); assert.equal(screen.queryByText('Other warehouse'), null);
  assert.equal(pickup.getAttribute('aria-current'), 'true');
  assert.equal(pickup.parentElement!.style.left, `${-123.1 * 100}px`);
  assert.equal(pickup.parentElement!.style.top, `${49.2 * 100}px`);
  fireEvent.focus(delivery);
  assert.ok(screen.getByText('Second recipient')); assert.ok(screen.getByText('Delivery 2'));
  assert.equal(delivery.getAttribute('aria-expanded'), 'true');
  assert.equal(delivery.querySelector('[role="tooltip"]')!.id, delivery.getAttribute('aria-describedby'));
  fireEvent.keyDown(delivery, { key: 'Escape' });
  assert.equal(delivery.getAttribute('aria-expanded'), 'false');
  fireEvent.click(delivery);
  assert.equal(document.activeElement, delivery, 'A pointer click focuses the marker so blur can dismiss its description');
  assert.ok(screen.getByText('Second recipient'));
  fireEvent.blur(delivery);
  assert.equal(screen.queryByText('Second recipient'), null);
  fireEvent.keyDown(delivery, { key: 'Enter' }); fireEvent.keyDown(delivery, { key: ' ' });
  assert.deepEqual(selections, ['delivery', 'delivery', 'delivery']);
  assert.ok(screen.getByText('Warehouse'), 'The active pickup description stays visible');
});

test('rounded route keeps endpoints and confines curves to the immediate turn, including duplicate points', () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  assert.equal(roundedRoutePath(points), 'M0,0L90,0Q100,0 100,10L100,100');
  assert.equal(roundedRoutePath([{ x: 0, y: 0 }, { x: 0, y: 0 }]), '');
  assert.ok(!roundedRoutePath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]).includes('NaN'));
  assert.deepEqual(points.at(-1), { x: 100, y: 100 }, 'Rendering never mutates the road coordinates');
});
test('Google route overlay rounds caps and joins, stays projected during camera changes and detaches cleanly', () => {
  document.body.appendChild(pane);
  const props = { id: 'own-order', points: [[0, 0], [0, 1], [1, 1]], selected: true };
  const routeTree = (selected: boolean) => React.createElement(APIProviderContext.Provider, { value: context }, React.createElement(GoogleRoundedRoute, { ...props, selected }));
  const view = render(routeTree(true));
  const path = pane.querySelector('svg[data-shipper-route="own-order"] path')!;
  assert.equal(path.getAttribute('stroke-linecap'), 'round');
  assert.equal(path.getAttribute('stroke-linejoin'), 'round');
  assert.equal(path.getAttribute('stroke-width'), '4');
  assert.equal(path.getAttribute('d'), 'M0,0L90,0Q100,0 100,10L100,100');
  cameraOffset = 40;
  overlays.forEach(overlay => overlay.draw());
  assert.equal(path.getAttribute('d'), 'M40,0L130,0Q140,0 140,10L140,100');
  view.rerender(routeTree(false));
  assert.equal(path.getAttribute('stroke-width'), '4');
  view.unmount(); assert.equal(pane.childElementCount, 0);
});
