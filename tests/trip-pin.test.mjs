import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { tripPinConfig } from '../server/trip-pin.js';

const existingId = randomUUID();
const newId = randomUUID();
const existingPin = String(randomInt(10_000)).padStart(4, '0');
const newPin = String((Number(existingPin) + 1) % 10_000).padStart(4, '0');
const env = {
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  TRAVEL_DETAIL_PINS: JSON.stringify({ [existingId]: existingPin }),
};

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
