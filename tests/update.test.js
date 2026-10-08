import test from 'node:test';
import assert from 'node:assert/strict';
let api = {};
try { api = await import('../src/features/update.js'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const current = { version: '0.9.0', channel: 'stable' };
const newer = { version: '0.10.0', channel: 'stable', buildId: 'new-build' };
function fixture(options = {}) {
  assert.equal(typeof api.createUpdateMonitor, 'function', 'update monitor must exist');
  let clock = 1000, interaction = {}, reloads = 0;
  const window = new EventTarget();
  window.location = { href: 'https://example.test/paw-diary/#health', origin: 'https://example.test' };
  const calls = [], updates = [];
  const monitor = api.createUpdateMonitor({ currentRelease: current, window, baseUrl: window.location.href, now: () => clock,
    fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => newer }; },
    getInteractionState: () => interaction, onUpdate: value => updates.push(value), reload: () => { reloads++; }, ...options });
  return { monitor, window, calls, updates, advance: value => { clock += value; }, setInteraction: value => { interaction = value; }, reloads: () => reloads };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('explicit boot check fetches relative same-origin metadata with fresh anonymous settings', async () => {
  const { monitor, calls, updates } = fixture();
  assert.equal(calls.length, 0);
  assert.deepEqual(await monitor.check(), newer);
  assert.equal(calls[0].url, 'https://example.test/paw-diary/release.json');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.mode, 'same-origin');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.signal instanceof AbortSignal, true);
  assert.deepEqual(updates, [newer]);
  monitor.destroy();
});
test('invalid preview prerelease same version or rollback never becomes an update', async () => {
  for (const remote of [null, {}, { version: 'broken', channel: 'stable' }, { version: '0.10.0-beta', channel: 'stable' }, { version: '0.10.0', channel: 'preview' }, current, { version: '0.8.0', channel: 'stable' }]) {
    const { monitor, updates } = fixture({ fetchImpl: async () => ({ ok: true, json: async () => remote }) });
    assert.equal(await monitor.check(), null);
    assert.deepEqual(updates, []);
    assert.equal(monitor.requestReload(), 'none');
    monitor.destroy();
  }
});
test('cross-origin base and redirected responses are refused', async () => {
  let calls = 0;
  const cross = fixture({ baseUrl: 'https://other.test/paw-diary/', fetchImpl: async () => { calls++; } });
  assert.equal(await cross.monitor.check(), null);
  assert.equal(calls, 0);
  cross.monitor.destroy();
  const redirected = fixture({ fetchImpl: async () => ({ ok: true, url: 'https://other.test/release.json', json: async () => newer }) });
  assert.equal(await redirected.monitor.check(), null);
  redirected.monitor.destroy();
});
test('network HTTP and JSON failures silently preserve the running release', async () => {
  for (const fetchImpl of [async () => { throw new Error('offline'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => { throw new Error('invalid json'); } })]) {
    const { monitor, updates } = fixture({ fetchImpl });
    assert.equal(await monitor.check(), null);
    assert.deepEqual(updates, []);
    monitor.destroy();
  }
});
test('five second deadline aborts even a fetch implementation that ignores cancellation', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const { monitor, updates } = fixture({ fetchImpl: (_url, options) => { signal = options.signal; return new Promise(() => {}); } });
  const pending = monitor.check();
  context.mock.timers.tick(5000);
  assert.equal(await pending, null);
  assert.equal(signal.aborted, true);
  assert.deepEqual(updates, []);
  monitor.destroy();
});
test('focus checks are limited to five minutes without background polling', async () => {
  const { monitor, window, calls, advance } = fixture();
  await monitor.check();
  window.dispatchEvent(new Event('focus'));
  await flush();
  assert.equal(calls.length, 1);
  advance(299999);
  window.dispatchEvent(new Event('focus'));
  await flush();
  assert.equal(calls.length, 1);
  advance(1);
  window.dispatchEvent(new Event('focus'));
  await flush();
  assert.equal(calls.length, 2);
  monitor.destroy();
  advance(300000);
  window.dispatchEvent(new Event('focus'));
  await flush();
  assert.equal(calls.length, 2);
});
test('repeated identical metadata notifies once and concurrent checks share one request', async () => {
  let finish, count = 0;
  const { monitor, updates } = fixture({ fetchImpl: async () => { count++; return new Promise(resolve => { finish = resolve; }); } });
  const first = monitor.check(), second = monitor.check();
  assert.equal(count, 1);
  finish({ ok: true, json: async () => newer });
  assert.deepEqual(await first, newer);
  assert.deepEqual(await second, newer);
  const repeat = monitor.check();
  finish({ ok: true, json: async () => newer });
  await repeat;
  assert.deepEqual(updates, [newer]);
  monitor.destroy();
});
test('all business interaction blockers preserve pending update and never reload', async () => {
  const { monitor, setInteraction, reloads, window } = fixture();
  assert.equal(monitor.requestReload(), 'none');
  await monitor.check();
  for (const key of ['dialogOpen', 'dirty', 'saving', 'aiSaving', 'publicDirty', 'publicSaving', 'photoDirty', 'photoSaving', 'transitioning']) {
    setInteraction({ [key]: true });
    assert.equal(monitor.requestReload(), 'blocked', key);
    assert.equal(reloads(), 0);
  }
  setInteraction({});
  assert.equal(monitor.requestReload(), 'reloaded');
  assert.equal(reloads(), 1);
  assert.equal(window.location.href, 'https://example.test/paw-diary/#health');
  monitor.destroy();
});
test('destroy aborts outstanding work and never notifies from late metadata', async () => {
  let finish, signal;
  const { monitor, updates } = fixture({ fetchImpl: (_url, init) => { signal = init.signal; return new Promise(resolve => { finish = resolve; }); } });
  const pending = monitor.check();
  monitor.destroy();
  assert.equal(signal.aborted, true);
  finish({ ok: true, json: async () => newer });
  assert.equal(await pending, null);
  assert.deepEqual(updates, []);
  assert.equal(monitor.requestReload(), 'none');
  assert.equal(await monitor.check(), null);
});
test('timeout also covers a stalled JSON body', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { monitor } = fixture({ fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  const pending = monitor.check();
  await Promise.resolve();
  context.mock.timers.tick(5000);
  assert.equal(await pending, null);
  monitor.destroy();
});
test('successful stable rollback to the running version withdraws a previous update', async () => {
  let remote = newer;
  const { monitor, updates, reloads } = fixture({ fetchImpl: async () => ({ ok: true, json: async () => remote }) });
  await monitor.check();
  remote = current;
  assert.equal(await monitor.check(), null);
  assert.deepEqual(updates, [newer, null]);
  assert.equal(monitor.requestReload(), 'none');
  assert.equal(reloads(), 0);
  monitor.destroy();
});
test('successful stable rollback below the running release also withdraws a previous update', async () => {
  let remote = newer;
  const { monitor, updates } = fixture({ fetchImpl: async () => ({ ok: true, json: async () => remote }) });
  await monitor.check();
  remote = { version: '0.8.0', channel: 'stable' };
  assert.equal(await monitor.check(), null);
  assert.deepEqual(updates, [newer, null]);
  assert.equal(monitor.requestReload(), 'none');
  monitor.destroy();
});
test('network JSON invalid stable or preview metadata cannot withdraw a detected update', async () => {
  for (const failure of [async () => { throw new Error('offline'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => { throw new Error('invalid json'); } }), ...[null, {}, {version:'0.9.0-beta',channel:'stable'}, {version:'00.9.0',channel:'stable'}, {version:'0.9.0',channel:'preview'}].map(remote => async () => ({ok:true,json:async()=>remote}))]) {
    let request = async () => ({ok:true,json:async()=>newer});
    const { monitor, updates } = fixture({fetchImpl:(...args)=>request(...args)});
    await monitor.check();
    request = failure;
    assert.equal(await monitor.check(), null);
    assert.deepEqual(updates, [newer]);
    assert.equal(monitor.requestReload(), 'reloaded');
    monitor.destroy();
  }
});
