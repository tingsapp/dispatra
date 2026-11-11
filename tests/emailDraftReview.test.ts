import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionableReviewMessages, reviewMessage, reviewMessages } from '../src/lib/emailDraftReview';

test('legacy draft messages use pickup and delivery language', () => {
  assert.equal(reviewMessage('Stop 2: complete address with street, city, province and postal code'), 'Delivery address is incomplete. Add street, city, province and postal code.');
  assert.equal(reviewMessage('Stop 1: address could not be verified on the map'), 'Pickup address could not be verified on the map. Choose a complete suggested address or add its postal code.');
});

test('matched shippers do not show legacy sender-verification review notes', () => {
  assert.deepEqual(reviewMessages(['Sender verification: confirm this email really came from the Shipper', 'Stop 2: complete address with street, city, province and postal code'], 'shipper-1'), ['Delivery address is incomplete. Add street, city, province and postal code.']);
});

test('a verified pricing zone clears an obsolete map-verification warning for that stop', () => {
  assert.deepEqual(
    actionableReviewMessages(['Delivery address could not be verified on the map. Choose a complete suggested address or add its postal code.'], 'shipper-1', [{ type: 'DROPOFF', zoneId: 'zone-2' }]),
    []
  );
  assert.equal(
    actionableReviewMessages(['Delivery address could not be verified on the map. Choose a complete suggested address or add its postal code.'], 'shipper-1', [{ type: 'DROPOFF', zoneId: null }]).length,
    1
  );
});
