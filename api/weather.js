import { cityForWeather } from '../src/destinationCities.js';
import { fetchWeatherForecast } from '../src/destinationWeather.js';

export async function handleWeather(req, res, fetcher = fetch) {
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
  const city = cityForWeather(params.get('city'));
  if (!city || params.size !== 1) return send(400, { error: 'invalid_city' });

  try {
    return send(200, await fetchWeatherForecast(city, AbortSignal.timeout(7000), fetcher));
  } catch (error) {
    console.warn('Weather forecast request failed', { city: city.id, reason: error.message, code: error.cause?.code });
    return send(502, { error: 'weather_unavailable' });
  }
}

export default function handler(req, res) {
  return handleWeather(req, res);
}
