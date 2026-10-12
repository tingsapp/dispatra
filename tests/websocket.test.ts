import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { streamSync, socketUrl } from '../src/portal/streamSync';
import { ApiError } from '../src/portal/api';
const dom = new JSDOM('', { url: 'https://dispatra.com/acme/' });
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
class Socket {
  static instances: Socket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) { Socket.instances.push(this); }
  close() { this.closed = true; }
  send(view: unknown) { this.onmessage?.({ data: JSON.stringify(view) }); }
}
Object.defineProperty(globalThis, 'WebSocket', { value: Socket, configurable: true });
const frame = (cursor: string) => ({ cursor, changes: [], unread: 0, unread_messages: 0, reset: false, next_poll_ms: 15000 });
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 1)); };

test('same-origin socket delivers updates, falls back, and reconnects from the last applied cursor', async () => {
  Socket.instances = [];
  const cursors: (string | undefined)[] = [], applied: string[] = [];
  const feed = streamSync('acme', { read: async cursor => { cursors.push(cursor); return frame(cursors.length === 1 ? '10-0' : '20-4'); }, apply: async view => { applied.push(view.cursor); }, expired: () => assert.fail('Unexpected expiry') });
  try {
    await settle();
    const socket = Socket.instances[0];
    assert.equal(socket.url, 'wss://dispatra.com/api/v1/companies/acme/ws?cursor=10-0');
    socket.send({ ...frame('11-1'), changes: [{ entity: 'notification' }], unread: 1 });
    socket.send(frame('12-2'));
    await settle();
    assert.deepEqual(applied, ['10-0', '11-1', '12-2']);
    assert.deepEqual(cursors, [undefined]);
    socket.onclose?.();
    await settle();
    assert.equal(socket.closed, true);
    assert.deepEqual(cursors, [undefined, '12-2']);
    feed.recover();
    await settle();
    assert.ok(Socket.instances[1].url.endsWith('cursor=20-4'));
    assert.equal(socketUrl('a b').includes('/a%20b/ws'), true);
  } finally { feed.stop(); }
  assert.equal(Socket.instances.at(-1)?.closed, true);
});

test('bad frames recover through HTTP and an expired session stops reconnecting', async () => {
  Socket.instances = [];
  let reads = 0, expired = 0;
  const feed = streamSync('acme', { read: async () => { if (++reads > 1) throw new ApiError(401, 'Expired'); return frame('1-0'); }, apply: async () => {}, expired: () => { expired++; } });
  await settle();
  Socket.instances[0].send({ cursor: 'bad' });
  await settle();
  assert.equal(expired, 1);
  feed.recover(); await settle();
  assert.equal(reads, 2);
  feed.stop();
});
