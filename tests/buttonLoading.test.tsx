import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../src/components/ui/button';

test('pending actions expose busy state, retain their label and prevent duplicate clicks', () => {
  const html = renderToStaticMarkup(<Button loading>Save changes</Button>);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Save changes/);
  assert.doesNotMatch(html, /loading=/);
});
test('validation-disabled actions do not show submission state', () => {
  const html = renderToStaticMarkup(<Button disabled>Save changes</Button>);
  assert.doesNotMatch(html, /aria-busy/);
});
test('existing busy icon actions also prevent duplicate clicks', () => {
  const html = renderToStaticMarkup(<Button aria-busy size="icon" aria-label="Send message">↑</Button>);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-label="Send message"/);
});
