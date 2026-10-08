import { isInteractionBlocked, isNewStableRelease } from '../domain/help-lifecycle.js';

const FOCUS_INTERVAL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const isStableRelease = release => release?.channel === 'stable' && typeof release.version === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(release.version);

/** Passive metadata detection. The caller performs one check after boot. */
export function createUpdateMonitor({ currentRelease, fetchImpl = globalThis.fetch, now = Date.now,
  getInteractionState = () => ({}), onUpdate = () => {}, reload = () => globalThis.window?.location?.reload(),
  baseUrl, window = globalThis.window } = {}) {
  let destroyed = false;
  let pendingRelease = null;
  let inFlight = null;
  let abortController = null;
  let lastCheck = -Infinity;
  let endpoint = null;
  try {
    const base = new URL(baseUrl ?? window?.location?.href);
    const origin = window?.location?.origin ?? new URL(window?.location?.href ?? base.href).origin;
    if (['http:', 'https:'].includes(base.protocol) && base.origin === origin) endpoint = new URL('./release.json', base);
  } catch {
    // An unavailable/invalid location cannot become a remote version source.
  }
  function check() {
    if (destroyed || !endpoint || typeof fetchImpl !== 'function') return Promise.resolve(null);
    if (inFlight) return inFlight;
    lastCheck = now();
    const controller = new AbortController();
    abortController = controller;
    let deadline;
    const cancelled = new Promise(resolve => {
      controller.signal.addEventListener('abort', () => resolve(null), { once: true });
      deadline = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    });
    const response = (async () => {
      try {
        const result = await fetchImpl(endpoint.href, {
          cache: 'no-store', credentials: 'omit', mode: 'same-origin', redirect: 'error', signal: controller.signal,
        });
        if (destroyed || controller.signal.aborted || !result?.ok) return null;
        // fetch may follow redirects; never treat another origin as our release.
        if (result.url && new URL(result.url, endpoint).origin !== endpoint.origin) return null;
        const remote = await result.json();
        if (destroyed || controller.signal.aborted || !isStableRelease(currentRelease) || !isStableRelease(remote)) return null;
        return remote;
      } catch {
        return null;
      }
    })();
    inFlight = Promise.race([response, cancelled]).then(remote => {
      if (destroyed || controller.signal.aborted || !remote) return null;
      if (!isNewStableRelease(currentRelease, remote)) {
        // A successful legal release can withdraw an earlier upgrade. Network
        // failures and malformed/preview metadata never reach this branch.
        if (pendingRelease) {
          pendingRelease = null;
          onUpdate(null);
        }
        return null;
      }
      if (!pendingRelease || isNewStableRelease(pendingRelease, remote)) {
        pendingRelease = remote;
        onUpdate(remote);
      }
      return remote;
    }).finally(() => {
      clearTimeout(deadline);
      if (abortController === controller) abortController = null;
      inFlight = null;
    });
    return inFlight;
  }
  function onFocus() {
    if (!destroyed && now() - lastCheck >= FOCUS_INTERVAL_MS) void check();
  }
  window?.addEventListener?.('focus', onFocus);
  return {
    check,
    requestReload() {
      if (destroyed || !pendingRelease) return 'none';
      // Re-read immediately at the click: no prior clean-state result is trusted.
      if (isInteractionBlocked(getInteractionState())) return 'blocked';
      reload();
      return 'reloaded';
    },
    destroy() {
      destroyed = true;
      pendingRelease = null;
      window?.removeEventListener?.('focus', onFocus);
      abortController?.abort();
    },
  };
}
