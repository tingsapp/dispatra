import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/ask-dispatra',pretendToBeVisual:true});
for (const name of ['window','document','navigator','HTMLElement','Element','Node','location','history']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
dom.window.scrollTo = () => {};
const { render, screen, cleanup } = await import('@testing-library/react');
const { default: Contact } = await import('../src/pages/ContactPage');
afterEach(cleanup);
test('contact preserves either chosen plan in an email draft to the approved address',()=>{
  for (const [id,name] of [['full','TMS + Smart Dispatching'],['dispatch','Smart Dispatching']]) {
    history.replaceState(null,'',`/ask-dispatra?plan=${id}`); render(React.createElement(Contact));
    const url = new URL(screen.getByRole('link',{name:'Email our team'}).getAttribute('href')!);
    assert.equal(url.pathname,'dispatra@tingsapp.com');
    assert.equal(url.searchParams.get('subject'),`Dispatra enquiry: ${name}`);
    assert.ok(url.searchParams.get('body')?.includes(name));
    assert.equal(screen.queryByRole('link',{name:'Back to plans'}),null);
    assert.ok(screen.getByRole('region',{name:/Prefer to reach out/}));
    cleanup();
  }
});
test('direct contact and unknown plan identifiers safely use the general enquiry',()=>{
  for (const query of ['','?plan=unknown','?plan=__proto__','?plan=constructor']) {
    history.replaceState(null,'','/ask-dispatra'+query);render(React.createElement(Contact));
    const href=screen.getByRole('link',{name:'Email our team'}).getAttribute('href')!;
    assert.equal(new URL(href).searchParams.get('subject'),'Dispatra plan enquiry');
    assert.equal(screen.queryByText('dispatra@tingsapp.com'), null); cleanup();
  }
});
