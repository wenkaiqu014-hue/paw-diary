import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftSession} from '../src/features/ai-entry.js';
const pet={id:'p',name:'猫',type:'cat',deletedAt:null};
const snapshot={version:3,mode:'local',pets:[pet],records:[],reminders:[],posts:[],profile:{},activePetId:'p'};
const a={draftId:'a',purpose:'record',petId:'p',type:'weight',occurredDate:'2026-10-07',value:4,unit:'kg',title:''};
const b={draftId:'b',purpose:'plan',petId:'p',type:'daily',dueDate:'2026-10-08',title:'出去玩'};
test('entry hint does not override per-draft purpose, and mixed confirmation uses one atomic write',async()=>{
 let purpose='record',saved,calls=0;const repo={getRevision:()=>2,saveEntryBatch:async(entries,options)=>{calls++;saved={entries,options};return {records:[],reminders:[]};}};
 const session=createDraftSession({repository:repo,getSnapshot:()=>snapshot,purpose:()=>purpose,request:async()=>({today:'2026-10-07',drafts:[a,b]})});
 await session.parse('今天4kg，明天出去玩','p','zh-CN');purpose='plan';await session.confirm([a,b],['a','b']);
 assert.equal(calls,1);assert.deepEqual(saved.entries.map(e=>e.purpose),['record','plan']);assert.equal(saved.entries[1].input.includeInHealth,false);assert.equal(saved.entries[0].input.nextDate,undefined);assert.equal(saved.options.baseRevision,2);
});
test('own catalog update rebases draft while unrelated revision remains stale',async()=>{
 let revision=2,options;const repo={getRevision:()=>revision,saveEntryBatch:async(entries,opts)=>{options=opts;return {records:[],reminders:[]};}};
 const session=createDraftSession({repository:repo,getSnapshot:()=>snapshot,request:async()=>({today:'2026-10-07',drafts:[a]})});await session.parse('4kg','p','zh-CN');revision=3;session.acceptCatalogRevision(3,2);revision=4;await session.confirm([a],['a']);assert.equal(options.baseRevision,3);
});

test('catalog changes after an unrelated mutation cannot erase stale draft CAS',async()=>{
 let revision=2,options;const repo={getRevision:()=>revision,saveEntryBatch:async(entries,opts)=>{options=opts;return {};}};
 const session=createDraftSession({repository:repo,getSnapshot:()=>snapshot,request:async()=>({today:'2026-10-07',drafts:[a]})});await session.parse('4kg','p','zh-CN');revision=4;session.acceptCatalogRevision(4,3);await session.confirm([a],['a']);assert.equal(options.baseRevision,2);
});
