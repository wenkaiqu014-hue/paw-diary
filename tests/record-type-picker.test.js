import test from 'node:test';import assert from 'node:assert/strict';
let picker;try{picker=await import('../src/ui/record-type-picker.js');}catch{}
test('record selector exposes shared enhancement for live catalog management',()=>assert.equal(typeof picker?.enhanceRecordTypeSelect,'function'));
