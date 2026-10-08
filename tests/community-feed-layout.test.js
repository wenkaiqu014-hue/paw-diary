import test from 'node:test';
import assert from 'node:assert/strict';
import { masonryPlacements, avoidSingletonTail } from '../src/ui/community-feed-layout.js';

test('masonry places each next item in shortest column without changing source order', () => {
 const result = masonryPlacements([300, 100, 140, 80], 2, 16);
 assert.deepEqual(result, [
  {column: 1, row: 1, span: 316}, {column: 2, row: 1, span: 116},
  {column: 2, row: 117, span: 156}, {column: 2, row: 273, span: 96},
 ]);
});
test('one column preserves reading order and measured image heights', () => {
 assert.deepEqual(masonryPlacements([49.2, 110], 1, 12), [{column: 1,row:1,span:62},{column:1,row:63,span:122}]);
});
test('display-only joining prevents a lone tail grapheme while preserving original content', () => {
 assert.equal(avoidSingletonTail('猫咪好！'), '猫咪好\u2060！');
 assert.equal(avoidSingletonTail('陪伴🐈'), '陪伴\u2060🐈');
 assert.equal(avoidSingletonTail('猫'), '猫');
});
