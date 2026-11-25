export function safeScheduleMapUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const google = ['google.com', 'www.google.com'].includes(url.hostname) && /^\/maps(?:\/|$)/.test(url.pathname);
    return google || ['maps.google.com', 'maps.app.goo.gl', 'maps.apple.com', 'map.naver.com', 'map.kakao.com'].includes(url.hostname)
      ? url.href : null;
  } catch { return null; }
}

export function safeScheduleSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.notion.so' && /^\/[a-f\d]{32}$/.test(url.pathname) && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}
