const zone = 'Asia/Shanghai';
const cities = {
  MO_MACAU: { id: 'MO_MACAU', name: '마카오', latitude: 22.1987, longitude: 113.5439, zone },
  CN_GUANGZHOU: { id: 'CN_GUANGZHOU', name: '광저우', latitude: 23.1291, longitude: 113.2644, zone },
  CN_SHANGHAI: { id: 'CN_SHANGHAI', name: '상하이', latitude: 31.2304, longitude: 121.4737, zone },
};
const trips = new Map([
  ['4136d8c5-8de1-81f4-a070-e07878964af0', [cities.MO_MACAU, cities.CN_GUANGZHOU]],
  ['4136d8c5-8de1-81ce-a4c8-dbda8e993076', [cities.CN_SHANGHAI]],
]);

export const citiesForTrip = tripId => trips.get(tripId) ?? [];
export const cityForWeather = id => Object.hasOwn(cities, id) ? cities[id] : null;
export const INFO_CATEGORIES = ['지역 특징', '주요 교통', '주의사항', '여행 팁'];
