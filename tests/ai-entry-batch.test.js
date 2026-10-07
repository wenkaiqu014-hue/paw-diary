import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createRequire} from 'node:module';
import {createLocalRepository} from '../src/data/local-repository.js';
import {createDemoRepository} from '../src/data/demo-repository.js';
import {memoryStorage} from './fixtures/local-state.js';
const domain=await import('../src/domain/ai-drafts.js');
const require=createRequire(import.meta.url),{handleRequest}=require('../backend/api.cjs'),{memoryStore}=require('./helpers/cloud-memory.cjs'),{parseRecords}=require('../backend/ai/record-parser.cjs');
const today='2026-10-07',now=today+'T07:00:00.000Z';
const draft=(purpose,extras={})=>({draftId:purpose,petId:'p',purpose,type:'daily',title:'散步',note:'',occurredDate:today,dueDate:'2026-10-08',...extras});
const entries=petId=>[{draftId:'record',purpose:'record',input:{petId,type:'weight',value:4.6,unit:'kg',occurredDate:today,title:''}},{draftId:'plan',purpose:'plan',input:{petId,recordType:'daily',dueDate:'2026-10-08',title:'散步'}}];
test('entry drafts separate record dates and plan dates with health defaults from type',()=>{
 assert.equal(typeof domain.validateEntryDraft,'function');
 assert.equal(domain.validateEntryDraft(draft('plan'),{pets:[{id:'p',deletedAt:null}],today}).includeInHealth,false);
 assert.equal(domain.validateEntryDraft(draft('plan',{type:'vaccine'}),{pets:[{id:'p',deletedAt:null}],today}).includeInHealth,true);
 const selected=domain.toEntryInputs([draft('record'),draft('plan')],['record','plan'],{pets:[{id:'p',deletedAt:null}],today});
 assert.equal(selected[0].input.nextDate,undefined);assert.equal(selected[1].input.recordType,'daily');assert.equal(selected[1].input.occurredDate,undefined);
 assert.throws(()=>domain.toEntryInputs([draft('plan',{dueDate:null})],['plan'],{pets:[{id:'p',deletedAt:null}],today}),/补/);
});
test('mixed local batch is atomic, idempotent across reopen, and forbids future record or hidden next plan',async()=>{
 let n=0;const options={indexedDB:new IDBFactory(),clock:()=>now,idFactory:()=>`x${++n}`},repo=createLocalRepository(options),pet=await repo.savePet({name:'咪',type:'cat'}),baseRevision=repo.getRevision();
 assert.equal(typeof repo.saveEntryBatch,'function');const before=await repo.snapshot(),batch=entries(pet.id);
 await assert.rejects(repo.saveEntryBatch([batch[0],{...batch[1],input:{...batch[1].input,dueDate:null}}],{operationId:'bad',baseRevision}));assert.deepEqual(await repo.snapshot(),before);
 const saved=await repo.saveEntryBatch(batch,{operationId:'mixed',baseRevision});assert.equal(saved.records.length,1);assert.equal(saved.reminders.length,1);assert.equal(saved.reminders[0].includeInHealth,false);assert.equal(saved.entries[1].entityId,saved.reminders[0].id);
 const reopened=createLocalRepository(options);await reopened.snapshot();assert.deepEqual(await reopened.saveEntryBatch(batch,{operationId:'mixed',baseRevision}),saved);await assert.rejects(reopened.saveEntryBatch([batch[0]],{operationId:'mixed'}),/不同/);
 await assert.rejects(repo.saveEntryBatch([{...batch[0],input:{...batch[0].input,occurredDate:'2026-10-09'}}],{operationId:'future'}));
 await assert.rejects(repo.saveEntryBatch([{...batch[0],input:{...batch[0].input,nextDate:'2026-11-09'}}],{operationId:'implicit'}));
});
test('mixed cloud batch owns both parent types and rolls back invalid custom type then returns same receipt',async()=>{
 const store=memoryStore();let n=0;const run=(user,action,payload,rev,key)=>handleRequest({version:1,action,payload,expectedRevision:rev,idempotencyKey:key},{principal:{userId:user,emailVerified:true,isAnonymous:false},store,clock:()=>now,idFactory:()=>`id${++n}`});
 const pet=(await run('A','pets.save',{name:'咪',type:'cat'},0,'pet')).data,batch=entries(pet.id);
 const foreign=await run('B','entries.saveBatch',{entries:batch},0,'foreign');assert.equal(foreign.error.code,'FORBIDDEN');
 const bad=await run('A','entries.saveBatch',{entries:[batch[0],{draftId:'x',purpose:'plan',input:{petId:pet.id,recordType:'other',typeLabel:'假类型',dueDate:today,title:'计划'}}]},1,'bad');assert.equal(bad.ok,false);assert.equal((await run('A','health.snapshot',{})).data.records.length,0);
 const good=await run('A','entries.saveBatch',{entries:batch},1,'same');assert.equal(good.ok,true);assert.equal(good.data.records.length,1);assert.equal(good.data.reminders.length,1);assert.deepEqual((await run('A','entries.saveBatch',{entries:batch},1,'same')).data,good.data);
});
test('demo mixed batch retains receipt and checks CAS without portable receipt leakage',async()=>{
 let n=0;const options={storage:memoryStorage(),clock:()=>now,idFactory:()=>`mixed-demo-${++n}`},repo=createDemoRepository(options),pet=(await repo.snapshot()).pets[0];assert.equal(typeof repo.saveEntryBatch,'function');
 const batch=entries(pet.id),baseRevision=repo.getRevision(),saved=await repo.saveEntryBatch(batch,{operationId:'mix',baseRevision});assert.deepEqual(await createDemoRepository(options).saveEntryBatch(batch,{operationId:'mix',baseRevision}),saved);assert.equal(JSON.parse(await repo.getRawBackup())._operationReceipts,undefined);
 await assert.rejects(repo.saveEntryBatch(batch,{operationId:'stale',baseRevision}),/另一窗口更新/);
});
test('custom entry metadata is catalog authority and unknown proposed type remains unresolved',async()=>{
 let n=0;const repo=createLocalRepository({indexedDB:new IDBFactory(),clock:()=>now,idFactory:()=>`c${++n}`}),pet=await repo.savePet({name:'咪',type:'cat'});const catalog=await repo.manageRecordTypes({action:'add',name:'梳毛',iconKey:'paw'}),custom=catalog.custom[0];
 const saved=await repo.saveEntryBatch([{draftId:'custom',purpose:'plan',input:{petId:pet.id,recordType:'other',customTypeId:custom.id,typeLabel:'伪造',iconKey:'drop',title:'梳毛',dueDate:today}}]);assert.equal(saved.reminders[0].typeLabel,'梳毛');assert.equal(saved.reminders[0].iconKey,'paw');
 const unresolved=domain.validateEntryDraft(draft('record',{type:'other',typeLabel:'新类型'}),{pets:[{id:'p',deletedAt:null}],today,catalog});assert.equal(unresolved.type,null);assert.equal(unresolved.suggestedTypeLabel,'新类型');assert.ok(unresolved.missingFields.includes('type'));
});
test('parser extracts mixed purpose per draft, separates ambiguous next care, and ignores model health advice',async()=>{
 const pets=[{id:'p',name:'咪',deletedAt:null}],model={complete:async()=>({content:JSON.stringify({drafts:[{petId:'p',purpose:'record',type:'deworm',occurredDate:today,title:'驱虫',sourceText:'今天驱虫了'},{petId:'p',purpose:'plan',type:'daily',dueDate:'2026-10-08',title:'散步',sourceText:'明天散步',includeInHealth:true}]})})};
 const parsed=await parseRecords({text:'今天驱虫了，明天散步',pets,activePetId:'p',today},model);assert.deepEqual(parsed.drafts.map(d=>d.purpose),['record','plan']);assert.equal(parsed.drafts[1].includeInHealth,false);
 const vague=await parseRecords({text:'今天驱虫了，下个月再做',pets,activePetId:'p',today},{complete:async()=>({content:JSON.stringify({drafts:[{petId:'p',purpose:'record',type:'deworm',occurredDate:today,title:'驱虫',sourceText:'今天驱虫了'}]})})});assert.equal(vague.drafts.length,2);assert.equal(vague.drafts[1].purpose,'plan');assert.equal(vague.drafts[1].dueDate,null);assert.ok(vague.drafts[1].missingFields.includes('dueDate'));
});
test('parser does not turn vague or missing dates into exact model invented dates',async()=>{
 const pets=[{id:'p',name:'咪',deletedAt:null}],out=await parseRecords({text:'梳毛了，下个月驱虫',pets,activePetId:'p',today},{complete:async()=>({content:JSON.stringify({drafts:[{purpose:'record',petId:'p',type:'daily',occurredDate:today,title:'梳毛',sourceText:'梳毛了'},{purpose:'plan',petId:'p',type:'deworm',dueDate:'2026-11-07',title:'驱虫',sourceText:'下个月驱虫'}]})})});
 assert.equal(out.drafts[0].occurredDate,null);assert.ok(out.drafts[0].missingFields.includes('occurredDate'));assert.equal(out.drafts[1].dueDate,null);assert.ok(out.drafts[1].missingFields.includes('dueDate'));
});
test('plan value injection and deleted custom catalog cannot bypass atomic confirmation',async()=>{
 let n=0;const repo=createLocalRepository({indexedDB:new IDBFactory(),clock:()=>now,idFactory:()=>`guard${++n}`}),pet=await repo.savePet({name:'咪',type:'cat'}),custom=(await repo.manageRecordTypes({action:'add',name:'梳毛',iconKey:'paw'})).custom[0];
 await repo.manageRecordTypes({action:'delete',ids:[custom.id]});const before=await repo.snapshot();await assert.rejects(repo.saveEntryBatch([{draftId:'gone',purpose:'plan',input:{petId:pet.id,recordType:'other',typeLabel:'梳毛',customTypeId:custom.id,title:'梳毛',dueDate:today}}]),/已有/);assert.deepEqual(await repo.snapshot(),before);
 await assert.rejects(repo.saveEntryBatch([{draftId:'weight',purpose:'plan',input:{petId:pet.id,recordType:'weight',title:'称重',dueDate:today,value:5}}]),/未来体重/);assert.deepEqual(await repo.snapshot(),before);
});
test('parser binds explicitly named event source to its actual pet rather than a different model ID',async()=>{
 const pets=[{id:'a',name:'小白',deletedAt:null},{id:'b',name:'小黑',deletedAt:null}],out=await parseRecords({text:'小白今天驱虫，小黑明天散步',pets,activePetId:'a',today},{complete:async()=>({content:JSON.stringify({drafts:[{purpose:'record',petId:'b',type:'deworm',title:'驱虫',occurredDate:today,sourceText:'小白今天驱虫'},{purpose:'plan',petId:'a',type:'daily',title:'散步',dueDate:'2026-10-08',sourceText:'小黑明天散步'}]})})});assert.deepEqual(out.drafts.map(d=>d.petId),['a','b']);
});
test('future plan date evidence cannot come from the earlier occurred clause',async()=>{
 const pets=[{id:'p',name:'咪',deletedAt:null}],out=await parseRecords({text:'今天驱虫了，下个月再做',pets,activePetId:'p',today},{complete:async()=>({content:JSON.stringify({drafts:[{purpose:'record',petId:'p',type:'deworm',occurredDate:today,title:'驱虫',sourceText:'今天驱虫了'},{purpose:'plan',petId:'p',type:'deworm',dueDate:'2026-11-07',title:'驱虫',sourceText:'今天驱虫了，下个月再做'}]})})});assert.equal(out.drafts[1].dueDate,null);assert.ok(out.drafts[1].missingFields.includes('dueDate'));
});
test('an omitted unrelated future event cannot be invented as repeated care',async()=>{
 const pets=[{id:'p',name:'咪',deletedAt:null}],out=await parseRecords({text:'今天驱虫了，下周去公园玩',pets,activePetId:'p',today},{complete:async()=>({content:JSON.stringify({drafts:[{purpose:'record',petId:'p',type:'deworm',occurredDate:today,title:'驱虫',sourceText:'今天驱虫了'}]})})});assert.equal(out.drafts.length,1);assert.equal(out.drafts[0].purpose,'record');
});
test('empty weight name stays empty while reviewing and defaults only in confirmed storage input',()=>{
 const raw=draft('record',{type:'weight',value:4.6,unit:'kg',title:''}),options={pets:[{id:'p',deletedAt:null}],today};
 const checked=domain.validateEntryDraft(raw,options);assert.equal(checked.title,'');assert.equal(checked.missingFields.includes('title'),false);assert.equal(domain.toEntryInputs([raw],['record'],options)[0].input.title,'体重记录');
});
test('explicit relative day words use the Shanghai reference day instead of model chosen dates',async()=>{
 const pets=[{id:'p',name:'咪',deletedAt:null}],cases=[['今天','record','2026-10-07'],['昨天','record','2026-10-06'],['前天','record','2026-10-05'],['明天','plan','2026-10-08'],['后天','plan','2026-10-09']];
 for(const [word,purpose,expected] of cases){const source=word+'带它去公园玩',out=await parseRecords({text:source,pets,activePetId:'p',today},{complete:async()=>({content:JSON.stringify({drafts:[{purpose,petId:'p',type:'daily',title:'公园玩',occurredDate:'2026-10-07',dueDate:'2026-10-07',sourceText:source}]})})});assert.equal(out.drafts[0][purpose==='record'?'occurredDate':'dueDate'],expected);}
});
test('whole sentence source resolves occurred and future relative words in their respective clauses',async()=>{
 const pets=[{id:'p',name:'咪',deletedAt:null}],text='今天称重4.6公斤，明天带它去公园玩',out=await parseRecords({text,pets,activePetId:'p',today},{complete:async()=>({content:JSON.stringify({drafts:[{purpose:'record',petId:'p',type:'weight',value:4.6,unit:'kg',title:'称重',occurredDate:'2026-10-06',sourceText:text},{purpose:'plan',petId:'p',type:'daily',title:'公园玩',dueDate:today,sourceText:text}]})})});assert.equal(out.drafts[0].occurredDate,today);assert.equal(out.drafts[1].dueDate,'2026-10-08');
});
