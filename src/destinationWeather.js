export const WEATHER_TTL = 30 * 60 * 1000;
export const WEATHER_MAX_AGE = 6 * 60 * 60 * 1000;

export function localWeatherTime(epoch, zone) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(epoch).map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;
const number = value => Number.isFinite(value) ? value : null;
const chance = value => Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;

function series(group, pattern, fields, max) {
  if (group == null) return [];
  if (!Array.isArray(group.time) || group.time.length > max || group.time.some((time, i) =>
    typeof time !== 'string' || !pattern.test(time) || (i && time <= group.time[i - 1]))) {
    throw new Error('invalid_weather_series');
  }
  for (const [name] of Object.values(fields)) {
    if (group[name] != null && (!Array.isArray(group[name]) || group[name].length !== group.time.length)) {
      throw new Error('invalid_weather_series');
    }
  }
  return group.time.map((time, i) => ({
    time,
    ...Object.fromEntries(Object.entries(fields).map(([key, [name, parse]]) => [key, parse(group[name]?.[i])])),
  }));
}

export function normalizeWeather(data, city, fetchedAt) {
  if (!data || data.utc_offset_seconds !== 28800) throw new Error('invalid_weather_timezone');
  const now = localWeatherTime(fetchedAt, city.zone);
  const today = now.slice(0, 10);
  const current = data.current;
  // Compare timestamps in the provider's civil time, without parsing in the browser's local zone.
  const skew = typeof current?.time === 'string' && timePattern.test(current.time)
    ? Date.parse(now + 'Z') - Date.parse(current.time + 'Z') : NaN;
  const observed = Number.isFinite(skew) && skew >= -15 * 60000 && skew <= 2 * 3600000
    ? { time: current.time, temp: number(current.temperature_2m), feels: number(current.apparent_temperature),
      code: number(current.weather_code), day: number(current.is_day) } : null;
  if (current != null && !observed) throw new Error('invalid_weather_observation');
  const hourly = series(data.hourly, timePattern, {
    temp: ['temperature_2m', number], code: ['weather_code', number],
    rain: ['precipitation_probability', chance], day: ['is_day', number],
  }, 168).filter(slot => slot.time >= now && (slot.temp !== null || slot.code !== null || slot.rain !== null));
  const last = new Date(Date.parse(today + 'T00:00:00Z') + 6 * 86400000).toISOString().slice(0, 10);
  const daily = series(data.daily, datePattern, {
    low: ['temperature_2m_min', number], high: ['temperature_2m_max', number], code: ['weather_code', number],
  }, 7).filter(slot => slot.time >= today && slot.time <= last &&
    (slot.low !== null || slot.high !== null || slot.code !== null));
  if (daily.some(({ low, high }) => low !== null && high !== null && low > high)) throw new Error('invalid_weather_range');
  return { current: observed, hourly, daily, fetchedAt };
}

export async function loadWeather(city, signal, fetcher = fetch) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: city.latitude, longitude: city.longitude, timezone: city.zone, forecast_days: '7',
    temperature_unit: 'celsius', current: 'temperature_2m,apparent_temperature,weather_code,is_day',
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
  }).toString();
  const response = await fetcher(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('weather_unavailable');
  return normalizeWeather(await response.json(), city, Date.now());
}

export function weatherCondition(code, day) {
  if (code === 0) return ['맑음', day === 0 ? '🌙' : '☀️'];
  if (code === 1 || code === 2) return [code === 1 ? '대체로 맑음' : '구름 조금', day === 0 ? '☁️' : '🌤️'];
  if (code === 3) return ['흐림', '☁️'];
  if ([45, 48].includes(code)) return ['안개', '🌫️'];
  if ([51, 53, 55, 56, 57].includes(code)) return ['이슬비', '🌦️'];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['비', '🌧️'];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ['눈', '🌨️'];
  if ([95, 96, 99].includes(code)) return ['뇌우', '⛈️'];
  return ['날씨 정보 없음', '—'];
}
