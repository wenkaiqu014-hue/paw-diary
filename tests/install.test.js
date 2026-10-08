import test from 'node:test';
import assert from 'node:assert/strict';
let api = {};
try { api = await import('../src/features/install.js'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
function fixture({ standalone = false, iosStandalone = false } = {}) {
  assert.equal(typeof api.createInstallController, 'function', 'install controller must exist');
  const window = new EventTarget();
  const media = new EventTarget();
  media.matches = standalone;
  window.matchMedia = query => { assert.equal(query, '(display-mode: standalone)'); return media; };
  const states = [];
  const controller = api.createInstallController({ window, navigator: { standalone: iosStandalone }, onState: state => states.push(state) });
  return { window, media, states, controller };
}
function promptEvent(outcome = 'dismissed', prompt = async () => {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome });
  return event;
}
test('without a browser prompt event installation remains manual', async () => {
  const { controller } = fixture();
  assert.equal(controller.getState(), 'manual');
  await controller.requestInstall();
  assert.equal(controller.getState(), 'manual');
});
test('standalone display or Safari standalone reports installed', () => {
  for (const options of [{ standalone: true }, { iosStandalone: true }]) assert.equal(fixture(options).controller.getState(), 'installed');
});
test('actual event enables prompting only after user requests it', async () => {
  const { window, controller } = fixture();
  let calls = 0;
  const event = promptEvent('dismissed', async () => { calls++; });
  window.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(controller.getState(), 'prompt-ready');
  assert.equal(calls, 0);
  await controller.requestInstall();
  await controller.requestInstall();
  assert.equal(calls, 1);
  assert.equal(controller.getState(), 'manual');
});
test('accepted prompt alone waits for installed event to report installation', async () => {
  const { window, controller } = fixture();
  window.dispatchEvent(promptEvent('accepted'));
  await controller.requestInstall();
  assert.equal(controller.getState(), 'manual');
  window.dispatchEvent(new Event('appinstalled'));
  assert.equal(controller.getState(), 'installed');
});
test('concurrent requests consume a deferred event once', async () => {
  const { window, controller } = fixture();
  let calls = 0, finish;
  window.dispatchEvent(promptEvent('dismissed', () => { calls++; return new Promise(resolve => { finish = resolve; }); }));
  const first = controller.requestInstall();
  await controller.requestInstall();
  assert.equal(calls, 1);
  finish();
  await first;
});
test('failed browser prompt falls back to manual instructions', async () => {
  const { window, controller } = fixture();
  window.dispatchEvent(promptEvent('dismissed', async () => { throw new Error('browser refused'); }));
  await controller.requestInstall();
  assert.equal(controller.getState(), 'manual');
});
test('standalone media changes report installation and destroy removes listeners', async () => {
  const { window, media, states, controller } = fixture();
  media.matches = true;
  media.dispatchEvent(new Event('change'));
  assert.equal(controller.getState(), 'installed');
  const count = states.length;
  controller.destroy();
  window.dispatchEvent(promptEvent());
  media.matches = false;
  media.dispatchEvent(new Event('change'));
  await controller.requestInstall();
  assert.equal(states.length, count);
  assert.equal(controller.getState(), 'installed');
});
test('installed event wins over a late browser choice', async () => {
  const { window, controller } = fixture();
  let finish;
  window.dispatchEvent(promptEvent('dismissed', () => new Promise(resolve => { finish = resolve; })));
  const request = controller.requestInstall();
  window.dispatchEvent(new Event('appinstalled'));
  finish();
  await request;
  assert.equal(controller.getState(), 'installed');
});
