export function routeTileConfig(env = {}) {
  const template = env.VITE_ROUTE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const name = env.VITE_ROUTE_TILE_ATTRIBUTION || '© OpenStreetMap contributors';
  const link = env.VITE_ROUTE_TILE_ATTRIBUTION_URL || 'https://www.openstreetmap.org/copyright';
  try {
    const url = new URL(template.replaceAll('{z}', '0').replaceAll('{x}', '0').replaceAll('{y}', '0'));
    const attribution = new URL(link);
    if (!['{z}', '{x}', '{y}'].every(part => template.includes(part)) || url.protocol !== 'https:' ||
        url.username || url.password || attribution.protocol !== 'https:' || attribution.username || attribution.password) return null;
    return { template, name, link: attribution.href };
  } catch { return null; }
}
