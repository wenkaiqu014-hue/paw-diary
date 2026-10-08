import test from 'node:test';
import assert from 'node:assert/strict';
import { createTourState, advanceTour } from '../src/domain/tour.js';
import { TOUR_STEPS } from '../src/data/tour-steps.js';

test('six fixed selectors preserve the health journey', () => {
  assert.deepEqual(TOUR_STEPS.map(step => step.id), ['workspace','pets','record','reminders','recap','community-nav']);
  for (const step of TOUR_STEPS) assert.equal(step.selector, `[data-tour="${step.id}"]`);
});
test('six next actions complete and repeated terminal events are inert', () => {
  let state = createTourState();
  assert.deepEqual(state, { phase: 'idle', index: 0, count: 6 });
  state = advanceTour(state, 'START');
  assert.equal(advanceTour(state, 'START'), state);
  for (let i=0; i<6; i++) {
    assert.equal(state.index, i);
    state = advanceTour(state, 'NEXT');
  }
  assert.equal(state.phase, 'completed');
  for (const event of ['NEXT','SKIP','ABORT']) assert.equal(advanceTour(state,event), state);
});
test('every step is skippable, abort never records completion, idle next is inert', () => {
  assert.equal(advanceTour(createTourState(),'NEXT').phase, 'idle');
  for (let i=0; i<6; i++) {
    let state = advanceTour(createTourState(),'START');
    for (let j=0; j<i; j++) state = advanceTour(state,'NEXT');
    assert.equal(advanceTour(state,'SKIP').phase,'skipped');
    assert.equal(advanceTour(state,'ABORT').phase,'aborted');
  }
});
