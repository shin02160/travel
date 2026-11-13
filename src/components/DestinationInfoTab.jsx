import { useEffect, useRef, useState } from 'react';
import { citiesForTrip, INFO_CATEGORIES } from '../destinationCities.js';
import { loadWeather, localWeatherTime, travelForecastDays, WEATHER_MAX_AGE, WEATHER_TTL, weatherCondition } from '../destinationWeather.js';
import { tripCalendar } from '../todaySchedule.js';
import './DestinationInfoTab.css';

const weatherCache = new Map();
const manualRefreshAt = new Map();
const emptyWeather = { status: 'loading', data: null, locked: true };
const temp = (value, unit = '°') => Number.isFinite(value) ? `${Math.round(value)}${unit}` : '—';
const displayTime = value => value?.replace('T', ' ');

function cachedWeather(city) {
  const data = weatherCache.get(city.id);
  return data && Date.now() - data.fetchedAt < WEATHER_MAX_AGE ? data : null;
}

function useWeather(city) {
  const refresh = useRef(null);
  const [state, setState] = useState(() => {
    const data = cachedWeather(city);
    return data ? { data, status: Date.now() - data.fetchedAt < WEATHER_TTL ? 'success' : 'loading', locked: true } : emptyWeather;
  });

  useEffect(() => {
    let active = true;
    let controller = null;
    let nextAttempt = 0;
    let timer;
    let unlockTimer;
    let expiryTimer;
    let timeout;
    const visible = () => document.visibilityState === 'visible';
    const foreground = () => visible() && document.hasFocus();
    const schedule = () => {
      clearTimeout(timer);
      if (foreground()) timer = setTimeout(check, Math.max(100, nextAttempt - Date.now()));
    };
    const trackExpiry = data => {
      clearTimeout(expiryTimer);
      if (data) expiryTimer = setTimeout(() => setState(old => old.data === data
        ? { ...old, data: null, status: old.status === 'stale' ? 'error' : old.status } : old),
      Math.max(0, data.fetchedAt + WEATHER_MAX_AGE - Date.now()));
    };
    const updateLock = () => {
      const delay = (manualRefreshAt.get(city.id) ?? 0) + 10000 - Date.now();
      setState(old => ({ ...old, locked: Boolean(controller) || delay > 0 }));
      clearTimeout(unlockTimer);
      if (delay > 0) unlockTimer = setTimeout(updateLock, delay);
    };

    async function request(force) {
      if (!active || !visible() || controller) return;
      const now = Date.now();
      if (force && now - (manualRefreshAt.get(city.id) ?? 0) < 10000) return;
      if (force) manualRefreshAt.set(city.id, now);
      const previous = cachedWeather(city);
      if (!force && previous && now - previous.fetchedAt < WEATHER_TTL) {
        nextAttempt = previous.fetchedAt + WEATHER_TTL;
        setState({ status: 'success', data: previous, locked: false });
        updateLock();
        trackExpiry(previous);
        schedule();
        return;
      }
      const pending = new AbortController();
      controller = pending;
      timeout = setTimeout(() => pending.abort(), 10000);
      setState({ status: 'loading', data: previous, locked: true });
      trackExpiry(previous);
      try {
        const data = await loadWeather(city, pending.signal);
        if (!active) return;
        if (pending.signal.aborted) throw new Error('weather_timeout');
        if (!(data.current && [data.current.temp, data.current.feels, data.current.code].some(value => value !== null)) &&
            !data.hourly.length && !data.daily.length) throw new Error('empty_weather');
        weatherCache.set(city.id, data);
        nextAttempt = data.fetchedAt + WEATHER_TTL;
        setState({ status: 'success', data, locked: true });
        trackExpiry(data);
      } catch (error) {
        if (!active) return;
        const fallback = cachedWeather(city);
        nextAttempt = Date.now() + WEATHER_TTL;
        setState({ status: fallback ? 'stale' : error.message === 'empty_weather' ? 'empty' : 'error', data: fallback, locked: true });
        trackExpiry(fallback);
      } finally {
        clearTimeout(timeout);
        controller = null;
        if (active) {
          updateLock();
          schedule();
        }
      }
    }

    function check() {
      if (!foreground()) {
        clearTimeout(timer);
        return;
      }
      if (Date.now() >= nextAttempt) void request(false);
      else schedule();
    }
    refresh.current = () => request(true);
    const start = setTimeout(() => {
      if (visible()) void request(false);
    }, 0);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    window.addEventListener('blur', check);
    window.addEventListener('online', check);
    return () => {
      active = false;
      refresh.current = null;
      controller?.abort();
      [start, timer, unlockTimer, expiryTimer, timeout].forEach(clearTimeout);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.removeEventListener('blur', check);
      window.removeEventListener('online', check);
    };
  }, [city]);

  return { ...state, refresh: () => refresh.current?.() };
}

function WeatherSymbol({ code, day }) {
  const [description, icon] = weatherCondition(code, day);
  return <span role="img" aria-label={description}>{icon}</span>;
}

function DailyForecast({ rows }) {
  const ranges = rows.filter(({ low, high }) => low !== null && high !== null);
  const min = Math.min(...ranges.map(row => row.low));
  const max = Math.max(...ranges.map(row => row.high));
  const span = max - min;
  return <div className="destination-daily">
    <h4>7일 예보</h4>
    {rows.length < 7 && <p>{rows.length ? '일부 날짜의 예보가 제공되지 않습니다.' : '표시할 일별 예보가 없습니다.'}</p>}
    <ul>{rows.map(row => <li key={row.time}>
      <time dateTime={row.time}>{row.time}</time>
      <WeatherSymbol code={row.code} />
      <span aria-label={`최저 ${temp(row.low, '도')}`}>{temp(row.low)}</span>
      <span className="destination-range" aria-hidden="true">
        {row.low !== null && row.high !== null && <i style={{
          left: `${span ? 96 * (row.low - min) / span : 48}%`,
          width: `${span ? 4 + 96 * (row.high - row.low) / span : 4}%`,
        }} />}
      </span>
      <span aria-label={`최고 ${temp(row.high, '도')}`}>{temp(row.high)}</span>
    </li>)}</ul>
  </div>;
}

function WeatherCard({ city, weather, epoch }) {
  const { data, status, locked, refresh } = weather;
  const now = localWeatherTime(epoch, city.zone);
  const daily = data?.daily.filter(row => row.time >= now.slice(0, 10)) ?? [];
  const hourly = data?.hourly.filter(row => row.time >= now).slice(0, 12) ?? [];
  const today = daily.find(row => row.time === now.slice(0, 10));
  const [condition, icon] = weatherCondition(data?.current?.code, data?.current?.day);
  return (
    <section className="destination-weather" aria-label={`${city.name} 날씨`}>
      <div className="destination-weather-inner">
        <div className="destination-weather-top">
          <div>
            <h3>{city.name} 날씨</h3>
            {data && <>
              <p className="destination-temp" aria-label={temp(data.current?.temp, '도')}>{temp(data.current?.temp, '°C')}</p>
              <p>{condition}</p>
              <p>체감 {temp(data.current?.feels)} · 최고 {temp(today?.high)} · 최저 {temp(today?.low)}</p>
            </>}
          </div>
          {data && <span className="destination-weather-icon" aria-hidden="true">{icon}</span>}
        </div>
        <div className="destination-weather-status" role="status">
          {status === 'loading' && (data ? '갱신 중' : '날씨를 불러오는 중입니다.')}
          {status === 'stale' && '지난 데이터 · 최신 날씨를 불러오지 못했습니다.'}
          {status === 'error' && '날씨를 불러오지 못했습니다. 다시 시도해 주세요.'}
          {status === 'empty' && '표시할 날씨 정보가 없습니다.'}
        </div>
        {status === 'loading' && !data && <div className="destination-skeleton" aria-hidden="true" />}
        {data && <>
          <h4>시간대별 예보</h4>
          {hourly.length ? <ul className="destination-hourly" tabIndex={0} aria-label="시간대별 예보 스크롤">
            {hourly.map(row => <li key={row.time}>
              <time dateTime={row.time}>{displayTime(row.time)}</time>
              <WeatherSymbol code={row.code} day={row.day} />
              <span aria-label={temp(row.temp, '도')}>{temp(row.temp)}</span>
              {row.rain !== null && <small aria-label={`강수확률 ${row.rain}%`}>💧 {row.rain}%</small>}
            </li>)}
          </ul> : <p>표시할 시간대별 예보가 없습니다.</p>}
          <DailyForecast rows={daily} />
        </>}
      </div>
      <footer className="destination-weather-footer">
        <div>
          날씨 제공: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>
          {' · '}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
          {data && <small>
            {data.current && <>기준 {displayTime(data.current.time)} · </>}
            갱신 {displayTime(localWeatherTime(data.fetchedAt, city.zone))} (현지 시각)
          </small>}
        </div>
        <button type="button" onClick={refresh} disabled={locked}>{status === 'error' || status === 'empty' ? '다시 시도' : '↻ 새로고침'}</button>
      </footer>
    </section>
  );
}

function useRegionCards(tripId, city) {
  const [result, setResult] = useState({ status: 'loading', cards: [] });
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ section: 'info', city: city.id });
    fetch(`/api/trips/${encodeURIComponent(tripId)}?${params}`, {
      signal: controller.signal, credentials: 'same-origin', cache: 'no-store',
    }).then(async response => {
      if (!response.ok) throw new Error('region_unavailable');
      const body = await response.json();
      if (!Array.isArray(body.cards)) throw new Error('invalid_region_data');
      if (!controller.signal.aborted) setResult({ status: body.configured ? 'success' : 'unconfigured', cards: body.cards });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ status: 'error', cards: [] });
    });
    return () => controller.abort();
  }, [tripId, city]);
  return result;
}

function ClothingGuide({ city, calendar, result, weather }) {
  const clothing = result.cards.find(card => card.category === '지역 특징')?.clothing;
  const { days, pendingFrom } = travelForecastDays(calendar, weather.data?.daily ?? []);
  const hasForecast = days.some(day => day.forecast);
  const failed = weather.status === 'error' || weather.status === 'stale';

  return <section className="travel-reader-card destination-region-card destination-clothing" aria-label={`${city.name} 옷차림 가이드`}>
    <h3>{city.name} 옷차림 가이드</h3>
    <p>{clothing || {
      loading: 'Notion에서 옷차림을 불러오는 중입니다.',
      error: 'Notion 옷차림 정보를 불러오지 못했습니다.',
      unconfigured: 'Notion 여행지 정보가 아직 연결되지 않았습니다.',
    }[result.status] || 'Notion에 등록된 추천 옷차림이 없습니다.'}</p>

    <h4>여행 기간 중 {city.name} 예보</h4>
    {!calendar.start || !calendar.end ? <p>여행 날짜가 등록되면 날짜별 예보를 표시합니다.</p> :
      calendar.end < calendar.today ? <p>여행이 종료되었습니다.</p> :
      !days.length ? <p>여행 날짜의 예보는 아직 제공되지 않습니다.</p> :
      weather.status === 'loading' && !weather.data ? <p role="status">여행 날짜의 예보를 불러오는 중입니다.</p> :
      !hasForecast && failed ? <p>여행 날짜의 예보를 불러오지 못했습니다.</p> :
      <>
        {weather.status === 'stale' && <p>마지막으로 불러온 예보입니다.</p>}
        <ul className="destination-clothing-days">
          {days.map(({ date, forecast }) => <li key={date}>
            <time dateTime={date}>{date}</time>
            {forecast ? <span>
              최저 {temp(forecast.low, '°C')} · 최고 {temp(forecast.high, '°C')}
              {' · '}최대 강수확률 {forecast.rain === null ? '—' : `${forecast.rain}%`}
            </span> : <span>예보 대기</span>}
          </li>)}
          {pendingFrom && <li>
            <span><time dateTime={pendingFrom}>{pendingFrom}</time>
              {pendingFrom !== calendar.end && <> ~ <time dateTime={calendar.end}>{calendar.end}</time></>}</span>
            <span>예보 대기</span>
          </li>}
        </ul>
      </>}
    {failed && <button type="button" onClick={weather.refresh} disabled={weather.locked}>예보 다시 시도</button>}
  </section>;
}

function RegionCards({ result }) {
  return <section className="destination-region" aria-label="알아두면 좋은 지역 정보">
    <h3>알아두면 좋은 지역 정보</h3>
    <p>Notion에 저장된 내용만 표시 · 자동 갱신하지 않음</p>
    {result.status === 'loading' && <p role="status">지역 정보를 불러오는 중입니다.</p>}
    {result.status === 'error' && <p role="status">지역 정보를 불러오지 못했습니다. 나중에 다시 확인해 주세요.</p>}
    {result.status === 'unconfigured' && <p role="status">Notion 여행지 정보가 아직 연결되지 않았습니다.</p>}
    <div className="destination-region-grid" aria-busy={result.status === 'loading'}>
      {INFO_CATEGORIES.map(category => {
        const card = result.cards.find(item => item.category === category);
        return <article key={category} className="travel-reader-card destination-region-card">
          <div className="destination-region-heading">
            <h4>{category}</h4>
            {card?.text && <span className="destination-info-badge" data-status={card.status}>{card.status}</span>}
          </div>
          {result.status === 'loading' ? <div className="destination-skeleton" aria-hidden="true" /> :
            result.status === 'error' ? null : <p>{card?.duplicate ? '중복된 항목이 있어 표시할 수 없습니다.' : card?.text || '등록된 지역 정보가 없습니다.'}</p>}
          {card?.partial && <small>일부 본문은 표시되지 않습니다.</small>}
          {card?.text && <footer>
            <span>{card.date ? <>확인: <time dateTime={card.date}>{card.date}</time></> : '확인일 미등록'}</span>
            {card.url && <a href={card.url} target="_blank" rel="noreferrer">{card.source || '출처 보기'}</a>}
          </footer>}
        </article>;
      })}
    </div>
  </section>;
}

function CityInformation({ city, trip, now }) {
  const weather = useWeather(city);
  const result = useRegionCards(trip.id, city);
  const calendar = tripCalendar(trip, now);
  return <>
    <WeatherCard city={city} weather={weather} epoch={now} />
    <ClothingGuide city={city} calendar={calendar} result={result} weather={weather} />
    <RegionCards result={result} />
  </>;
}

export default function DestinationInfoTab({ trip, now }) {
  const cities = citiesForTrip(trip.id);
  const [cityId, setCityId] = useState(cities[0]?.id);
  const city = cities.find(item => item.id === cityId) ?? cities[0];
  return <section className="travel-section destination-info" aria-label="도시별 여행 정보">
    <header className="destination-info-heading">
      <div><h2>도시별 여행 정보</h2><p>여행지 날씨와 Notion에 저장된 지역 안내</p></div>
      {cities.length > 1 && <div role="group" aria-label="여행 도시 선택" className="destination-city-switch">
        {cities.map(option => <button key={option.id} type="button" aria-pressed={option.id === city.id}
          onClick={() => setCityId(option.id)}>{option.name}</button>)}
      </div>}
    </header>
    {city ? <CityInformation key={`${trip.id}:${city.id}`} city={city} trip={trip} now={now} />
      : <p className="travel-empty">이 여행에는 아직 등록된 도시가 없습니다.</p>}
  </section>;
}
