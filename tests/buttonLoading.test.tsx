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
  assert.match(html, /data-button-spinner=""/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /loading=/);
});
test('validation-disabled actions do not show submission state', () => {
  const html = renderToStaticMarkup(<Button disabled>Save changes</Button>);
  assert.doesNotMatch(html, /aria-busy/);
  assert.doesNotMatch(html, /data-button-spinner/);
});
test('existing busy icon actions also prevent duplicate clicks', () => {
  const html = renderToStaticMarkup(<Button aria-busy size="icon" aria-label="Send message">↑</Button>);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-label="Send message"/);
  assert.match(html, /data-button-spinner=""/);
});

test('string busy state has the same spinner and duplicate-click protection', () => {
  const html = renderToStaticMarkup(<Button aria-busy="true">Submit</Button>);
  assert.match(html, /disabled=""/);
  assert.match(html, /data-button-spinner=""/);
});

test('slotted buttons retain a single child and put the spinner inside it', () => {
  const html = renderToStaticMarkup(<Button asChild loading><a href="/download">Download</a></Button>);
  assert.match(html, /^<a[^>]+href="\/download"/);
  assert.match(html, /<svg[^>]+data-button-spinner=""/);
  assert.match(html, /Download<\/a>$/);
  assert.equal((html.match(/data-button-spinner/g) ?? []).length, 1);
});
