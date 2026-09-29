import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatPhone } from '../src/lib/phone';

test('phone numbers display in North American format and leave anything else as entered', () => {
  assert.equal(formatPhone('6045550101'), '(604) 555-0101');
  assert.equal(formatPhone('604-555-0101'), '(604) 555-0101');
  assert.equal(formatPhone('+1 604 555 0101'), '+1 (604) 555-0101');
  assert.equal(formatPhone(' 555-0101 '), '555-0101');
  assert.equal(formatPhone(undefined), '');
});
