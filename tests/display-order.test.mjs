import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBookingUseDate, sortByDisplayOrder } from '../src/displayOrder.js';

const booking = (id, displayOrder, date) => ({ id, displayOrder, fields: { 이용일: date } });
const ids = rows => rows.map(row => row.id);

test('reservation display order takes precedence and equal orders fall back to use date and input order', () => {
  const rows = [
    booking('undated', null),
    booking('tied-first', 20, '2026-12-06'),
    booking('tied-second', 20, '2026-12-06'),
    booking('numbered-earlier-date', 20, '2026-12-05'),
    booking('zero', 0, '2026-12-08'),
    booking('unnumbered-with-date', undefined, '2026-12-04'),
    booking('between', 25, '2026-12-03'),
  ];
  assert.deepEqual(ids(sortByDisplayOrder(rows, compareBookingUseDate)), [
    'zero', 'numbered-earlier-date', 'tied-first', 'tied-second', 'between', 'unnumbered-with-date', 'undated',
  ]);
  assert.equal(rows[0].id, 'undated');
});

test('expense order keeps registration order for duplicate numbers and missing or invalid values', () => {
  const rows = [
    { id: 'first', displayOrder: null },
    { id: 'numbered-first', displayOrder: 10 },
    { id: 'string', displayOrder: '0' },
    { id: 'numbered-second', displayOrder: 10 },
    { id: 'last' },
  ];
  assert.deepEqual(ids(sortByDisplayOrder(rows)), ['numbered-first', 'numbered-second', 'first', 'string', 'last']);
});
