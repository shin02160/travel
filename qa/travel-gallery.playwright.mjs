async page => {
  const ids = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`);
  const trip = (i, title, status, time) => ({
    id: ids[i], title, fields: { 상태: status, 여행기간: time }
  });
  const completed = trip(0, '종료 부산', '완료', '2026-11-14');
  const trips = [completed, trip(1, '늦은 준비', '준비중', '2027-03-01'),
    trip(2, '진행 여행', '여행중', '2026-11-17'), trip(3, '빠른 준비', '준비중', '2026-12-01')];
  const titles = ['공연장', '벡스코 입구', '저녁 식사', '숙소', '이동 중', '실패 이미지'];
  const photos = titles.map((title, i) => ({
    id: String(i), title, type: i < 2 ? '공연' : '기타',
    shotAt: '2026-11-14', place: '부산 센텀시티', description: '상세 사진 설명',
    src: `/fixture-gallery-${i}.jpg`
  }));
  const check = (condition, label) => { if (!condition) throw new Error(label); };
  let locked = true;
  let calls = 0;
  let failList = false;
  let fixture = photos;
  await page.route('**/fixture-gallery-*.jpg', route => route.request().url().endsWith('5.jpg')
    ? route.fulfill({ status: 404, body: '' })
    : route.fulfill({ path: route.request().url().endsWith('2.jpg') ? 'public/destination-shanghai.jpg' : 'public/destination-guangzhou.jpg' }));
  await page.route('**/api/trips**', async route => {
    const url = route.request().url();
    if (url.endsWith('/api/trips')) return route.fulfill({ json: { trips } });
    if (route.request().method() === 'POST') {
      locked = false;
      return route.fulfill({ json: { unlocked: true } });
    }
    if (locked) return route.fulfill({ status: 401, json: { error: 'trip_pin_required' } });
    const expiresAt = Math.floor(Date.now() / 1000) + 1800;
    if (url.endsWith('?section=photos')) {
      calls++;
      if (failList) return route.fulfill({ status: 502, json: { error: 'notion_unavailable' } });
      return route.fulfill({ json: { expiresAt, photos: fixture, coverId: fixture[0]?.id, configured: true } });
    }
    const sections = Object.fromEntries(['schedule', 'bookings', 'budgets', 'expenses', 'receipts', 'checklist', 'shopping'].map(name => [name, []]));
    return route.fulfill({ json: { expiresAt, trip: completed, sections } });
  });
  await page.setViewportSize({ width: 1280, height: 1080 });
  await page.goto('http://127.0.0.1:4179/');
  const cards = page.locator('.travel-trip-copy h3 button');
  await cards.first().waitFor();
  check((await cards.allTextContents()).join('|') === '진행 여행|빠른 준비|늦은 준비|종료 부산', 'Main trip list order');
  await cards.last().click();
  const pin = page.locator('input');
  await pin.waitFor();
  check(calls === 0, 'Gallery must not load before PIN');
  await pin.fill('0427');
  await pin.press('Enter');
  await page.getByRole('button', { name: '사진', exact: true }).click();
  const item = page.getByRole('button', { name: '벡스코 입구, 2번째 사진 보기' });
  await item.waitFor();
  check(await page.getByText('총 6장').isVisible(), 'Gallery count');
  check(await page.getByRole('button', { name: /공연장, 1번째/ }).count() === 1, 'Featured image is not duplicated');
  const columns = () => page.locator('ul.travel-photo-grid')
    .evaluate(el => globalThis.getComputedStyle(el).gridTemplateColumns.split(' ').length);
  check(await columns() === 4, 'Four desktop columns');
  await page.screenshot({ path: '.playwright-cli/gallery-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 800, height: 900 });
  check(await columns() === 3, 'Three tablet columns');
  await page.setViewportSize({ width: 390, height: 850 });
  check(await columns() === 2, 'Two mobile columns');
  await page.screenshot({ path: '.playwright-cli/gallery-mobile.png', fullPage: true });
  await item.click();
  const dialog = page.getByRole('dialog', { name: '벡스코 입구' });
  await dialog.waitFor();
  const focusedLabel = () => page.evaluate(() => globalThis.document.activeElement.getAttribute('aria-label'));
  check(await focusedLabel() === '닫기', 'Focus enters dialog');
  check(await page.evaluate(() => globalThis.document.body.style.overflow) === 'hidden', 'Background scrolling locked');
  await page.keyboard.press('Shift+Tab');
  check(await focusedLabel() === '다음 사진', 'Reverse focus wraps inside dialog');
  await page.keyboard.press('Tab');
  check(await focusedLabel() === '닫기', 'Forward focus wraps inside dialog');
  check(await dialog.getByText('상세 사진 설명').isVisible(), 'Photo description');
  await page.keyboard.press('ArrowRight');
  await page.getByRole('dialog', { name: '저녁 식사' }).waitFor();
  await page.getByRole('button', { name: '이전 사진' }).click();
  await dialog.waitFor();
  await page.screenshot({ path: '.playwright-cli/gallery-lightbox.png' });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  check(await focusedLabel() === '벡스코 입구, 2번째 사진 보기', 'Focus returns to opener');
  await page.getByRole('button', { name: '공연', exact: true }).click();
  check(await page.locator('ul.travel-photo-grid li').count() === 2, 'Type filter');
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.getByRole('button', { name: /실패 이미지/ }).scrollIntoViewIfNeeded();
  await page.getByText('사진을 표시할 수 없습니다.').waitFor();
  failList = true;
  await page.getByRole('button', { name: '새로고침' }).click();
  await page.getByText('사진을 불러오지 못했습니다.').waitFor();
  fixture = [];
  failList = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.getByText(/아직 등록된 여행 사진이 없습니다/).waitFor();
  fixture = photos.slice(0, 1);
  await page.getByRole('button', { name: '새로고침' }).click();
  await page.getByRole('button', { name: /공연장, 1번째/ }).click();
  check(await page.getByRole('dialog').isVisible(), 'Single photo opens');
  check(await page.getByRole('button', { name: '이전 사진' }).count() === 0, 'Single photo has no navigation controls');
  return 'Gallery fixture passed: PIN, list order, breakpoints, keyboard, filters, failure, retry, empty and single-photo states';
}
