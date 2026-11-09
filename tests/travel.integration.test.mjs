import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { createServer } from 'vite';
import { useStore, computeCheckItems } from '../src/store.js';

test('Vite HTTP authentication and trip CRUD stay scoped across navigation', async t => {
  const password = randomBytes(18).toString('base64url');
  const salt = randomBytes(16);
  const originalFetch = globalThis.fetch;
  const auth = {
    ADMIN_PASSWORD_HASH: `${salt.toString('base64url')}:${scryptSync(password, salt, 64).toString('base64url')}`,
    SESSION_SECRET: randomBytes(48).toString('base64url'),
  };
  for (const [key, value] of Object.entries(auth)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null } });
  t.after(() => server.close());
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  let cookie = '';
  t.mock.method(globalThis, 'fetch', async (path, init) => {
    const response = await originalFetch(new URL(path, origin), {
      ...init, headers: { ...init?.headers, origin, cookie },
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return response;
  });

  const state = useStore.getState;
  const sample = state().trips[0];
  const actions = state();
  const trip = {
    name: 'New trip', startDate: '2026-12-01', endDate: '2026-12-02',
    budget: 2000, currency: 'JPY',
  };
  const fields = ['bookings', 'timeline', 'memos', 'places', 'budgetItems', 'expenses',
    'checks', 'addedChecks', 'editedChecks', 'deletedChecks', 'fxRate'];
  const snapshot = () => Object.fromEntries(fields.map(key => [key, state()[key]]));
  const sampleData = snapshot();

  actions.openTrip(sample.id);
  actions.addTrip(trip);
  actions.addBooking({ title: 'Unauthorized' });
  actions.deleteTrip(sample.id);
  actions.addExpense({ amount: 1 });
  actions.addTimelineEvent(1, { title: 'Unauthorized', time: '00:00' });
  actions.deleteCheckItem('sample');
  assert.equal(state().trips.length, 1);
  assert.deepEqual(snapshot(), sampleData);

  actions.requireLogin('create');
  assert.equal(await actions.login('incorrect'), false);
  assert.equal(state().loggedIn, false);
  assert.equal(await actions.login(password), true);
  assert.equal(state().overlay, 'create');
  const status = await originalFetch(`${origin}/api/auth`, { headers: { cookie } });
  assert.deepEqual(await status.json(), { authenticated: true });

  actions.addTrip(trip);
  const newId = state().trips.at(-1).id;
  actions.startEditEvent(1, state().timeline[0].events[0]);
  const lateLogin = actions.login(password);
  actions.openTrip(newId);
  assert.equal(await lateLogin, true);
  assert.equal(state().overlay, null);
  assert.equal(state().editingEvent, null);
  for (const key of ['bookings', 'memos', 'places', 'budgetItems', 'expenses']) {
    assert.deepEqual(state()[key], [], key);
  }
  assert.deepEqual(state().timeline.map(day => day.events), [[], []]);

  actions.addBooking({ title: 'New reservation' });
  actions.addTimelineEvent(1, { title: 'New event', time: '12:00' });
  const eventId = state().timeline[0].events[0].id;
  actions.updateTimelineEvent(1, eventId, { title: 'Updated event' });
  actions.addBudgetItem({ amount: 2000, currency: 'JPY' });
  actions.updateBudgetItem(state().budgetItems[0].id, { amount: 2500 });
  actions.addExpense({ amount: 300, currency: 'JPY' });
  actions.updateExpense(state().expenses[0].id, { amount: 400 });
  actions.setFxRate(9.4);
  actions.setAddCheckCat('예약');
  actions.setAddCheckText('Pack');
  actions.submitAddCheck();
  const checkId = state().addedChecks['예약'][0].id;
  actions.toggleCheck(checkId);
  actions.editCheckItem(checkId, 'Packed');
  const otherData = snapshot();

  actions.openTrip(sample.id);
  assert.deepEqual(snapshot(), sampleData);
  actions.openTrip(newId);
  assert.deepEqual(snapshot(), otherData);
  const { checks, addedChecks, deletedChecks, editedChecks, checkTemplate } = state();
  assert.equal(computeCheckItems(checks, addedChecks, deletedChecks, editedChecks, checkTemplate)['예약'][0].checked, true);

  actions.deleteTimelineEvent(1, eventId);
  actions.deleteBudgetItem(state().budgetItems[0].id);
  actions.deleteExpense(state().expenses[0].id);
  actions.deleteCheckItem(checkId);
  assert.equal(state().timeline[0].events.length, 0);
  assert.deepEqual(state().budgetItems, []);
  assert.deepEqual(state().expenses, []);
  assert.equal(state().deletedChecks[checkId], true);
  actions.deleteTrip(newId);
  assert.equal(state().screen, 'home');
  assert.equal(state().currentTripId, sample.id);
  assert.deepEqual(snapshot(), sampleData);
  assert.equal(state().tripDataById[newId], undefined);
  assert.equal(await actions.logout(), true);
  assert.match(cookie, /=$/);
  assert.equal(state().loggedIn, false);
});

test('client rejects static HTML and unauthenticated JSON with a successful HTTP status', async t => {
  const auth = t.mock.method(globalThis, 'fetch');
  auth.mock.mockImplementationOnce(() => new Response('<html></html>'));
  await assert.rejects(useStore.getState().login('password'), /응답 형식/);
  auth.mock.mockImplementationOnce(() => Response.json({ authenticated: false }));
  await assert.rejects(useStore.getState().login('password'), /응답 형식/);
  assert.equal(useStore.getState().loggedIn, false);
});
