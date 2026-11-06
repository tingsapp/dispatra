import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReadRecovery, recoverableRead, type RecoveryKind } from '../src/portal/readRecovery';

const origin = 'https://app.example.test';
const request = (path = '/api/v1/companies/acme/orders', method = 'GET', signal?: AbortSignal) => new Request(origin + path, { method, signal });
const wait = async () => {};

test('only reviewed reads are recoverable; writes, provider calls and other origins are excluded', () => {
  assert.ok(recoverableRead(request(), origin));
  for (const path of ['/api/v1/auth/verification', '/api/v1/companies/acme/orders/id/dispatch-suggestion', '/api/v1/companies/acme/routes/id/geometry', '/api/v1/diagnostics/runtime']) {
    assert.equal(recoverableRead(request(path), origin), false);
  }
  assert.equal(recoverableRead(request(undefined, 'POST'), origin), false);
  assert.equal(recoverableRead(new Request('https://other.example.test/api/v1/companies/acme/orders'), origin), false);
});

test('transient reads recover without losing request headers and only report verified success', async () => {
  let calls = 0;
  const events: RecoveryKind[] = [];
  const fetch = createReadRecovery({ origin: () => origin, wait, report: kind => events.push(kind), send: async req => {
    assert.equal(req.headers.get('X-Requested-With'), 'Dispatra');
    return new Response(++calls < 3 ? 'unavailable' : 'saved result', { status: calls < 3 ? 503 : 200 });
  } });
  const result = await fetch(new Request(request(), { headers: { 'X-Requested-With': 'Dispatra' } }));
  assert.equal(await result.text(), 'saved result');
  assert.equal(calls, 3); assert.deepEqual(events, ['READ_RECOVERED']);
});

test('exhaustion returns the real last response and reports failure once', async () => {
  let calls = 0; const events: RecoveryKind[] = [];
  const fetch = createReadRecovery({ origin: () => origin, wait, report: kind => events.push(kind), send: async () => {
    calls++; return new Response('still unavailable', { status: 502 });
  } });
  assert.equal((await fetch(request())).status, 502);
  assert.equal(calls, 3); assert.deepEqual(events, ['READ_RECOVERY_FAILED']);
});

test('unsafe operations and auth/validation errors are never retried', async () => {
  for (const [req, status] of [[request(undefined, 'POST'), 503], [request(), 401], [request(), 403], [request(), 409], [request(), 422], [request(), 429]] as const) {
    let calls = 0;
    const fetch = createReadRecovery({ origin: () => origin, wait, report: () => assert.fail('unexpected diagnostic'), send: async () => {
      calls++; return new Response(null, { status });
    } });
    assert.equal((await fetch(req)).status, status); assert.equal(calls, 1);
  }
});

test('offline and cancelled reads never create false system incidents', async () => {
  const failure = new TypeError('Network error'); let calls = 0;
  const fetch = createReadRecovery({ origin: () => origin, online: () => false, wait,
    report: () => assert.fail('offline is not a server failure'), send: async () => { calls++; throw failure; } });
  await assert.rejects(fetch(request()), error => error === failure); assert.equal(calls, 1);
  const controller = new AbortController(); controller.abort();
  const cancelled = createReadRecovery({ origin: () => origin, wait, report: () => assert.fail('abort must remain quiet'),
    send: async () => { throw controller.signal.reason; } });
  await assert.rejects(cancelled(request(undefined, 'GET', controller.signal)), { name: 'AbortError' });
});

test('cancellation during backoff stops retries', async () => {
  const controller = new AbortController(); let calls = 0;
  const fetch = createReadRecovery({ origin: () => origin, report: () => assert.fail('abort must stay quiet'),
    send: async () => { calls++; setTimeout(() => controller.abort(), 10); return new Response(null, { status: 503 }); } });
  await assert.rejects(fetch(request(undefined, 'GET', controller.signal)), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('Retry-After is respected and long provider backoffs are not bypassed', async () => {
  let calls = 0; const delays: number[] = [];
  const fetch = createReadRecovery({ origin: () => origin, report: () => {}, wait: async ms => { delays.push(ms); },
    send: async () => ++calls === 1 ? new Response(null, { status: 503, headers: { 'Retry-After': '3' } }) : new Response(null) });
  await fetch(request()); assert.deepEqual(delays, [3000]);
  calls = 0;
  const slow = createReadRecovery({ origin: () => origin, report: () => {}, wait: async () => assert.fail('must not bypass backoff'),
    send: async () => { calls++; return new Response(null, { status: 503, headers: { 'Retry-After': '60' } }); } });
  assert.equal((await slow(request())).status, 503); assert.equal(calls, 1);
});

test('shared retry budget bounds an outage across many reads', async () => {
  let calls = 0;
  const fetch = createReadRecovery({ origin: () => origin, wait, report: () => {}, send: async () => {
    calls++; throw new TypeError('Network failure');
  } });
  await Promise.all(Array.from({ length: 12 }, () => assert.rejects(fetch(request()))));
  assert.equal(calls, 18); // Twelve original reads plus six retries total.
});

test('diagnostic failures cannot turn a successful read into a failed operation', async () => {
  let calls = 0;
  const fetch = createReadRecovery({ origin: () => origin, wait, report: () => { throw new Error('telemetry failed'); },
    send: async () => new Response(null, { status: ++calls === 1 ? 503 : 200 }) });
  assert.equal((await fetch(request())).status, 200);
});

test('recovery diagnostics are throttled, contain only categories, and unsubscribe cleanly', async () => {
  const { installRuntimeDiagnostics } = await import('../src/portal/runtimeDiagnostics');
  const { RECOVERY_EVENT } = await import('../src/portal/readRecovery');
  const target = new EventTarget(); const reports: string[] = [];
  const stop = installRuntimeDiagnostics(target, async kind => { reports.push(kind); return { accepted: true }; });
  for (const kind of ['READ_RECOVERED', 'READ_RECOVERED', 'READ_RECOVERY_FAILED', 'SECRET']) target.dispatchEvent(new CustomEvent(RECOVERY_EVENT, { detail: kind }));
  assert.deepEqual(reports, ['READ_RECOVERED', 'READ_RECOVERY_FAILED']);
  stop(); target.dispatchEvent(new Event('error'));
  assert.equal(reports.length, 2);
});
