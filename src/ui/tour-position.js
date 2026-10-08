const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
/** Card dimensions are measured after setting its viewport-constrained CSS size. */
export function positionTourPopover({ target = null, viewport, card, gap = 12, inset = 16 }) {
  const minLeft = viewport.left + inset;
  const minTop = viewport.top + inset;
  const maxLeft = viewport.left + viewport.width - inset - card.width;
  const maxTop = viewport.top + viewport.height - inset - card.height;
  let placement = 'center';
  let left = viewport.left + (viewport.width - card.width) / 2;
  let top = viewport.top + (viewport.height - card.height) / 2;
  if (target) {
    left = target.left + (target.width - card.width) / 2;
    const below = target.top + target.height + gap;
    const above = target.top - gap - card.height;
    if (below >= minTop && below <= maxTop) { top = below; placement = 'bottom'; }
    else if (above >= minTop && above <= maxTop) { top = above; placement = 'top'; }
  }
  return { left: clamp(left, minLeft, maxLeft), top: clamp(top, minTop, maxTop), placement };
}
