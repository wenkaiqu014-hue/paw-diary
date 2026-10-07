import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePet,validateSnapshot} from '../src/domain/schema.js';
import {applyRecord} from '../src/domain/records.js';
import {applyReminder,completeReminder} from '../src/domain/reminders.js';
let catalog;try{catalog=await import('../src/domain/record-type-catalog.js');}catch{}
const now='2026-10-07T01:00:00.000Z';let i=0;const deps={now,idFactory:()=>`generated-${++i}`};
const base=()=>({version:3,mode:'local',activePetId:'p',pets:[normalizePet({id:'p',name:'团团',type:'cat'})],records:[],reminders:[],posts:[],profile:{city:'深圳'}});
test('catalog starts with four fixed types and does not auto-create historical labels',()=>{
 assert.equal(typeof catalog?.recordTypeEntries,'function');assert.deepEqual(catalog.recordTypeEntries(base()).map(x=>x.id),['weight','vaccine','deworm','daily']);
});
test('fixed types cannot be deleted; up to three custom types may reuse an icon',()=>{
 assert.equal(typeof catalog?.applyRecordTypeCommand,'function');let s=base();assert.throws(()=>catalog.applyRecordTypeCommand(s,{action:'delete',ids:['weight']},deps));
 for(const name of ['护理A','护理B','护理C'])s=catalog.applyRecordTypeCommand(s,{action:'add',name,iconKey:'book'},deps);
 assert.equal(catalog.recordTypeEntries(s).filter(x=>!x.builtin).length,3);assert.throws(()=>catalog.applyRecordTypeCommand(s,{action:'add',name:'护理D',iconKey:'drop'},deps));
 s=catalog.applyRecordTypeCommand(s,{action:'delete',ids:[s.profile.recordTypeCatalog.custom[0].id]},deps);s=catalog.applyRecordTypeCommand(s,{action:'add',name:'护理D',iconKey:'book'},deps);assert.equal(catalog.recordTypeEntries(s).length,7);
});
test('catalog sorting is exact, duplicate names and invalid icons are rejected',()=>{
 assert.equal(typeof catalog?.applyRecordTypeCommand,'function');let s=catalog.applyRecordTypeCommand(base(),{action:'add',name:'护理',iconKey:'paw'},deps);
 assert.throws(()=>catalog.applyRecordTypeCommand(s,{action:'add',name:' 护理 ',iconKey:'drop'},deps));assert.throws(()=>catalog.applyRecordTypeCommand(s,{action:'add',name:'新',iconKey:'upload'},deps));
 const ids=catalog.recordTypeEntries(s).map(x=>x.id).reverse();s=catalog.applyRecordTypeCommand(s,{action:'reorder',ids},deps);assert.deepEqual(catalog.recordTypeEntries(validateSnapshot(s)).map(x=>x.id),ids);assert.throws(()=>catalog.applyRecordTypeCommand(s,{action:'reorder',ids:['daily']},deps));
});
test('custom snapshots remain readable after deleting catalog definition, other stays historic only',()=>{
 assert.equal(typeof catalog?.applyRecordTypeCommand,'function');let s=catalog.applyRecordTypeCommand(base(),{action:'add',name:'护理',iconKey:'drop'},deps);const type=s.profile.recordTypeCatalog.custom[0];
 s=applyRecord(s,{petId:'p',type:'other',customTypeId:type.id,typeLabel:type.name,iconKey:type.iconKey,title:'护理一次',occurredDate:'2026-10-06',nextDate:'2026-10-09'},deps);
 s=catalog.applyRecordTypeCommand(s,{action:'delete',ids:[type.id]},deps);assert.equal(s.records[0].customTypeId,type.id);assert.equal(s.records[0].iconKey,'drop');assert.equal(catalog.recordTypeEntries(s).length,4);assert.equal(catalog.recordTypeEntries(s,{includeHistoricalRecord:s.records[0]}).at(-1).id,type.id);
 const done=completeReminder(s,s.reminders[0].id,{occurredDate:'2026-10-07'},deps);assert.equal(done.record.iconKey,'drop');assert.equal(done.record.customTypeId,type.id);
});
test('typed standalone plans create correct actual record and weight requires a value',()=>{
 let s=applyReminder(base(),{petId:'p',recordType:'weight',title:'称重',dueDate:'2026-10-07'},deps);assert.equal(s.reminders[0].recordType,'weight');assert.throws(()=>completeReminder(s,s.reminders[0].id,{occurredDate:'2026-10-07'},deps));assert.equal(completeReminder(s,s.reminders[0].id,{occurredDate:'2026-10-07',value:4.5},deps).record.type,'weight');
 s=applyReminder(base(),{petId:'p',recordType:'vaccine',title:'疫苗',dueDate:'2026-10-07'},deps);assert.equal(completeReminder(s,s.reminders[0].id,{occurredDate:'2026-10-07'},deps).record.type,'vaccine');
});
import {createLocalRepository} from '../src/data/local-repository.js';
import {createDemoRepository} from '../src/data/demo-repository.js';
import {indexedDB} from 'fake-indexeddb';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{handleRequest}=require('../backend/api.cjs'),{memoryStore}=require('./helpers/cloud-memory.cjs');
test('local catalog writes are idempotent, isolated and stale revisions rejected',async()=>{
 const repo=createLocalRepository({indexedDB,dbName:`types-${Date.now()}-${Math.random()}`,clock:()=>now,idFactory:deps.idFactory});await repo.snapshot();assert.equal(typeof repo.manageRecordTypes,'function');
 const command={action:'add',name:'护理',iconKey:'paw'},options={baseRevision:repo.getRevision(),operationId:'once'};const first=await repo.manageRecordTypes(command,options);assert.deepEqual(await repo.manageRecordTypes(command,options),first);assert.equal(recordCount(await repo.snapshot()),1);await assert.rejects(repo.manageRecordTypes({action:'add',name:'第二项',iconKey:'paw'},{baseRevision:0,operationId:'stale'}));
 const other=createLocalRepository({indexedDB,dbName:`types-other-${Math.random()}`});assert.equal(recordCount(await other.snapshot()),0);
});
const recordCount=s=>s.profile.recordTypeCatalog?.custom.filter(x=>x.deletedAt===null).length??0;
test('demo catalog persists its idempotent receipt across reconstruction',async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},seedFactory=()=>({...base(),mode:'demo'});
 const repo=createDemoRepository({storage,seedFactory,clock:()=>now,idFactory:deps.idFactory});await repo.snapshot();assert.equal(typeof repo.manageRecordTypes,'function');const command={action:'add',name:'护理',iconKey:'drop'},o={operationId:'same'};await repo.manageRecordTypes(command,o);const again=createDemoRepository({storage,seedFactory,clock:()=>now,idFactory:deps.idFactory});await again.manageRecordTypes(command,o);assert.equal(recordCount(await again.snapshot()),1);
});
test('cloud enforces owner, revision, immutable fixed types, max three and replay identity',async()=>{
 const store=memoryStore();let rev=0;let n=0;const call=async(payload,key=`op-${++n}`,expectedRevision=rev,userId='A')=>{const r=await handleRequest({version:1,action:'recordTypes.manage',payload,expectedRevision,idempotencyKey:key},{store,principal:{userId,emailVerified:true,isAnonymous:false},clock:()=>now,idFactory:deps.idFactory});if(r.ok&&userId==='A')rev=r.revision;return r;};
 const first=await call({action:'add',name:'护理A',iconKey:'book'},'once',0);assert.equal(first.ok,true);const replay=await call({action:'add',name:'护理A',iconKey:'book'},'once',0);assert.deepEqual(replay.data,first.data);assert.equal((await call({action:'add',name:'更名',iconKey:'book'},'once')).error.code,'INVALID_INPUT');
 assert.equal((await call({action:'delete',ids:['weight']})).error.code,'INVALID_INPUT');await call({action:'add',name:'护理B',iconKey:'book'});await call({action:'add',name:'护理C',iconKey:'book'});assert.equal((await call({action:'add',name:'护理D',iconKey:'drop'})).error.code,'INVALID_INPUT');assert.equal((await call({action:'reorder',ids:['daily']},'stale',0)).error.code,'CONFLICT');
 const b=await call({action:'add',name:'B护理',iconKey:'book'},'b',0,'B');assert.equal(b.ok,true);assert.equal(b.data.custom.length,1);assert.equal(first.data.custom.length,1);
});
test('planned note is optional, bounded and survives saving and actual completion',()=>{
 let s=applyReminder(base(),{petId:'p',recordType:'daily',title:'日常计划',dueDate:'2026-10-07',note:'带毛孩子去公园'},deps);assert.equal(s.reminders[0].note,'带毛孩子去公园');
 assert.equal(completeReminder(s,s.reminders[0].id,{occurredDate:'2026-10-07'},deps).record.note,'带毛孩子去公园');
 const legacy=applyReminder(base(),{petId:'p',title:'旧计划',dueDate:'2026-10-07'},deps);assert.equal(Object.hasOwn(legacy.reminders[0],'note'),false);
 assert.throws(()=>applyReminder(base(),{petId:'p',title:'坏计划',dueDate:'2026-10-07',note:'a'.repeat(501)},deps));
});
test('local planned save retries one operation without duplicate or lost revision guard',async()=>{
 const repo=createLocalRepository({indexedDB,dbName:`plan-receipts-${Math.random()}`,clock:()=>now,idFactory:deps.idFactory});const pet=await repo.savePet({name:'合成猫',type:'cat'}),input={petId:pet.id,title:'日常计划',recordType:'daily',dueDate:'2026-10-09',note:'合成计划说明'},options={baseRevision:repo.getRevision(),operationId:'save-plan-once'};
 const saved=await repo.saveReminder(input,options),revision=repo.getRevision();assert.deepEqual(await repo.saveReminder(input,options),saved);assert.equal(repo.getRevision(),revision);assert.equal((await repo.snapshot()).reminders.length,1);await assert.rejects(repo.saveReminder({...input,title:'另一项'},{...options,operationId:'stale-plan'}));await assert.rejects(repo.saveReminder({...input,title:'篡改'},{...options,baseRevision:revision}));
});
test('demo planned save retry receipt survives reconstruction',async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},seedFactory=()=>({...base(),mode:'demo'}),input={petId:'p',title:'日常计划',recordType:'daily',dueDate:'2026-10-09'},options={operationId:'save-plan-once'};
 const first=createDemoRepository({storage,seedFactory,clock:()=>now,idFactory:deps.idFactory}),saved=await first.saveReminder(input,options);const next=createDemoRepository({storage,seedFactory,clock:()=>now,idFactory:deps.idFactory});assert.deepEqual(await next.saveReminder(input,options),saved);assert.equal((await next.snapshot()).reminders.length,1);await assert.rejects(next.saveReminder({...input,title:'另一项'},{operationId:'stale-plan',baseRevision:0}));
});
