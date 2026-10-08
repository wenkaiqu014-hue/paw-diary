/** Guide state is UI only: aborts are never acknowledgement or completion. */
export function createTourState(count = 6) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('Tour count must be positive');
  return { phase: 'idle', index: 0, count };
}
export function advanceTour(state, event) {
  if (state.phase === 'idle') return event === 'START' ? { ...state, phase: 'running' } : state;
  if (state.phase !== 'running') return state;
  if (event === 'NEXT') return state.index + 1 === state.count
    ? { ...state, phase: 'completed' }
    : { ...state, index: state.index + 1 };
  if (event === 'SKIP') return { ...state, phase: 'skipped' };
  if (event === 'ABORT') return { ...state, phase: 'aborted' };
  return state;
}
