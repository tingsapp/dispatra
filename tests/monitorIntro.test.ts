import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { INTRO_TIMING, descentEasing } from '../src/components/monitor/introTiming';
import { INTRO_APPROACH_DURATION, INTRO_APPROACH_ZOOM, INTRO_START, introCameraAt } from '../src/components/monitor/introFlight';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'KeyboardEvent']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
}
Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (fn: FrameRequestCallback) => setTimeout(fn, 0) });
let reduced = false;
const preference = new dom.window.EventTarget();
Object.defineProperty(window, 'matchMedia', { value: () => ({
  get matches() { return reduced; },
  addEventListener: preference.addEventListener.bind(preference),
  removeEventListener: preference.removeEventListener.bind(preference),
}) });
const { render, cleanup, screen, fireEvent, act, waitFor } = await import('@testing-library/react');
const { useMonitorIntro } = await import('../src/components/monitor/useMonitorIntro');
const { shouldPlayMonitorIntro, markMonitorVisited, MONITOR_INTRO_KEY } = await import('../src/components/monitor/introSession');

function Stage({ skip = false }: { skip?: boolean }) {
  const { playing, finish, intro, content, arrival, brief, dismissBrief } = useMonitorIntro(skip);
  return React.createElement(React.Fragment, null,
    React.createElement('div', { ref: content, 'aria-label': 'Map', tabIndex: -1, inert: playing, 'data-arrival': arrival },
      React.createElement('input', { 'aria-label': 'Existing map state', defaultValue: 'Unchanged' })),
    brief && React.createElement('button', { onClick: dismissBrief }, 'Dismiss brief'),
    playing && React.createElement('div', { ref: intro }, React.createElement('button', { onClick: finish }, 'Skip intro')),
  );
}
afterEach(() => { cleanup(); reduced = false; window.sessionStorage.clear(); });

test('StrictMode plays once, Skip preserves mounted content, returns focus, and remounts do not replay', async () => {
  const view = render(React.createElement(React.StrictMode, null, React.createElement(Stage)));
  const input = screen.getByLabelText('Existing map state');
  assert.equal(screen.getByLabelText('Map').hasAttribute('inert'), true);
  const skip = screen.getByRole('button', { name: 'Skip intro' });
  skip.focus(); fireEvent.click(skip);
  assert.equal(screen.queryByRole('button', { name: 'Skip intro' }), null);
  assert.equal(screen.getByLabelText('Map').hasAttribute('inert'), false);
  assert.equal(screen.getByLabelText('Existing map state'), input);
  await waitFor(() => assert.equal(document.activeElement, screen.getByLabelText('Map')));
  assert.equal(window.sessionStorage.getItem(MONITOR_INTRO_KEY), 'seen');
  view.unmount(); render(React.createElement(Stage));
  assert.equal(screen.queryByRole('button', { name: 'Skip intro' }), null);
});

test('locate-on-map entry skips the intro and consumes the visit', () => {
  const view = render(React.createElement(Stage, { skip: true }));
  assert.equal(screen.queryByRole('button'), null);
  view.rerender(React.createElement(Stage, { skip: false }));
  assert.equal(screen.queryByRole('button'), null);
  assert.equal(shouldPlayMonitorIntro(false), false);
});

test('reduced motion bypasses the intro and changes during playback dismiss it', () => {
  reduced = true;
  const view = render(React.createElement(Stage));
  assert.equal(screen.queryByRole('button'), null);
  view.unmount(); window.sessionStorage.clear(); reduced = false;
  render(React.createElement(Stage));
  assert.ok(screen.getByRole('button', { name: 'Skip intro' }));
  act(() => { reduced = true; preference.dispatchEvent(new Event('change')); });
  assert.equal(screen.queryByRole('button', { name: 'Skip intro' }), null);
  assert.ok(screen.getByRole('button', { name: 'Dismiss brief' }), 'reduced motion skips the animation but still shows the brief');
});

test('Escape and a locate request arriving during playback release the map', () => {
  const view = render(React.createElement(Stage));
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal(screen.queryByRole('button'), null);
  view.unmount(); window.sessionStorage.clear();
  const next = render(React.createElement(Stage));
  next.rerender(React.createElement(Stage, { skip: true }));
  assert.equal(screen.queryByRole('button'), null);
});

test('bounded timeout dismisses an intro even when imagery and map readiness never arrive', () => {
  const original = window.setTimeout;
  let expire: (() => void) | undefined;
  window.setTimeout = ((callback: () => void, delay: number) => {
    if (delay === INTRO_TIMING.timeout) { expire = callback; return 0; }
    return original(callback, delay);
  }) as typeof window.setTimeout;
  try {
    render(React.createElement(Stage));
    assert.ok(expire);
    act(() => expire!());
    assert.equal(screen.queryByRole('button'), null);
    assert.equal(screen.getByLabelText('Map').hasAttribute('inert'), false);
  } finally { window.setTimeout = original; }
});

test('backgrounding the tab dismisses the intro', () => {
  render(React.createElement(Stage));
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  fireEvent(document, new Event('visibilitychange'));
  assert.equal(screen.queryByRole('button'), null);
  delete (document as { hidden?: boolean }).hidden;
});

test('blocked session storage does not throw or replay after the visit is recorded', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')!;
  Object.defineProperty(window, 'sessionStorage', { configurable: true, get: () => { throw new Error('Storage denied'); } });
  try {
    assert.doesNotThrow(() => shouldPlayMonitorIntro(false));
    markMonitorVisited();
    assert.equal(shouldPlayMonitorIntro(false), false);
  } finally { Object.defineProperty(window, 'sessionStorage', descriptor); }
});

test('descent slows after the Earth fills the frame and decelerates into a settled arrival', () => {
  const approachSpeed = (INTRO_APPROACH_ZOOM - INTRO_START.zoom) / INTRO_APPROACH_DURATION;
  let previousSpeed = approachSpeed;
  for (let step = 0; step < 10; step++) {
    const speed = (descentEasing((step + 1) / 10) - descentEasing(step / 10)) * (11 - 2) / (INTRO_TIMING.descent / 10);
    assert.ok(speed > 0 && speed < previousSpeed, 'Camera speed must decrease throughout the descent');
    previousSpeed = speed;
  }
  assert.equal(descentEasing(0), 0);
  assert.equal(descentEasing(1), 1);
  assert.ok(INTRO_TIMING.settle > 0);
  assert.ok(INTRO_TIMING.timeout > INTRO_TIMING.orbit + INTRO_TIMING.approach + INTRO_TIMING.descent + INTRO_TIMING.settle + INTRO_TIMING.reveal);
});

test('flight zooms immediately and rotates horizontally across the Pacific without tilting or tumbling', () => {
  const start = introCameraAt(0);
  assert.deepEqual(start.center, [134, 49.2827]);
  assert.ok(introCameraAt(16).zoom > start.zoom, 'The first frame must already zoom in');
  let last = start;
  for (let time = 16; time <= INTRO_APPROACH_DURATION; time += 16) {
    const next = introCameraAt(time);
    assert.ok(next.center[0] > last.center[0], 'Rotate east without jumping at the date line');
    assert.equal(next.center[1], start.center[1], 'Latitude must stay fixed so Earth does not rotate vertically');
    assert.equal(next.bearing, 0, 'Keep north upright throughout rotation');
    assert.equal(next.pitch, 0);
    assert.ok(next.zoom > last.zoom);
    last = next;
  }
  const arrival = introCameraAt(INTRO_APPROACH_DURATION);
  assert.ok(Math.abs(arrival.center[0] - 236.8793) < 0.00001);
  assert.ok(Math.abs(arrival.center[1] - 49.2827) < 0.00001);
  const end = introCameraAt(INTRO_APPROACH_DURATION + INTRO_TIMING.descent);
  assert.deepEqual(end.center, arrival.center);
  assert.equal(end.zoom, 11);
  assert.equal(end.bearing, 0);
  for (let time = INTRO_APPROACH_DURATION; time <= INTRO_APPROACH_DURATION + INTRO_TIMING.descent; time += 100) {
    const camera = introCameraAt(time);
    assert.deepEqual(camera.center, arrival.center, 'The descent must zoom without introducing another rotation');
    assert.equal(camera.bearing, 0);
    assert.equal(camera.pitch, 0);
  }
});

test('landing runs the layered arrival — stops, drivers, routes — then shows the brief; skipped intros do neither', async () => {
  const { ARRIVAL_TIMING } = await import('../src/components/monitor/arrival');
  const original = window.setTimeout; const originalClear = window.clearTimeout; const scheduled: { id: number; delay: number; callback: () => void; cleared: boolean }[] = [];
  window.setTimeout = ((callback: () => void, delay: number) => { const id = 1000 + scheduled.length; scheduled.push({ id, delay, callback, cleared: false }); return id; }) as typeof window.setTimeout;
  window.clearTimeout = ((id: number) => { const entry = scheduled.find(s => s.id === id); if (entry) entry.cleared = true; }) as typeof window.clearTimeout;
  try {
    render(React.createElement(Stage));
    const map = () => screen.getByLabelText('Map').getAttribute('data-arrival');
    assert.equal(map(), 'idle');
    fireEvent.click(screen.getByRole('button', { name: 'Skip intro' }));
    assert.equal(map(), 'stops');
    const fire = (delay: number) => act(() => scheduled.filter(s => s.delay === delay && !s.cleared).forEach(s => s.callback()));
    fire(ARRIVAL_TIMING.drivers); assert.equal(map(), 'drivers');
    fire(ARRIVAL_TIMING.routes); assert.equal(map(), 'routes');
    assert.equal(screen.queryByRole('button', { name: 'Dismiss brief' }), null);
    fire(ARRIVAL_TIMING.brief); assert.ok(screen.getByRole('button', { name: 'Dismiss brief' }));
    fire(ARRIVAL_TIMING.done); assert.equal(map(), 'done');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss brief' })); assert.equal(screen.queryByRole('button', { name: 'Dismiss brief' }), null);
    cleanup(); window.sessionStorage.clear();
    render(React.createElement(Stage, { skip: true }));
    assert.equal(map(), 'done'); assert.equal(screen.queryByRole('button', { name: 'Dismiss brief' }), null);
  } finally { window.setTimeout = original; window.clearTimeout = originalClear; }
});
