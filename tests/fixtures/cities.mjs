export const citySource = '41e6d8c5-8de1-81f4-a824-000b11c7a3c6';
export const cityEnv = { NOTION_TRAVEL_TOKEN: 'city-test-token', NOTION_TRAVEL_CITIES_SOURCE_ID: citySource };
export const text = value => ({ type: 'rich_text', rich_text: [{ plain_text: value }] });
export const relation = (...ids) => ({ type: 'relation', has_more: false, relation: ids.map(id => ({ id })) });
export function cityPage(code, name, zone, latitude, longitude, id) {
  return {
    object: 'page', id, parent: { type: 'data_source_id', data_source_id: citySource },
    properties: {
      도시명: { type: 'title', title: [{ plain_text: name }] }, '도시 코드': text(code),
      '국가 코드': text(code.slice(0, 2)), 시간대: text(zone),
      위도: { type: 'number', number: latitude }, 경도: { type: 'number', number: longitude },
      활성: { type: 'checkbox', checkbox: true },
    },
  };
}
export const cityFixtures = [
  cityPage('KR_MOKPO', '목포', 'Asia/Seoul', 34.8118, 126.3922, '41e6d8c5-8de1-8199-b259-d3eadc6bf4c3'),
  cityPage('KR_BUSAN', '부산', 'Asia/Seoul', 35.1796, 129.0756, '41e6d8c5-8de1-8121-93c9-c83abeef99ee'),
  cityPage('MO_MACAU', '마카오', 'Asia/Macau', 22.1987, 113.5439, '41e6d8c5-8de1-8143-ae35-dd0bb204ec15'),
  cityPage('CN_GUANGZHOU', '광저우', 'Asia/Shanghai', 23.1291, 113.2644, '41e6d8c5-8de1-8162-a2e6-f954af4d63eb'),
  cityPage('CN_SHANGHAI', '상하이', 'Asia/Shanghai', 31.2304, 121.4737, '41e6d8c5-8de1-81e1-a4f2-e7853c1bc88b'),
];
export const cityList = (results, cursor = null) => Response.json({ results, has_more: cursor !== null, next_cursor: cursor });
