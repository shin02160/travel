import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime, formatLocalTimestamp } from '../src/dateDisplay.js';

test('Notion times display to the minute without shifting the stored local clock', () => {
  assert.equal(formatDateTime('2026-12-05T09:07:59.000+08:00'), '2026-12-05 09:07');
  assert.equal(formatDateTime('2026-12-05T23:55Z ~ 2026-12-06T01:05:00Z'),
    '2026-12-05 23:55 ~ 2026-12-06 01:05');
});

test('date-only values retain their dates and missing values do not invent times', () => {
  assert.equal(formatDateTime('2026-12-05 ~ 2026-12-08'), '2026-12-05 ~ 2026-12-08');
  assert.equal(formatDateTime('2026-12-05'), '2026-12-05');
  assert.equal(formatDateTime(null), '');
  assert.equal(formatLocalTimestamp(new Date(2026, 11, 5, 9, 7, 59).getTime()), '2026-12-05 09:07');
});
