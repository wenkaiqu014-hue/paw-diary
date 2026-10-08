/** Browser-owned installation capability; this controller never registers a worker. */
export function createInstallController({ window = globalThis.window, navigator = globalThis.navigator, onState = () => {} } = {}) {
  const media = window?.matchMedia?.('(display-mode: standalone)');
  let destroyed = false;
  let deferredPrompt = null;
  let state = media?.matches || navigator?.standalone === true ? 'installed' : 'manual';
  function setState(next) {
    if (destroyed || state === next) return;
    state = next;
    onState(state);
  }
  function installed() {
    deferredPrompt = null;
    setState('installed');
  }
  function beforeInstall(event) {
    if (destroyed || state === 'installed' || typeof event.prompt !== 'function') return;
    event.preventDefault();
    deferredPrompt = event;
    setState('prompt-ready');
  }
  function displayChanged() {
    if (media?.matches || navigator?.standalone === true) installed();
  }
  window?.addEventListener?.('beforeinstallprompt', beforeInstall);
  window?.addEventListener?.('appinstalled', installed);
  media?.addEventListener?.('change', displayChanged);
  return {
    getState: () => state,
    async requestInstall() {
      if (destroyed || !deferredPrompt || state === 'installed') return state;
      // Consume before awaiting: browsers allow each event to prompt once.
      const event = deferredPrompt;
      deferredPrompt = null;
      setState('manual');
      try {
        await event.prompt();
        await event.userChoice;
        // Acceptance is a choice, not proof of completed OS installation.
        displayChanged();
      } catch {
        // The permanent manual instructions remain available after browser refusal.
      }
      return state;
    },
    destroy() {
      destroyed = true;
      deferredPrompt = null;
      window?.removeEventListener?.('beforeinstallprompt', beforeInstall);
      window?.removeEventListener?.('appinstalled', installed);
      media?.removeEventListener?.('change', displayChanged);
    },
  };
}
