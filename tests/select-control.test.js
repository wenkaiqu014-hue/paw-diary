import test from 'node:test';import assert from 'node:assert/strict';
let select;try{select=await import('../src/ui/select-control.js');}catch{}
test('shared select exposes native enhancement and independent mount',()=>{assert.equal(typeof select?.enhanceSelect,'function');assert.equal(typeof select?.mountSelect,'function');});
test('keyboard navigation skips disabled rows and wraps',()=>{assert.equal(typeof select?.nextEnabledOption,'function');const options=[{value:'a'},{value:'b',disabled:true},{value:'c'}];assert.equal(select.nextEnabledOption(options,0,1),2);assert.equal(select.nextEnabledOption(options,2,1),0);assert.equal(select.nextEnabledOption(options,0,-1),2);assert.equal(select.nextEnabledOption([{disabled:true}],0,1),-1);});
