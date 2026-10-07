import test from 'node:test';import assert from 'node:assert/strict';import {exportRecordsCsv} from '../src/domain/backup.js';
test('pet selection defaults current, multiple selections and empty selection filter only records',async()=>{
 const {initialPetSelection,filterRecords}=await import('../src/ui/record-pet-filter.js');const snapshot={activePetId:'a',pets:[{id:'a',name:'Alpha'},{id:'b',name:'Beta'}],records:[{id:'1',petId:'a',type:'daily',occurredDate:'2026-10-07',createdAt:'2026-10-07T00:00:00Z',deletedAt:null},{id:'2',petId:'b',type:'daily',occurredDate:'2026-10-07',createdAt:'2026-10-07T00:00:00Z',deletedAt:null}]};
 assert.deepEqual([...initialPetSelection(snapshot)],['a']);assert.equal(filterRecords(snapshot,{petIds:new Set(['a','b'])}).length,2);assert.equal(filterRecords(snapshot,{petIds:new Set()}).length,0);assert.equal(snapshot.activePetId,'a');
 const csv=exportRecordsCsv(filterRecords(snapshot,{petIds:new Set(['b'])}),{pets:snapshot.pets});assert.ok(csv.includes('"petName"'));assert.ok(csv.includes('"Beta"'));assert.ok(!csv.includes('"Alpha"'));
 const hidden=structuredClone(snapshot);hidden.pets[0].deletedAt='2026-10-07T00:00:00Z';assert.equal(filterRecords(hidden,{petIds:new Set(['a'])}).length,0,'hidden parent must hide its individually-visible records');
});
test('custom tab matches stable customTypeId and all preserves deleted catalog history',async()=>{
 const {filterRecords}=await import('../src/ui/record-pet-filter.js');const snapshot={activePetId:'a',pets:[{id:'a',deletedAt:null}],records:[{id:'history',petId:'a',type:'other',customTypeId:'custom:fixture',typeLabel:'用户原文',occurredDate:'2026-10-07',createdAt:'2026-10-07T00:00:00Z',deletedAt:null}],profile:{recordTypeCatalog:{custom:[{id:'custom:fixture',deletedAt:'2026-10-07T00:00:00Z'}]}}};
 assert.equal(filterRecords(snapshot,{type:'custom:fixture'}).length,1);assert.equal(filterRecords(snapshot,{type:'all'})[0].typeLabel,'用户原文');
});
