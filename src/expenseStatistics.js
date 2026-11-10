import { dateInZone } from './todaySchedule.js';

export function expenseCategory(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '미분류';
}

function wonAmount(expense) {
  const { fields, posting } = expense;
  let amount = fields['원화 확정액'];
  if (!Number.isFinite(amount)) {
    const local = fields['현지 금액'];
    const rate = fields.통화 === 'KRW' ? 1 : posting.rate;
    if (!fields.통화 || !Number.isFinite(local) || !Number.isFinite(rate) || rate <= 0) return null;
    amount = local * rate;
  }
  const won = Math.round(Math.abs(amount));
  if (!Number.isSafeInteger(won)) return null;
  if (won === 0) return 0;
  return amount < 0 || posting.type === '환불' ? -won : won;
}

export function calculateExpenseStatistics(expenses, budgetValue, { start = '', end = '', zone } = {}) {
  const seen = new Set();
  const includedIds = new Set();
  const missingCurrencies = new Map();
  const totals = new Map();
  let total = 0;
  let missingDate = 0;
  let missingAmount = 0;
  for (const expense of expenses) {
    const { id, fields, posting } = expense;
    if (seen.has(id) || posting?.status !== '결제완료' || !['지출', '환불'].includes(posting.type)) continue;
    seen.add(id);
    if (start || end) {
      const day = dateInZone(fields.결제일, zone);
      if (!day) {
        missingDate++;
        continue;
      }
      if ((start && day < start) || (end && day > end)) continue;
    }
    const amount = wonAmount(expense);
    if (amount === null) {
      missingAmount++;
      const currency = fields.통화 || '통화 미입력';
      missingCurrencies.set(currency, (missingCurrencies.get(currency) ?? 0) + 1);
      continue;
    }
    includedIds.add(id);
    const category = expenseCategory(fields.분류);
    totals.set(category, (totals.get(category) ?? 0) + amount);
    total += amount;
  }

  const hasNegativeCategory = [...totals.values()].some(amount => amount < 0);
  const showRatio = total > 0 && !hasNegativeCategory;
  const categories = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .map(([name, amount]) => ({ name, amount, ratio: showRatio ? amount / total : null }));
  const budget = Number.isFinite(budgetValue) && budgetValue >= 0 ? Math.round(budgetValue) : null;
  const canCompare = budget > 0 && includedIds.size > 0;
  return {
    total: includedIds.size ? total : null,
    budget,
    usage: canCompare ? total / budget : null,
    remaining: canCompare ? budget - total : null,
    categories, includedIds, missingDate, missingAmount, missingCurrencies, hasNegativeCategory, showRatio,
  };
}
