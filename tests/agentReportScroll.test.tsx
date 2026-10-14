import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/admin/monitor', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver', 'getComputedStyle']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name as keyof Window] });
const { render, screen, cleanup, fireEvent, act } = await import('@testing-library/react');
const { AutoScrollingIssueList } = await import('../src/portal/admin/AutoScrollingIssueList');
let sequence = 0;
const frames = new Map<number, FrameRequestCallback>();
const motionListeners = new Set<() => void>();
let reduced = false;
let hidden = false;
let height = 1000;
Object.defineProperty(window.performance, 'now', { configurable: true, value: () => 0 });
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.classList.contains('agent-report-viewport') ? 200 : 0; } });
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return this.classList.contains('agent-report-viewport') ? height : 0; } });
window.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
window.cancelAnimationFrame = identity => { frames.delete(identity); };
window.matchMedia = (() => ({ get matches() { return reduced; }, addEventListener: (_name: string, callback: () => void) => motionListeners.add(callback), removeEventListener: (_name: string, callback: () => void) => motionListeners.delete(callback) })) as never;
function draw(time: number) {
  act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); });
}
function mount(holding = false, key = 'first') {
  return render(<AutoScrollingIssueList controls={<button>History</button>} enabled holding={holding} contentKey="one|two" resetKey={key}>
    <button>Read first issue</button><button>Read second issue</button>
  </AutoScrollingIssueList>);
}
beforeEach(() => { frames.clear(); reduced = false; hidden = false; height = 1000; });
afterEach(() => { cleanup(); assert.equal(frames.size, 0); assert.equal(motionListeners.size, 0); });
after(() => dom.window.close());

test('real overflowing entries scroll upward and pause on hover/focus/manual input', () => {
  mount(); const viewport = screen.getByRole('region', { name: 'Report entries' });
  draw(1000); draw(1250); draw(1350);
  assert.ok(viewport.scrollTop > 0);
  assert.equal(screen.getAllByRole('button', { name: /Read .* issue/ }).length, 2);
  fireEvent.pointerEnter(viewport); const hovered = viewport.scrollTop; draw(1450);
  assert.equal(viewport.scrollTop, hovered);
  fireEvent.pointerLeave(viewport); draw(1500); draw(1600);
  assert.ok(viewport.scrollTop > hovered);
  fireEvent.focusIn(screen.getByRole('button', { name: 'Read first issue' })); const focused = viewport.scrollTop;
  draw(1700); assert.equal(viewport.scrollTop, focused);
  fireEvent.focusOut(screen.getByRole('button', { name: 'Read first issue' }), { relatedTarget: document.body });
  draw(1800); draw(1900); assert.ok(viewport.scrollTop > focused);
  fireEvent.wheel(viewport); const manual = viewport.scrollTop;
  draw(2000); assert.equal(viewport.scrollTop, manual);
  assert.equal(screen.getByRole('button', { name: 'Resume scrolling' }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Resume scrolling' }));
  draw(2100); draw(2200); assert.ok(viewport.scrollTop > manual);
});

test('pause control and open details hold the reader position and resume safely', () => {
  const view = mount(); const viewport = screen.getByRole('region', { name: 'Report entries' });
  fireEvent.click(screen.getByRole('button', { name: 'Pause scrolling' })); draw(1300); draw(1400);
  assert.equal(viewport.scrollTop, 0);
  fireEvent.click(screen.getByRole('button', { name: 'Resume scrolling' })); draw(1500); draw(1600);
  assert.ok(viewport.scrollTop > 0);
  const position = viewport.scrollTop;
  view.rerender(<AutoScrollingIssueList controls={null} enabled holding contentKey="one|two" resetKey="first"><button>Expanded issue</button></AutoScrollingIssueList>);
  draw(1700); assert.equal(viewport.scrollTop, position);
  view.rerender(<AutoScrollingIssueList controls={null} enabled holding={false} contentKey="one|two" resetKey="first"><button>Expanded issue</button></AutoScrollingIssueList>);
  draw(1800); draw(1900); assert.ok(viewport.scrollTop > position);
});

test('reduced motion, hidden tabs and non-overflowing lists remain static', () => {
  reduced = true; mount(); const viewport = screen.getByRole('region', { name: 'Report entries' });
  assert.equal(screen.queryByRole('button', { name: 'Pause scrolling' }), null);
  draw(1500); assert.equal(viewport.scrollTop, 0);
  act(() => { reduced = false; motionListeners.forEach(listener => listener()); });
  draw(1600); draw(1700); assert.ok(viewport.scrollTop > 0);
  act(() => { hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  const position = viewport.scrollTop; draw(1800); assert.equal(viewport.scrollTop, position);
  act(() => { hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  draw(1900); draw(2000); assert.ok(viewport.scrollTop > position);
  cleanup(); height = 100; mount(); draw(2100);
  assert.equal(screen.queryByRole('button', { name: 'Pause scrolling' }), null);
  assert.equal(screen.getByRole('region', { name: 'Report entries' }).scrollTop, 0);
});

test('bottom reading pause and loop retain only the original entries; history resets position', () => {
  height = 202; const view = mount(); const viewport = screen.getByRole('region', { name: 'Report entries' });
  draw(1200); draw(1300); draw(1400); draw(1500);
  assert.equal(viewport.scrollTop, 2);
  draw(2000); assert.equal(viewport.scrollTop, 2);
  draw(4000); assert.equal(viewport.scrollTop, 0);
  assert.equal(screen.getAllByRole('button', { name: /Read .* issue/ }).length, 2);
  draw(6000); draw(6100); assert.ok(viewport.scrollTop > 0);
  view.rerender(<AutoScrollingIssueList controls={null} enabled={false} holding={false} contentKey="older" resetKey="history"><button>Earlier report</button></AutoScrollingIssueList>);
  assert.equal(viewport.scrollTop, 0); draw(7000); assert.equal(viewport.scrollTop, 0);
});
