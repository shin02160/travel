import { useState } from 'react';
import { formatLocalTimestamp } from '../dateDisplay.js';
import './ExpenseStatistics.css';

const currency = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' });
const percent = new Intl.NumberFormat('ko-KR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const colors = new Map(Object.entries({
  식비: '#369b76', 쇼핑: '#f3a6b3', 숙박: '#f1d981', 교통: '#77b4f7',
  관광: '#a49aee', 공연: '#a49aee', 기타: '#a8cde6', 미분류: '#87938c',
}));
const extraColors = ['#d68d56', '#679caa', '#ad8ba8', '#a4b86d'];

function categoryColor(name) {
  const hash = [...name].reduce((sum, letter) => sum + letter.codePointAt(0), 0);
  return colors.get(name) ?? extraColors[hash % extraColors.length];
}

function SpendingBreakdown({ stats, onCategory, label = '전체' }) {
  const [highlight, setHighlight] = useState(null);
  const active = stats.categories.find(category => category.name === highlight);
  const segments = [];
  let offset = 0;
  for (const category of stats.categories) {
    if (category.ratio > 0) {
      segments.push({ ...category, start: offset });
      offset += category.ratio * 100;
    }
  }

  return (
    <section className="travel-reader-card" aria-labelledby="expense-breakdown-title">
      <h3 id="expense-breakdown-title">{label === '전체' ? '' : `${label} · `}항목별 지출 비율</h3>
      {!stats.showRatio && (
        <p>{stats.hasNegativeCategory ? '비율 표시 불가: 환불이 지출액을 초과한 항목이 있습니다.' : '표시할 지출 비율이 없습니다.'}</p>
      )}
      <div className={stats.showRatio ? 'expense-stats-breakdown' : undefined}>
        {stats.showRatio && (
          <div className="expense-stats-donut" data-testid="expense-category-chart">
            <svg viewBox="0 0 200 200" role="group" aria-label="항목별 지출 도넛 차트">
              <circle cx="100" cy="100" r="82" fill="none" stroke="var(--border)" strokeWidth="25" />
              {segments.map(({ name, ratio, amount, start }) => {
                const label = `${name} ${currency.format(amount)}, ${percent.format(ratio)}`;
                return (
                  <circle key={name} cx="100" cy="100" r="82" pathLength="100" fill="none"
                    stroke={categoryColor(name)} strokeWidth={name === highlight ? 30 : 25}
                    strokeDasharray={`${ratio * 100} 100`} strokeDashoffset={-start}
                    transform="rotate(-90 100 100)" role="button" tabIndex={0} aria-label={label}
                    onFocus={() => setHighlight(name)} onBlur={() => setHighlight(null)}
                    onMouseEnter={() => setHighlight(name)} onMouseLeave={() => setHighlight(null)}
                    onClick={() => onCategory(name)} onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onCategory(name);
                      }
                    }}>
                    <title>{label}</title>
                  </circle>
                );
              })}
            </svg>
            <div className="expense-stats-donut-label" aria-hidden="true">
              <span>{active?.name ?? `${label === '전체' ? '' : `${label} `}총지출`}</span>
              <strong>{currency.format(active?.amount ?? stats.total)}</strong>
              {active && <span>{percent.format(active.ratio)}</span>}
            </div>
          </div>
        )}
        <table className="expense-stats-table">
          <thead><tr><th scope="col">항목</th><th scope="col">금액</th><th scope="col">비율</th></tr></thead>
          <tbody>
            {stats.categories.map(({ name, amount, ratio }) => (
              <tr key={name}>
                <th scope="row">
                  <button type="button" onClick={() => onCategory(name)}
                    onFocus={() => setHighlight(name)} onBlur={() => setHighlight(null)}
                    onMouseEnter={() => setHighlight(name)} onMouseLeave={() => setHighlight(null)}>
                    <span className="expense-stats-swatch" style={{ backgroundColor: categoryColor(name) }} aria-hidden="true" />
                    {name}
                  </button>
                </th>
                <td>{currency.format(amount)}</td>
                <td>{ratio === null ? '—' : percent.format(ratio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ExpenseStatistics({ trip, stats, period, onPeriodChange, onCategory, onHistory, lastRead }) {
  const [costType, setCostType] = useState(null);
  const selected = stats.costTypes.find(group => group.costType === costType);
  const displayStats = selected ?? stats;
  const { start, end } = period;
  const invalidRange = start && end && start > end;
  const filtered = start || end;
  const scope = filtered ? `${start || '처음'} ~ ${end || '최근'}` : '여행 전체';
  const missingCurrencies = [...stats.missingCurrencies].map(([name, count]) => `${name} ${count}건`).join(' · ');

  return (
    <div className="expense-statistics">
      <div className="expense-stats-filters travel-reader-card">
        <p>{trip.title} · {scope} · 원화(KRW)</p>
        <div className="expense-stats-dates">
          <label>결제 시작일<input type="date" value={start}
            onChange={event => onPeriodChange({ start: event.target.value, end })} /></label>
          <label>결제 종료일<input type="date" value={end}
            onChange={event => onPeriodChange({ start, end: event.target.value })} /></label>
        </div>
        {filtered && <button type="button" onClick={() => onPeriodChange({ start: '', end: '' })}>여행 전체</button>}
        {lastRead && <p>최근 Notion 조회 {formatLocalTimestamp(lastRead)}</p>}
      </div>
      {invalidRange ? <p className="travel-empty" role="alert">종료일을 시작일과 같거나 이후로 설정해 주세요.</p> : (
        <>
          <dl className="expense-stats-kpis">
            <div className="travel-reader-card"><dt>총지출</dt><dd data-testid="expense-total-spend">{stats.total === null ? '—' : currency.format(stats.total)}</dd></div>
            <div className="travel-reader-card"><dt>예산{filtered ? ' (여행 전체)' : ''}</dt><dd data-testid="expense-budget">{stats.budget === null ? '미설정' : currency.format(stats.budget)}</dd></div>
            <div className="travel-reader-card"><dt>예산 사용률</dt><dd data-testid="expense-usage-percent">{stats.usage === null ? '—' : percent.format(stats.usage)}</dd></div>
            <div className="travel-reader-card"><dt>잔여 예산</dt><dd data-testid="expense-remaining-budget" className={stats.remaining < 0 ? 'travel-error-text' : undefined}>{stats.remaining === null ? '—' : currency.format(stats.remaining)}</dd></div>
          </dl>
          {stats.missingAmount > 0 && <p className="expense-stats-note" role="status" data-testid="expense-statistics-incomplete-fx">환산할 수 없는 지출 {stats.missingAmount}건을 원화 합계에서 제외했습니다. {missingCurrencies}</p>}
          {stats.missingDate > 0 && <p className="expense-stats-note">결제일이 없는 {stats.missingDate}건은 기간 집계에서 제외했습니다.</p>}
          <section className="expense-stats-cost-types" aria-labelledby="expense-cost-title">
            <h3 id="expense-cost-title">공금·개인 지출</h3>
            <p>선택한 기간의 결제완료 지출에서 환불을 반영한 원화 금액입니다. 공동 비용은 공금으로 집계합니다.</p>
            {stats.costTypes.find(group => group.costType === '미지정')?.count > 0 && <p>비용구분이 비어 있거나 알려진 값이 아닌 항목은 미지정에 포함됩니다.</p>}
            <button type="button" aria-pressed={costType === null} onClick={() => setCostType(null)}>전체 통계</button>
            <div className="expense-stats-cost-grid" role="group" aria-label="비용구분별 통계 선택">
              {stats.costTypes.map(group => <button key={group.costType} type="button"
                className="travel-reader-card expense-stats-cost-card" aria-pressed={costType === group.costType}
                onClick={() => setCostType(group.costType)}>
                <span>{group.name} 지출</span>
                <strong>{group.total === null ? '—' : currency.format(group.total)}</strong>
                <small>{group.count}건 · 전체 대비 {group.ratio === null ? '—' : percent.format(group.ratio)}</small>
              </button>)}
            </div>
            {selected && <p>{selected.name} 기준의 항목별 통계입니다. 상단 예산 비교는 공금·개인을 합한 전체 지출 기준입니다.</p>}
            {selected && <button type="button" onClick={() => onCategory(null, costType)}>{selected.name} 지출 내역 보기</button>}
          </section>
          {displayStats.total === null ? (
            <div className="travel-empty">
              <p>{selected ? `이 범위에 집계할 ${selected.name} 지출이 없습니다.` : stats.missingAmount ? '이 범위에서 원화로 집계할 수 있는 지출이 없습니다.' : '이 범위에 집계할 결제완료 지출이 없습니다.'}</p>
              <button type="button" onClick={onHistory}>지출 내역 보기</button>
            </div>
          ) : <SpendingBreakdown key={costType ?? 'all'} stats={displayStats} label={selected?.name ?? '전체'}
            onCategory={name => onCategory(name, costType)} />}
        </>
      )}
    </div>
  );
}
