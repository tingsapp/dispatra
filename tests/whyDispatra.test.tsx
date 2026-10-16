import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'Event']) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
}
// Canvas rendering is verified in the browser; these tests exercise lifecycle controls.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null });
let reduced = false;
const motionListeners = new Set<() => void>();
Object.defineProperty(window, 'matchMedia', { value: () => ({ get matches() { return reduced; }, addEventListener: (_: string, fn: () => void) => motionListeners.add(fn), removeEventListener: (_: string, fn: () => void) => motionListeners.delete(fn) }) });
let intersection: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
let disconnected = false;
Object.defineProperty(globalThis, 'IntersectionObserver', { value: class {
  constructor(callback: typeof intersection) { intersection = callback; disconnected = false; }
  observe() {} disconnect() { disconnected = true; }
} });
const { render, screen, cleanup, act, fireEvent } = await import('@testing-library/react');
const { WhyDispatra } = await import('../src/components/home/WhyDispatra');
afterEach(() => { cleanup(); reduced = false; Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });

function figure() { return screen.getByRole('figure', { name: 'Illustrative route constellation' }); }

test('the illustrative scene can be paused and resumed without hiding its benefits', () => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  render(<WhyDispatra />);
  assert.equal(figure().getAttribute('data-running'), 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Pause route constellation animation' }));
  assert.equal(figure().getAttribute('data-running'), 'false');
  assert.equal(screen.getAllByRole('heading', { level: 3 }).length, 4);
  fireEvent.click(screen.getByRole('button', { name: 'Play route constellation animation' }));
  assert.equal(figure().getAttribute('data-running'), 'true');
});

test('reduced motion produces a static scene and updates when the preference changes', () => {
  reduced = true;
  render(<WhyDispatra />);
  assert.equal(figure().getAttribute('data-running'), 'false');
  assert.equal(screen.queryByRole('button'), null);
  act(() => { reduced = false; motionListeners.forEach(fn => fn()); });
  assert.equal(figure().getAttribute('data-running'), 'true');
  cleanup();
  assert.equal(motionListeners.size, 0);
  assert.equal(disconnected, true);
});

test('offscreen and hidden pages suspend the animation while preserving a manual pause', () => {
  render(<WhyDispatra />);
  act(() => intersection?.([{ isIntersecting: false }]));
  assert.equal(figure().getAttribute('data-running'), 'false');
  act(() => intersection?.([{ isIntersecting: true }]));
  assert.equal(figure().getAttribute('data-running'), 'true');
  act(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(figure().getAttribute('data-running'), 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Pause route constellation animation' }));
  act(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(figure().getAttribute('data-running'), 'false');
});
