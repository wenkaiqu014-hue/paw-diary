import test from 'node:test';
import assert from 'node:assert/strict';
const pet={id:'p',name:'Milo',type:'cat',deletedAt:null};
const draft={draftId:'d',petId:'p',type:'weight',occurredDate:'2026-10-06',value:4.6,unit:'kg',title:'体重记录',note:'',nextDate:null,missingFields:[],sourceText:'4.6kg'};
test('review purpose is editable per draft while the entry default is only a parse hint',async()=>{
 const {createDraftSession}=await import('../src/features/ai-entry.js');let purpose='record',saved,writes=0;const snapshot={version:3,mode:'local',pets:[pet],records:[],reminders:[],posts:[],profile:{city:'深圳'},activePetId:'p'};
 const entry=createDraftSession({purpose:()=>purpose,repository:{saveEntryBatch:async entries=>{writes++;saved=entries;return {records:[],reminders:entries.map(e=>e.input)}}},getSnapshot:()=>snapshot,request:async()=>({today:'2026-10-07',drafts:[draft]})});await entry.parse('4.6kg','p','zh-CN');purpose='plan';
 await entry.confirm([{...draft,purpose:'plan',dueDate:'2026-10-08',occurredDate:null,value:null,unit:null,title:'称重计划'}],['d']);assert.equal(writes,1);assert.equal(saved[0].purpose,'plan');assert.equal(saved[0].input.recordType,'weight');assert.equal(saved[0].input.value,undefined);
});
test('separate record purpose saves only an event even if AI mentions a next reminder',async()=>{
 const {createDraftSession}=await import('../src/features/ai-entry.js');let saved;
 const snapshot={version:3,mode:'local',pets:[pet],records:[],reminders:[],posts:[],profile:{city:'深圳'},activePetId:'p'};
 const entry=createDraftSession({separatePurposes:true,repository:{saveEntryBatch:async entries=>{saved=entries.map(e=>e.input);return {records:saved,reminders:[]}}},getSnapshot:()=>snapshot,request:async()=>({today:'2026-10-07',drafts:[]})});
 await entry.parse('今天驱虫，下次再做','p','zh-CN');await entry.confirm([{...draft,type:'deworm',value:null,unit:null,nextDate:'2026-11-07'}],['d']);assert.equal(saved[0].nextDate,undefined);
 await entry.confirm([{...draft,type:'deworm',value:null,unit:null,nextDate:null,missingFields:['nextDate']}],['d']);assert.equal(saved[0].nextDate,undefined);
});
test('every selected plan is validated before the first reminder is written',async()=>{
 const {createDraftSession}=await import('../src/features/ai-entry.js');let writes=0;
 const snapshot={version:3,mode:'local',pets:[pet],records:[],reminders:[],posts:[],profile:{city:'深圳'},activePetId:'p'};
 const session=createDraftSession({purpose:'plan',repository:{saveEntryBatch:async entries=>{writes++;return {reminders:entries.map(e=>e.input)}}},getSnapshot:()=>snapshot,request:async()=>({today:'2026-10-07',drafts:[]})});
 await session.parse('安排计划','p','zh-CN');await assert.rejects(session.confirm([{draftId:'a',petId:'p',type:'daily',dueDate:'2026-10-14',title:'出门'},{draftId:'b',petId:'p',type:'daily',dueDate:null,title:'护理'}],['a','b']));assert.equal(writes,0);
});
test('plan AI passes explicit purpose and confirms a reminder rather than a record',async()=>{
 const {createDraftSession}=await import('../src/features/ai-entry.js');
 let payload,writes=0,recordWrites=0;
 const snapshot={version:3,mode:'local',pets:[pet],records:[],reminders:[],posts:[],profile:{city:'深圳'},activePetId:'p'};
 const repository={getRevision:()=>0,saveEntryBatch:async entries=>{writes++;recordWrites+=entries.filter(e=>e.purpose==='record').length;return {records:[],reminders:entries.filter(e=>e.purpose==='plan').map(e=>({...e.input,id:'r'}))};}};
 const session=createDraftSession({purpose:'plan',repository,getSnapshot:()=>snapshot,request:async(action,input)=>{payload=input;return {today:'2026-10-07',drafts:[]}}});
 await session.parse('下周去玩','p','zh-CN');assert.equal(payload.purpose,'plan');
 const result=await session.confirm([{draftId:'d',petId:'p',type:'daily',dueDate:'2026-10-14',title:'去玩',note:'',missingFields:[]}],['d']);
 assert.equal(writes,1);assert.equal(recordWrites,0);assert.equal(result.reminders[0].dueDate,'2026-10-14');
});
test('parse is read-only, confirm saves only selected complete drafts',async()=>{
 const {createDraftSession}=await import('../src/features/ai-entry.js');
 let writes=0;const repository={getRevision:()=>2,saveEntryBatch:async entries=>{writes++;return{records:entries.filter(e=>e.purpose==='record').map(e=>e.input),reminders:[]}}};
 const snapshot={version:3,mode:'local',pets:[pet],records:[],reminders:[],posts:[],profile:{city:'深圳'},activePetId:'p'};
 const session=createDraftSession({repository,getSnapshot:()=>snapshot,request:async()=>({drafts:[draft],today:'2026-10-07'})});
 await session.parse('4.6kg','p','zh-CN');assert.equal(writes,0);
 const result=await session.confirm([draft],['d']);assert.equal(writes,1);assert.equal(result.records[0].value,4.6);
});
test('scope change cannot confirm a former pet or account draft',async()=>{
 const {createDraftSession}=await import('../src/features/ai-entry.js');
 let generation=1,writes=0;const repository={getRevision:()=>0,saveEntryBatch:async()=>{writes++}};
 const scope=()=>({generation,petId:'p',repository});
 const snapshot={version:3,mode:'local',pets:[pet],records:[],reminders:[],posts:[],profile:{city:'深圳'},activePetId:'p'};
 const session=createDraftSession({repository,getScope:scope,getSnapshot:()=>snapshot,request:async()=>({drafts:[draft],today:'2026-10-07'})});
 await session.parse('4.6','p','zh-CN');generation++;await assert.rejects(session.confirm([draft],['d']),e=>e.code==='WORKSPACE_CHANGED');assert.equal(writes,0);
});
test('real demo repository parses and confirms AI drafts without a revision API',async()=>{
 const {createDraftSession}=await import('../src/features/ai-entry.js');
 const {createDemoRepository}=await import('../src/data/demo-repository.js');
 const {memoryStorage}=await import('./fixtures/local-state.js');
 const repository=createDemoRepository({storage:memoryStorage(),clock:()=> '2026-10-07T01:00:00.000Z'});
 const snapshot=await repository.snapshot(),petId=snapshot.activePetId;let calls=0;
 const source={...draft,petId};
 const session=createDraftSession({repository,getSnapshot:()=>snapshot,request:async()=>{calls++;return{drafts:[source],today:'2026-10-07'}}});
 const before=snapshot.records.length;await session.parse('4.6kg',petId,'zh-CN');
 assert.equal(calls,1);await session.confirm([source],['d']);assert.equal((await repository.snapshot()).records.length,before+1);
});
