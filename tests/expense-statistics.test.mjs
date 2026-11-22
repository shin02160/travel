import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateExpenseStatistics, expenseCostType } from '../src/expenseStatistics.js';

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

test('common funds, personal and unspecified totals reconcile with eligible net spending and category totals', () => {
  const rows = [
    expense('shared', { 비용구분: '공동', 분류: '식비', '원화 확정액': 10000 }),
    expense('shared-refund', { 비용구분: '공금', 분류: '식비', '원화 확정액': 2000 }, { type: '환불' }),
    expense('personal', { 비용구분: '개인 ', 분류: '쇼핑', 통화: 'CNY', '현지 금액': 20 }, { rate: 100 }),
    expense('missing', { '원화 확정액': 500 }),
    expense('unknown', { 비용구분: '다른 값', '원화 확정액': 500 }),
    expense('pending', { 비용구분: '공동', '원화 확정액': 10000 }, { status: '예정' }),
    expense('unconverted', { 비용구분: '개인', 통화: 'JPY', '현지 금액': 300 }),
  ];
  const stats = calculateExpenseStatistics([...rows, rows[0]], 20000);
  assert.equal(stats.total, 11000);
  assert.equal(stats.missingAmount, 1);
  assert.deepEqual(stats.costTypes.map(({ costType, name, total, count }) => ({ costType, name, total, count })), [
    { costType: '공동', name: '공금', total: 8000, count: 2 },
    { costType: '개인', name: '개인', total: 2000, count: 1 },
    { costType: '미지정', name: '미지정', total: 1000, count: 2 },
  ]);
  assert.equal(stats.costTypes.reduce((sum, group) => sum + group.total, 0), stats.total);
  for (const group of stats.costTypes) {
    assert.equal(group.categories.reduce((sum, category) => sum + category.amount, 0), group.total);
    assert.equal(group.ratio, group.total / stats.total);
  }
  assert.equal(stats.costTypes[0].categories[0].name, '식비');
  assert.equal(stats.costTypes[1].categories[0].name, '쇼핑');
  assert.equal(expenseCostType(null), '미지정');
  assert.equal(expenseCostType('공금'), '공동');
});

test('cost-type statistics share period, timezone and conversion eligibility with total spending', () => {
  const stats = calculateExpenseStatistics([
    expense('common', { 비용구분: '공동', 결제일: '2026-12-06T00:30:00+09:00', '원화 확정액': 1000 }),
    expense('personal', { 비용구분: '개인', 결제일: '2026-12-06', '원화 확정액': 300 }),
    expense('undated', { 비용구분: '개인', '원화 확정액': 600 }),
  ], null, { start: '2026-12-05', end: '2026-12-05', zone: 'Asia/Macau' });
  assert.deepEqual(stats.costTypes.map(group => [group.total, group.count]), [[1000, 1], [null, 0], [null, 0]]);
  assert.equal(stats.missingDate, 1);
  assert.equal(stats.costTypes[0].ratio, 1);
});

test('zero net costs differ from absent groups and negative costs suppress misleading shares', () => {
  const zero = calculateExpenseStatistics([
    expense('paid', { 비용구분: '공동', '원화 확정액': 500 }),
    expense('returned', { 비용구분: '공동', '원화 확정액': 500 }, { type: '환불' }),
  ]);
  assert.equal(zero.costTypes[0].total, 0);
  assert.equal(zero.costTypes[0].count, 2);
  assert.equal(zero.costTypes[1].total, null);
  assert.equal(zero.costTypes[0].showRatio, false);
  const negative = calculateExpenseStatistics([
    expense('refund', { 비용구분: '공동', 분류: '식비', '원화 확정액': -500 }),
    expense('paid', { 비용구분: '개인', 분류: '식비', '원화 확정액': 1500 }),
  ]);
  assert.equal(negative.total, 1000);
  assert.ok(negative.costTypes.every(group => group.ratio === null));
  assert.equal(negative.costTypes[0].showRatio, false);
  assert.equal(negative.costTypes[1].showRatio, true);
});
