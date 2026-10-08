import { createTourState, advanceTour } from '../domain/tour.js';
import { TOUR_STEPS } from '../data/tour-steps.js';
import { positionTourPopover } from '../ui/tour-position.js';
let tourSequence = 0;

/** No repository writes: Root owns routing, input guards and preference persistence. */
export function mountGuidedTour({ document, t, getLocale = () => 'zh', getIdentity = () => 'guest',
  isBlocked = () => false, captureView = () => ({}), enterHome = () => {}, restoreView = () => {}, onStatus = () => {} }) {
  const win = document.defaultView;
  const maskId = `guided-tour-mask-${++tourSequence}`;
  let state = createTourState(TOUR_STEPS.length);
  let destroyed = false, generation = 0, pending = false, frame = 0;
  let dialog = null, card, title, body, progress, next, skip, hole, shade;
  let identity, captured, focusBefore, observedTarget = null, observer = null, waiting = null, waitTimer = 0;
  let restorePending = Promise.resolve();
  const locale = () => String(getLocale()).startsWith('en') ? 'en' : 'zh';
  const text = (key, fallback) => {
    const translated = typeof t === 'function' ? t(key) : null;
    return typeof translated === 'string' && translated && translated !== key ? translated : fallback[locale()];
  };
  const viewport = () => {
    const visual = win.visualViewport;
    return { left: visual?.offsetLeft || 0, top: visual?.offsetTop || 0,
      width: visual?.width || win.innerWidth, height: visual?.height || win.innerHeight };
  };
  const active = () => !destroyed && state.phase === 'running' && dialog?.open;
  function clearWait() {
    waiting?.disconnect(); waiting = null;
    if (waitTimer) win.clearTimeout(waitTimer);
    waitTimer = 0;
  }
  function locate() {
    return [...document.querySelectorAll(TOUR_STEPS[state.index].selector)]
      .find(el => el.isConnected && el.getClientRects().length && win.getComputedStyle(el).visibility !== 'hidden') || null;
  }
  function watchTarget(target) {
    if (target === observedTarget) return;
    observer?.disconnect(); observedTarget = target;
    if (target) observer?.observe(target);
  }
  function draw() {
    if (!active()) return;
    const step = TOUR_STEPS[state.index];
    title.textContent = text(step.titleKey, step.title);
    body.textContent = text(step.bodyKey, step.body);
    progress.textContent = `${state.index + 1} / ${state.count}`;
    next.textContent = text('tour.next', { zh: '下一步', en: 'Next' });
    skip.textContent = text('tour.skip', { zh: '跳过指引', en: 'Skip guide' });
    dialog.lang = locale() === 'en' ? 'en' : 'zh-CN';
    const view = viewport();
    card.style.width = `${Math.max(0, Math.min(360, view.width - 32))}px`;
    card.style.maxHeight = `${Math.max(0, view.height - 32)}px`;
    const target = locate();
    watchTarget(target);
    const rect = target?.getBoundingClientRect();
    const visible = rect && rect.bottom > view.top && rect.top < view.top + view.height &&
      rect.right > view.left && rect.left < view.left + view.width;
    // Invisible or missing targets still leave the same readable step and controls.
    const targetRect = visible ? {left:rect.left - 8, top:rect.top - 8, width:rect.width + 16, height:rect.height + 16} : null;
    const size = card.getBoundingClientRect();
    const point = positionTourPopover({ target: targetRect, viewport: view, card: size });
    card.style.left = `${point.left}px`; card.style.top = `${point.top}px`;
    card.dataset.placement = point.placement;
    shade.setAttribute('viewBox', `0 0 ${win.innerWidth} ${win.innerHeight}`);
    hole.setAttribute('x', String(targetRect?.left ?? 0));
    hole.setAttribute('y', String(targetRect?.top ?? 0));
    hole.setAttribute('width', String(targetRect?.width ?? 0));
    hole.setAttribute('height', String(targetRect?.height ?? 0));
  }
  function refresh() {
    if (!active() || frame) return;
    frame = win.requestAnimationFrame(() => { frame = 0; draw(); });
  }
  function scrollToTarget(target) {
    if (!target) return;
    const view = viewport(), rect = target.getBoundingClientRect();
    if (rect.top < view.top + 16 || rect.bottom > view.top + view.height - 16) {
      target.scrollIntoView({ block: 'center', inline: 'nearest',
        behavior: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }
  function showStep() {
    clearWait();
    // A synchronous step draw replaces, rather than loses, a queued old frame.
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    const target = locate();
    scrollToTarget(target);
    card.scrollTop = 0;
    draw();
    title.focus({ preventScroll: true });
    if (!target && win.MutationObserver) {
      const stepIndex = state.index;
      waiting = new win.MutationObserver(() => {
        if (!active() || state.index !== stepIndex) return;
        const found = locate();
        if (found) { clearWait(); scrollToTarget(found); refresh(); }
      });
      waiting.observe(document.body, { childList: true, subtree: true });
      waitTimer = win.setTimeout(() => { clearWait(); refresh(); }, 1500);
    }
  }
  function listen(add) {
    const method = add ? 'addEventListener' : 'removeEventListener';
    win[method]('scroll', refresh, true);
    win[method]('resize', refresh);
    win.visualViewport?.[method]('resize', refresh);
    win.visualViewport?.[method]('scroll', refresh);
  }
  function teardown(restore) {
    clearWait(); listen(false); observer?.disconnect(); observedTarget = null;
    if (frame) win.cancelAnimationFrame(frame); frame = 0;
    const before = focusBefore, snapshot = captured, actor = identity;
    const oldDialog = dialog;
    dialog = null;
    oldDialog?.close(); oldDialog?.remove();
    if (restore && actor === getIdentity()) {
      // Restoration can be async; guard the subsequent focus from newer sessions.
      const restoreGeneration = generation;
      try {
        restorePending = Promise.resolve(restoreView(snapshot)).catch(() => {}).then(() => {
          if (destroyed || generation !== restoreGeneration || actor !== getIdentity()) return;
          if (before?.isConnected && !before.closest('[inert]')) before.focus({ preventScroll: true });
        });
      } catch { restorePending = Promise.resolve(); }
    }
  }
  function finish(event) {
    if (!active()) return;
    state = advanceTour(state, event);
    if (state.phase === 'running') { showStep(); return; }
    const status = state.phase, actor = identity;
    generation++; teardown(true);
    if (status === 'completed' || status === 'skipped') onStatus(status, actor);
  }
  function buildDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'guided-tour';
    dialog.dataset.guidedTour = '';
    dialog.setAttribute('aria-labelledby', `${maskId}-title`);
    dialog.setAttribute('aria-describedby', `${maskId}-body`);
    // Only static authored markup is inserted; translations use textContent.
    dialog.innerHTML = `<svg class="guided-tour-shade" aria-hidden="true" preserveAspectRatio="none"><defs><mask id="${maskId}" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="white"/><rect class="guided-tour-spotlight" rx="12" fill="black"/></mask></defs><rect width="100%" height="100%" fill="rgba(15,30,22,.64)" mask="url(#${maskId})"/></svg><section class="guided-tour-card"><p class="guided-tour-progress" data-tour-progress aria-live="polite"></p><h2 class="guided-tour-title" id="${maskId}-title" tabindex="-1"></h2><p class="guided-tour-body" id="${maskId}-body"></p><div class="guided-tour-actions"><button type="button" class="guided-tour-next" data-tour-next></button><button type="button" class="guided-tour-skip" data-tour-skip></button></div></section>`;
    card = dialog.querySelector('.guided-tour-card'); title = dialog.querySelector('.guided-tour-title');
    body = dialog.querySelector('.guided-tour-body'); progress = dialog.querySelector('.guided-tour-progress');
    next = dialog.querySelector('.guided-tour-next'); skip = dialog.querySelector('.guided-tour-skip');
    hole = dialog.querySelector('.guided-tour-spotlight'); shade = dialog.querySelector('svg');
    next.addEventListener('click', () => finish('NEXT'));
    skip.addEventListener('click', () => finish('SKIP'));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish('SKIP'); });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey && (document.activeElement === next || document.activeElement === title)) {
        event.preventDefault(); skip.focus();
      } else if (!event.shiftKey && document.activeElement === skip) {
        event.preventDefault(); next.focus();
      }
    });
    // Clicks on the modal's transparent highlighter are consumed, not forwarded.
    dialog.addEventListener('click', event => { if (event.target === dialog) event.stopPropagation(); });
    document.body.append(dialog);
  }
  async function start({ source = 'manual' } = {}) {
    if (destroyed || pending) return 'blocked';
    if (active()) return 'started';
    if (!['automatic', 'manual'].includes(source) || isBlocked()) return 'blocked';
    const ticket = ++generation, actor = getIdentity();
    pending = true;
    try {
      await restorePending;
      if (destroyed || ticket !== generation || actor !== getIdentity() || isBlocked()) return 'blocked';
      const snapshot = captureView(), before = document.activeElement;
      await enterHome();
      if (destroyed || ticket !== generation || actor !== getIdentity() || isBlocked()) return 'blocked';
      identity = actor; captured = snapshot; focusBefore = before;
      state = advanceTour(createTourState(TOUR_STEPS.length), 'START');
      buildDialog();
      dialog.showModal();
      observer = win.ResizeObserver ? new win.ResizeObserver(refresh) : null;
      listen(true); showStep();
      return 'started';
    } catch {
      if (ticket === generation && dialog) { state = advanceTour(state, 'ABORT'); teardown(true); }
      return 'blocked';
    } finally { if (ticket === generation) pending = false; }
  }
  function stop({ reason = 'abort' } = {}) {
    generation++; pending = false;
    if (state.phase === 'running') state = advanceTour(state, 'ABORT');
    if (dialog) teardown(!['route', 'identity', 'pet', 'destroy'].includes(reason));
  }
  function destroy() {
    if (destroyed) return;
    stop({ reason: 'destroy' }); destroyed = true;
  }
  return { start, refresh, stop, destroy };
}
