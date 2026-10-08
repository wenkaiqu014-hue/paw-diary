import test from 'node:test';
import assert from 'node:assert/strict';
import { positionTourPopover } from '../src/ui/tour-position.js';

for (const width of [360,390,768,1440]) test(`popover remains within ${width}px visual viewport`, () => {
  for (const height of [280,600,900]) for (const target of [null,{left:0,top:0,width:140,height:44},{left:width-20,top:height-20,width:200,height:120}]) {
    const viewport = {left:12,top:30,width,height};
    const card={width:Math.min(360,width-32),height:Math.min(240,height-32)};
    const point=positionTourPopover({target,viewport,card});
    assert.ok(point.left>=viewport.left+16);
    assert.ok(point.top>=viewport.top+16);
    assert.ok(point.left+card.width<=viewport.left+width-16+0.001);
    assert.ok(point.top+card.height<=viewport.top+height-16+0.001);
    if (!target) assert.equal(point.placement,'center');
  }
});
test('prefer below, flip above and center when neither side fits', () => {
  const viewport={left:0,top:0,width:390,height:600};
  const card={width:300,height:200};
  assert.equal(positionTourPopover({target:{left:30,top:30,width:60,height:40},viewport,card}).placement,'bottom');
  assert.equal(positionTourPopover({target:{left:30,top:520,width:60,height:40},viewport,card}).placement,'top');
  assert.equal(positionTourPopover({target:{left:30,top:150,width:60,height:300},viewport,card}).placement,'center');
});
