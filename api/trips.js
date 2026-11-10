import { handleTrips } from '../server/notion-trips.js';

export default function handler(req, res) {
  return handleTrips(req, res);
}
