import { CityError, loadCities } from '../server/notion-cities.js';
import { fetchWeatherForecast } from '../src/destinationWeather.js';

export async function handleWeather(req, res, fetcher = fetch, env = process.env) {
  const send = (status, data) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (status === 200) res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    res.end(JSON.stringify(data));
  };
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(405, { error: 'method_not_allowed' });
  }

  const params = new URL(req.url, 'http://localhost').searchParams;
  const code = params.get('city');
  if (params.size !== 1 || !/^[A-Z]{2}_[A-Z0-9_]+$/.test(code ?? '')) return send(400, { error: 'invalid_city' });

  try {
    const cities = await loadCities(env, fetcher, AbortSignal.timeout(7000));
    const city = cities.find(city => city.id === code);
    if (!city) return send(404, { error: 'city_not_found' });
    return send(200, await fetchWeatherForecast(city, AbortSignal.timeout(7000), fetcher));
  } catch (error) {
    if (error instanceof CityError) return send(error.status, { error: error.code });
    console.warn('Weather forecast request failed', { city: code, reason: error.message, code: error.cause?.code });
    return send(502, { error: 'weather_unavailable' });
  }
}

export default function handler(req, res) {
  return handleWeather(req, res);
}
