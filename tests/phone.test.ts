import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatPhone, formatPhoneInput, phoneHref } from '../src/lib/phone';
import { isValidEmail } from '../src/lib/email';

test('phone numbers display in North American format and leave anything else as entered', () => {
  assert.equal(formatPhone('6045550101'), '(604) 555-0101');
  assert.equal(formatPhone('604-555-0101'), '(604) 555-0101');
  assert.equal(formatPhone('+1 604 555 0101'), '+1 (604) 555-0101');
  assert.equal(formatPhone(' 555-0101 '), '555-0101');
  assert.equal(formatPhone(undefined), '');
});

test('phone fields format as typed without trailing separators', () => {
  const typed = [...'6043586263'].reduce<string[]>((steps, d) => [...steps, formatPhoneInput((steps.at(-1) ?? '') + d)], []);
  assert.deepEqual(typed, ['(6', '(60', '(604', '(604) 3', '(604) 35', '(604) 358', '(604) 358-6', '(604) 358-62', '(604) 358-626', '(604) 358-6263']);
  assert.equal(formatPhoneInput('(604) 358-'), '(604) 358');
  assert.equal(formatPhoneInput('(604) '), '(604');
  assert.equal(formatPhoneInput('604.358.62639'), '(604) 358-6263');
  assert.equal(formatPhoneInput('16043586263'), '+1 (604) 358-6263');
  assert.equal(formatPhoneInput('+1604358'), '+1 (604) 358');
  assert.equal(formatPhoneInput('+44 20 7946 0958'), '+44 20 7946 0958');
  assert.equal(formatPhoneInput(''), '');
});

test('email validation accepts real addresses and rejects malformed ones', () => {
  for (const ok of ['a@b.co', 'first.last+tag@sub.company.ca', ' ops@dispatra.com ']) assert.ok(isValidEmail(ok), ok);
  for (const bad of ['', 'plain', 'a@b', 'a@b.c', 'a b@c.com', 'a@@b.com', 'a..b@c.com', '.a@c.com', 'a.@c.com', 'a@-b.com', 'a@b..com', `${'x'.repeat(250)}@b.com`, undefined]) assert.ok(!isValidEmail(bad), String(bad));
});


test('contact calls use normalized saved phone numbers and reject missing or unsafe targets', () => {
  assert.equal(phoneHref('+1 (604) 555-0101'),'tel:+16045550101');
  assert.equal(phoneHref('(604) 555-0101 ext. 42'),'tel:6045550101;ext=42');
  assert.equal(phoneHref('604-555-0101'),'tel:6045550101');
  for(const value of ['',undefined,'Unavailable','123','javascript:1234567890','+1+6045550101'])assert.equal(phoneHref(value),undefined);
});
