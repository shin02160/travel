import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateExpenseStatistics } from '../src/expenseStatistics.js';

function expense(id, fields, posting = {}) {
  return { id, fields, posting: { status: '결제완료', type: '지출', ...posting } };
}

test('expense statistics use the confirmed KRW amount first and group eligible net spending', () => {
  const rows = [
    expense('a', { 분류: '식비', 통화: 'CNY', '원화 확정액': 9500, '현지 금액': 99 }, { rate: 200 }),
    expense('b', { 분류: '식비', '원화 확정액': 500 }, { type: '환불' }),
    expense('c', { 통화: 'CNY', '현지 금액': 4.999 }, { rate: 200 }),
    expense('d', { 통화: 'JPY', '현지 금액': 800 }),
    expense('e', { '원화 확정액': 300 }, { status: '취소' }),
    expense('f', { '원화 확정액': 300 }, { status: '예정' }),
  ];
  const stats = calculateExpenseStatistics([...rows, rows[0]], 20000);
  assert.equal(stats.total, 10000);
  assert.equal(stats.usage, 0.5);
  assert.equal(stats.remaining, 10000);
  assert.deepEqual(stats.categories, [
    { name: '식비', amount: 9000, ratio: 0.9 }, { name: '미분류', amount: 1000, ratio: 0.1 },
  ]);
  assert.deepEqual([...stats.includedIds], ['a', 'b', 'c']);
  assert.deepEqual([...stats.missingCurrencies], [['JPY', 1]]);
});

test('a period is inclusive and uses the trip timezone for payments with explicit offsets', () => {
  const stats = calculateExpenseStatistics([
    expense('a', { 결제일: '2026-12-06T00:30:00+09:00', 통화: 'KRW', '현지 금액': 1000 }),
    expense('b', { 결제일: '2026-12-06', '원화 확정액': 300 }),
    expense('c', { '원화 확정액': 600 }),
  ], null, { start: '2026-12-05', end: '2026-12-05', zone: 'Asia/Macau' });
  assert.equal(stats.total, 1000);
  assert.equal(stats.missingDate, 1);
  assert.deepEqual([...stats.includedIds], ['a']);
});

test('an empty or unconvertible result differs from zero and negative net categories hide ratios', () => {
  const incomplete = calculateExpenseStatistics([expense('a', { 통화: 'JPY', '현지 금액': 10 })], 1000);
  assert.equal(incomplete.total, null);
  assert.equal(incomplete.remaining, null);
  assert.equal(incomplete.missingAmount, 1);
  const zero = calculateExpenseStatistics([expense('a', { '원화 확정액': 0 })], 0);
  assert.equal(zero.total, 0);
  assert.equal(zero.usage, null);
  assert.equal(zero.showRatio, false);
  const refunded = calculateExpenseStatistics([
    expense('a', { 분류: '식비', '원화 확정액': 400 }),
    expense('b', { 분류: '교통', '원화 확정액': -500 }, { type: '환불' }),
  ], 1000);
  assert.equal(refunded.total, -100);
  assert.equal(refunded.remaining, 1100);
  assert.equal(refunded.showRatio, false);
  assert.equal(refunded.categories[1].amount, -500);
});
