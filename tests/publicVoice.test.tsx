import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/contact', pretendToBeVisual: true });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node']) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: dom.window[name as keyof Window] });
const { cleanup, render, screen } = await import('@testing-library/react');
const { PublicChatAssistant } = await import('../src/components/home/PublicChatAssistant');

afterEach(cleanup);

test('the retained wave button is a disabled coming-soon control', () => {
  render(<PublicChatAssistant />);
  const button = screen.getByRole('button', { name: 'Voice chat coming soon' });
  assert.equal(button.hasAttribute('disabled'), true);
});
