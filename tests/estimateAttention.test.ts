import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateAttention } from '../src/lib/estimateAttention';

const snapshot = (status: 'PRICED' | 'NEEDS_ATTENTION', errors: string[] = [], warnings: string[] = []) => ({ status, errors: errors.map(message => ({ code: message, message })), warnings }) as any;

test('an estimate is shown only when pricing and the draft are clear', () => {
  assert.deepEqual(estimateAttention(snapshot('PRICED'), []), []);
  assert.deepEqual(estimateAttention(snapshot('PRICED'), ['Delivery address is incomplete.']), ['Delivery address is incomplete.']);
  assert.deepEqual(estimateAttention(snapshot('NEEDS_ATTENTION', ['No pricing zone matches this postal code.']), []), ['No pricing zone matches this postal code.']);
  assert.deepEqual(estimateAttention(snapshot('NEEDS_ATTENTION'), []), ['Complete the shipment details before a live estimate can be calculated.']);
});
