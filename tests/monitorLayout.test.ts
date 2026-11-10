import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { fitMonitorPoints, monitorFitPadding } from '../src/components/monitor/useMonitorMapCamera';

function fixture(width: number, floating = true) {
  const dom = new JSDOM(`<div class="${floating ? 'dispatcher-monitor' : ''}"><aside aria-label="Main navigation"></aside><main><div id="map"></div><section aria-label="Today’s plan"></section></main></div>`);
  const canvas = dom.window.document.getElementById('map')!;
  canvas.getBoundingClientRect = () => ({ left: 0, width } as DOMRect);
  const plan = dom.window.document.querySelector('section')!;
  plan.getBoundingClientRect = () => ({ right: 616 } as DOMRect);
  const sidebar = dom.window.document.querySelector('aside')!;
  sidebar.getBoundingClientRect = () => ({ right: 216 } as DOMRect);
  return { canvas, plan };
}

test('full-bleed map frames orders beyond floating panels without consuming narrow screens', () => {
  assert.equal(monitorFitPadding(fixture(1440).canvas).left, 640);
  assert.equal(monitorFitPadding(fixture(768).canvas).left, 422);
  assert.deepEqual(monitorFitPadding(fixture(390).canvas), { top: 120, right: 80, bottom: 90, left: 40 });
  assert.deepEqual(monitorFitPadding(fixture(1440, false).canvas), { top: 120, right: 80, bottom: 90, left: 40 });
});

test('map fitting reads current panel position after navigation collapses', () => {
  const { canvas, plan } = fixture(1440);
  plan.getBoundingClientRect = () => ({ right: 476 } as DOMRect);
  assert.equal(monitorFitPadding(canvas).left, 500);
});

test('a single dispatcher order uses padded fitting and retains the street zoom limit', () => {
  const { canvas } = fixture(1440);
  let padding: google.maps.Padding | undefined;
  let zoom = 21;
  let idle: (() => void) | undefined;
  Object.assign(globalThis, { google: { maps: {
    LatLngBounds: class { extend() {} },
    event: { addListenerOnce: (_map: unknown, _event: string, callback: () => void) => { idle = callback; return { remove() {} }; } },
  } } });
  const map = { getDiv: () => canvas, fitBounds: (_bounds: unknown, value: google.maps.Padding) => { padding = value; },
    getZoom: () => zoom, setZoom: (value: number) => { zoom = value; }, panTo: () => assert.fail('Centering would hide the selected order beneath the panels'),
  } as unknown as google.maps.Map;
  fitMonitorPoints(map, [[-123.1, 49.28]]);
  assert.equal(padding?.left, 640);
  idle?.();
  assert.equal(zoom, 15);
});
