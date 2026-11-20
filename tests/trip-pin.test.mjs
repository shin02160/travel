import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { tripPinConfig } from '../server/trip-pin.js';
import { deriveTripPin } from '../server/trip-pin.js';

const existingId = randomUUID();
const newId = randomUUID();
const existingPin = String(randomInt(10_000)).padStart(4, '0');
const newPin = String((Number(existingPin) + 1) % 10_000).padStart(4, '0');
const env = {
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  TRAVEL_DETAIL_PINS: JSON.stringify({ [existingId]: existingPin }),
};

test('automatic PIN derives strict calendar dates and preserves leading zeros', () => {
  for (const [date, expected] of [['2027-03-09', '0309'], ['2027-02-05', '0205'], ['2028-02-29', '0229'], ['2027-01-01', '0101'], ['2027-12-31', '1231']]) {
    assert.equal(deriveTripPin(date), expected);
  }
  for (const date of [null, '', '0000-01-01', '2027-02-29', '2027-02-30', '2027-13-01', '2027-03-09T00:00:00+09:00', '2027-3-9']) {
    assert.equal(deriveTripPin(date), null);
  }
});

test('automatic policy is opt-in, blocked policy wins and all explicit PIN sources keep priority', () => {
  const automatic = { policy: '시작일 자동', start: '2027-03-09', end: '2027-03-12' };
  assert.equal(tripPinConfig(newId, env, automatic).pin, '0309');
  assert.equal(tripPinConfig(existingId, env, automatic).pin, existingPin);
  assert.equal(tripPinConfig(newId, { ...env, TRAVEL_DETAIL_ADDITIONAL_PINS: JSON.stringify({ [newId]: newPin }) }, automatic).pin, newPin);
  assert.equal(tripPinConfig(newId, { ...env, [`TRAVEL_DETAIL_PIN_${newId.replaceAll('-', '').toUpperCase()}`]: newPin }, automatic).pin, newPin);
  assert.equal(tripPinConfig(existingId, env, { ...automatic, policy: '접근 차단' }), null);
  for (const policy of [undefined, '기존 PIN', 'unknown']) assert.equal(tripPinConfig(newId, env, { ...automatic, policy }), null);
  for (const start of [null, '2027-02-30']) assert.equal(tripPinConfig(newId, env, { ...automatic, start }), null);
  assert.equal(tripPinConfig(newId, env, { ...automatic, end: '2027-03-08' }), null);
  assert.equal(tripPinConfig(newId, { ...env, SESSION_SECRET: '' }, automatic), null);
  for (const invalid of [null, 309, '', 'invalid']) {
    assert.equal(tripPinConfig(newId, { ...env, TRAVEL_DETAIL_PINS: JSON.stringify({ [newId]: invalid }) }, automatic), null);
  }
  for (const value of ['null', '[]', '{']) assert.equal(tripPinConfig(newId, { ...env, TRAVEL_DETAIL_PINS: value }, automatic), null);
});

test('adding a trip preserves existing PIN configuration and signing secret', () => {
  const extended = { ...env, TRAVEL_DETAIL_ADDITIONAL_PINS: JSON.stringify({ [newId]: newPin }) };
  assert.deepEqual(tripPinConfig(existingId, extended), tripPinConfig(existingId, env));
  assert.equal(tripPinConfig(newId, extended)?.pin, newPin);
  assert.equal(tripPinConfig(randomUUID(), extended), null);
});

test('additional mapping cannot override an existing PIN', () => {
  const config = { ...env, TRAVEL_DETAIL_ADDITIONAL_PINS: JSON.stringify({ [existingId]: newPin }) };
  assert.equal(tripPinConfig(existingId, config)?.pin, existingPin);
});

test('invalid additional configuration leaves existing trips usable and new trips locked', () => {
  for (const value of ['{', 'null', JSON.stringify({ [newId]: 1234 }), JSON.stringify({ [newId]: 'abc' })]) {
    const config = { ...env, TRAVEL_DETAIL_ADDITIONAL_PINS: value };
    assert.deepEqual(tripPinConfig(existingId, config), tripPinConfig(existingId, env));
    assert.equal(tripPinConfig(newId, config), null);
  }
});

test('additional trips still require a valid signing secret', () => {
  const config = { ...env, SESSION_SECRET: '', TRAVEL_DETAIL_ADDITIONAL_PINS: JSON.stringify({ [newId]: newPin }) };
  assert.equal(tripPinConfig(newId, config), null);
});

test('individual trip PIN preserves both existing mappings and remains scoped to one trip', () => {
  const key = `TRAVEL_DETAIL_PIN_${newId.replaceAll('-', '').toUpperCase()}`;
  const extended = { ...env, [key]: newPin };
  assert.equal(tripPinConfig(newId, extended)?.pin, newPin);
  assert.deepEqual(tripPinConfig(existingId, extended), tripPinConfig(existingId, env));
  assert.equal(tripPinConfig(randomUUID(), extended), null);
  assert.equal(tripPinConfig(newId, { ...extended, SESSION_SECRET: '' }), null);
  for (const pin of ['', '123', '12345', 'abcd', 1234]) {
    assert.equal(tripPinConfig(newId, { ...extended, [key]: pin }), null);
  }
  assert.equal(tripPinConfig(newId, {
    ...extended, TRAVEL_DETAIL_ADDITIONAL_PINS: JSON.stringify({ [newId]: existingPin }),
  })?.pin, existingPin);
  assert.equal(tripPinConfig(newId, {
    ...extended, TRAVEL_DETAIL_PINS: JSON.stringify({ [newId]: existingPin }),
  })?.pin, existingPin);
});
