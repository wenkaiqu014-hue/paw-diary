const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = text => segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);

export function avoidSingletonTail(text) {
 const parts = graphemes(text);
 return parts.length < 2 ? text : `${parts.slice(0, -2).join('')}${parts.at(-2)}\u2060${parts.at(-1)}`;
}

// One pixel grid tracks avoid quantization gaps while source nodes never move.
export function masonryPlacements(heights, columns, gap) {
 const bottoms = Array(Math.max(1, columns)).fill(0);
 return heights.map(height => {
  const shortest = Math.min(...bottoms), column = bottoms.indexOf(shortest);
  const span = Math.max(1, Math.ceil(height + gap));
  const placement = { column: column + 1, row: shortest + 1, span };
  bottoms[column] += span;
  return placement;
 });
}

function lineGroups(node) {
 const text = node.firstChild;
 if (!text || text.nodeType !== 3) return [];
 const range = node.ownerDocument.createRange(), lines = [];
 let offset = 0;
 for (const part of graphemes(text.textContent)) {
  range.setStart(text, offset); offset += part.length; range.setEnd(text, offset);
  const rect = range.getBoundingClientRect();
  // Word joiners have no painted width and must not count as a tail character.
  if (rect.width < .1 || part === '\u2060') continue;
  let line = lines.find(item => Math.abs(item.top - rect.top) < 2);
  if (!line) { line = { top: rect.top, parts: [] }; lines.push(line); }
  line.parts.push(part);
 }
 return lines;
}

function fitTitle(node) {
 const source = node.dataset.fullTitle ?? node.textContent;
 if (!node.hasAttribute('data-full-title')) node.dataset.fullTitle = source;
 const parts = graphemes(source);
 node.textContent = source;
 if (parts.length <= 1 || node.getBoundingClientRect().width <= 0) return;
 let lines = lineGroups(node);
 if (lines.length <= 2) {
  if (lines.length === 2 && lines[1].parts.length === 1) node.textContent = avoidSingletonTail(source);
  return;
 }
 // Only the displayed prefix changes; accessible labels and stored titles stay full.
 let low = 1, high = parts.length - 1, best = '';
 while (low <= high) {
  const count = Math.floor((low + high) / 2);
  const candidate = `${parts.slice(0, count).join('').trimEnd()}…`;
  node.textContent = candidate;
  lines = lineGroups(node);
  if (lines.length <= 2) { best = candidate; low = count + 1; } else high = count - 1;
 }
 node.textContent = best || `${parts[0]}…`;
 lines = lineGroups(node);
 if (lines.length === 2 && lines[1].parts.length === 1) node.textContent = avoidSingletonTail(node.textContent);
}

export function mountCommunityFeedLayout({ feed }) {
 const win = feed.ownerDocument.defaultView;
 const observed = new Set(), sizes = new WeakMap();
 let frame = 0, destroyed = false, feedWidth = -1;
 const schedule = () => {
  if (!destroyed && !frame) frame = win.requestAnimationFrame(layout);
 };
 const observer = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(entries => {
  let changed = false;
  for (const entry of entries) {
   const { width, height } = entry.contentRect;
   if (entry.target === feed) {
    if (Math.abs(width - feedWidth) > .5) { feedWidth = width; changed = true; }
   } else {
    const prior = sizes.get(entry.target);
    if (!prior || Math.abs(prior.width - width) > .5 || Math.abs(prior.height - height) > .5) {
     sizes.set(entry.target, { width, height }); changed = true;
    }
   }
  }
  if (changed) schedule();
 }) : null;
 function layout() {
  frame = 0;
  if (destroyed || !feed.isConnected) return;
  const cards = Array.from(feed.children).filter(card => card.classList.contains('community-card'));
  // Clear stale desktop columns before measuring a narrower responsive grid.
  for (const card of cards) { card.style.gridColumn = ''; card.style.gridRow = ''; }
  const style = win.getComputedStyle(feed);
  const columns = Math.max(1, style.gridTemplateColumns.split(/\s+/).filter(Boolean).length);
  const gap = Number.parseFloat(style.columnGap) || 0;
  // Empty/loading states also need enough grid tracks for their natural content.
  for (const child of feed.children) if (!child.classList.contains('community-card')) {
   child.style.gridColumn = '1 / -1';
   child.style.gridRow = `1 / span ${Math.max(1, Math.ceil(child.getBoundingClientRect().height))}`;
  }
  // Remove placements from detached cards and observe new intrinsic image/card sizes.
  for (const card of observed) if (!cards.includes(card)) { observer?.unobserve(card); observed.delete(card); }
  for (const card of cards) {
   const title = card.querySelector('.community-title-text');
   if (title) fitTitle(title);
   if (!observed.has(card)) { observed.add(card); observer?.observe(card); }
  }
  const placements = masonryPlacements(cards.map(card => card.getBoundingClientRect().height), columns, gap);
  cards.forEach((card, index) => {
   const {column, row, span} = placements[index];
   const gridRow = `${row} / span ${span}`;
   if (card.style.gridColumn !== String(column)) card.style.gridColumn = String(column);
   if (card.style.gridRow !== gridRow) card.style.gridRow = gridRow;
  });
 }
 observer?.observe(feed);
 feed.addEventListener('load', schedule, true);
 feed.addEventListener('error', schedule, true);
 win.addEventListener('resize', schedule);
 feed.ownerDocument.fonts?.ready.then(schedule);
 schedule();
 return { refresh: schedule, destroy() {
  destroyed = true;
  if (frame) win.cancelAnimationFrame(frame);
  observer?.disconnect(); observed.clear();
  feed.removeEventListener('load', schedule, true);
  feed.removeEventListener('error', schedule, true);
  win.removeEventListener('resize', schedule);
 } };
}
