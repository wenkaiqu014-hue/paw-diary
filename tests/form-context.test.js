import test from 'node:test';
import assert from 'node:assert/strict';
import {captureFormContext,bindFormRepository} from '../src/ui/form-context.js';
test('opened form keeps its pet and original revision after background state changes',async()=>{
 let selected='A',generation=1,revision=3,saved;
 const repository={getRevision:()=>revision,saveRecord:async(input,options)=>{saved={input,options};return input;}};
 const context=captureFormContext({repository,getGeneration:()=>generation,petId:selected});
 selected='B';revision=4;
 await bindFormRepository(repository,context,()=>generation).saveRecord({petId:selected,type:'daily',title:'original'});
 assert.equal(saved.input.petId,'A');assert.equal(saved.options.baseRevision,3);
});
test('stale form generation never executes a mutation and retry preserves idempotency intent',async()=>{
 let generation=1,calls=0,keys=[];const repository={getRevision:()=>2,savePet:async(input,o)=>{calls++;keys.push(o.operationId);return input;}};
 const context=captureFormContext({repository,getGeneration:()=>generation,petId:'A'}),bound=bindFormRepository(repository,context,()=>generation);
 await bound.savePet({name:'A'});await bound.savePet({name:'A'});assert.equal(keys[0],keys[1]);
 await bound.savePet({name:'B'});assert.notEqual(keys[0],keys[2]);generation=2;
 await assert.rejects(bound.savePet({name:'B'}),e=>e.code==='WORKSPACE_CHANGED');assert.equal(calls,3);
});
