import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockText, clockTime, dateTime } from '../src/lib/dateTimeFormat';

test('24-hour display preserves instants and caller time zones including midnight and DST', () => {
  for (const [instant, zone, expected] of [
    ['2026-10-03T00:05:00Z', 'UTC', '00:05'],
    ['2026-10-03T12:00:00Z', 'UTC', '12:00'],
    ['2026-10-03T23:45:00Z', 'UTC', '23:45'],
    ['2026-10-03T23:45:00Z', 'America/Vancouver', '16:45'],
    ['2026-10-03T23:45:00Z', 'Asia/Karachi', '04:45'],
    ['2026-03-08T09:30:00Z', 'America/Vancouver', '01:30'],
    ['2026-03-08T10:30:00Z', 'America/Vancouver', '03:30'],
  ]) {
    assert.equal(clockTime(instant, zone), expected);
    assert.ok(dateTime(instant, zone).endsWith(expected));
    assert.doesNotMatch(dateTime(instant, zone), /[ap]\.?m\.?/i);
  }
});

test('legacy schedule text uses 24-hour time without changing non-clock content', () => {
  assert.equal(clockText('10:30 AM – 01:30 PM'), '10:30 – 13:30');
  assert.equal(dateTime('12:00 AM – 12:00 PM'), '00:00 – 12:00');
  assert.equal(clockText('Same-Day (by 5 PM)'), 'Same-Day (by 17:00)');
  assert.equal(clockText('11:36 p.m.'), '23:36');
  assert.equal(clockText('13:00 – 15:00'), '13:00 – 15:00');
  assert.equal(clockText('Unscheduled'), 'Unscheduled');
});

test('missing date and time displays remain empty for caller placeholders', () => {
  for (const value of [undefined, null, '']) {
    assert.equal(dateTime(value), '');
    assert.equal(clockTime(value), '');
  }
});
