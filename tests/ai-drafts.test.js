import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createLocalRepository} from '../src/data/local-repository.js';
import {createRequire} from 'node:module';
const {memoryStore}=createRequire(import.meta.url)('./helpers/cloud-memory.cjs');
const {handleRequest}=createRequire(import.meta.url)('../backend/api.cjs');
const d=await import('../src/domain/ai-drafts.js').catch(()=>({}));
const now='2026-10-07T01:00:00.000Z';
const input=petId=>({petId,type:'weight',occurredDate:'2026-10-06',value:4.6,unit:'kg',title:'体重记录',note:''});
const opts=()=>{let n=0;return {indexedDB:new IDBFactory(),clock:()=>now,idFactory:()=>`x${++n}`};};
test('draft validation preserves unresolved fields and selected confirmation requires complete input',()=>{
 assert.equal(typeof d.validateRecordDraft,'function');
 const pets=[{id:'p',deletedAt:null}];const draft={draftId:'d',petId:'p',type:'weight',occurredDate:null,value:4.6,unit:'kg',title:'体重记录',note:'',nextDate:null,sourceText:'昨天称重4.6kg'};
 assert.deepEqual(d.validateRecordDraft(draft,{pets,today:'2026-10-07'}).missingFields,['occurredDate']);
 assert.throws(()=>d.toRecordInputs([draft],['d'],{pets,today:'2026-10-07'}),/补|日期/);
 const inputs=d.toRecordInputs([{...draft,occurredDate:'2026-10-06'}],['d'],{pets,today:'2026-10-07'});assert.equal(inputs[0].value,4.6);assert.equal(inputs[0].draftId,undefined);
 assert.deepEqual(d.toRecordInputs([draft],[],{pets,today:'2026-10-07'}),[]);
 assert.throws(()=>d.validateRecordDraft({...draft,petId:'foreign'},{pets,today:'2026-10-07'}),/宠物/);
});
test('local record batch is atomic and repeated intent returns receipt after reopen',async()=>{
 const options=opts(),repo=createLocalRepository(options),p=await repo.savePet({name:'咪',type:'cat'}),baseRevision=repo.getRevision();
 assert.equal(typeof repo.saveRecordBatch,'function');
 const before=await repo.snapshot();await assert.rejects(repo.saveRecordBatch([input(p.id),{...input(p.id),value:900}],{baseRevision,operationId:'bad'}));assert.deepEqual(await repo.snapshot(),before);
 const inputs=[input(p.id),{...input(p.id),type:'daily',value:null,unit:null,title:'玩耍',nextDate:'2026-10-09'}];const saved=await repo.saveRecordBatch(inputs,{baseRevision,operationId:'same'});assert.equal(saved.records.length,2);assert.equal(saved.reminders.length,1);
 const reopened=createLocalRepository(options);await reopened.snapshot();assert.deepEqual(await reopened.saveRecordBatch(inputs,{baseRevision,operationId:'same'}),saved);assert.equal((await reopened.snapshot()).records.length,2);
 await assert.rejects(reopened.saveRecordBatch([input(p.id)],{operationId:'same'}),/不同/);
 await assert.rejects(repo.saveRecordBatch(Array.from({length:6},()=>input(p.id)),{operationId:'six'}),/5|五/);
});
test('cloud batch uses owned transaction, atomic records and receipts',async()=>{
 const store=memoryStore();let n=0;const run=(user,action,payload,rev,key)=>handleRequest({version:1,action,payload,expectedRevision:rev,idempotencyKey:key},{principal:{userId:user,emailVerified:true,isAnonymous:false},store,clock:()=>now,idFactory:()=>`id${++n}`});
 const p=await run('A','pets.save',{name:'咪',type:'cat'},0,'pet');const bad=await run('A','records.saveBatch',{inputs:[input(p.data.id),{...input(p.data.id),value:900}]},1,'bad');assert.equal(bad.ok,false);
 assert.equal((await run('A','health.snapshot',{})).data.records.length,0);
 const payload={inputs:[input(p.data.id)]};const good=await run('A','records.saveBatch',payload,1,'batch');assert.equal(good.ok,true);assert.equal(good.data.records.length,1);assert.equal((await run('A','records.saveBatch',payload,1,'batch')).data.records[0].id,good.data.records[0].id);
 const foreign=await run('B','records.saveBatch',payload,0,'foreign');assert.equal(foreign.error.code,'FORBIDDEN');
});
test('demo batch keeps internal receipts out of snapshot and portable backup',async()=>{
 const {createDemoRepository}=await import('../src/data/demo-repository.js');const {memoryStorage}=await import('./fixtures/local-state.js');const storage=memoryStorage();let n=0;const options={storage,clock:()=>now,idFactory:()=>`demo${++n}`};const repo=createDemoRepository(options),p=(await repo.snapshot()).pets[0],before=await repo.snapshot();assert.equal(typeof repo.saveRecordBatch,'function');const batch=[input(p.id)];const saved=await repo.saveRecordBatch(batch,{operationId:'demo-op'});assert.equal((await repo.snapshot()).records.length,before.records.length+1);assert.deepEqual(await createDemoRepository(options).saveRecordBatch(batch,{operationId:'demo-op'}),saved);assert.equal((await repo.snapshot())._operationReceipts,undefined);assert.equal(JSON.parse(await repo.getRawBackup())._operationReceipts,undefined);await assert.rejects(repo.saveRecordBatch([{...input(p.id),value:6}],{operationId:'demo-op'}),/不同/);
});
test('explicit unresolved next reminder date must be filled or deliberately skipped',()=>{
 const pets=[{id:'p',deletedAt:null}],options={pets,today:'2026-10-07'},draft={draftId:'next',petId:'p',type:'deworm',occurredDate:'2026-10-07',value:null,unit:null,title:'驱虫',note:'',nextDate:null,missingFields:['nextDate'],sourceText:'今天驱虫，下个月再做'};
 assert.deepEqual(d.validateRecordDraft(draft,options).missingFields,['nextDate']);assert.throws(()=>d.toRecordInputs([draft],['next'],options),/补/);
 assert.equal(d.toRecordInputs([{...draft,nextDate:'2026-11-07'}],['next'],options)[0].nextDate,'2026-11-07');
 const skipped=d.toRecordInputs([{...draft,skipNextDate:true}],['next'],options)[0];assert.equal(skipped.nextDate,null);assert.equal(skipped.skipNextDate,undefined);
});
