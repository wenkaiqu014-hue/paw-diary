import test from 'node:test';import assert from 'node:assert/strict';import {IDBFactory} from 'fake-indexeddb';import {createLocalRepository} from '../src/data/local-repository.js';
const d=await import('../src/domain/onboarding.js').catch(()=>({}));
const clock=()=> '2026-10-07T01:00:00.000Z';
test('onboarding advances only after actual entities and resumes after linked record deletion',async()=>{
 assert.equal(typeof d.advanceOnboarding,'function');let n=0;const repo=createLocalRepository({indexedDB:new IDBFactory(),clock,idFactory:()=>`o${++n}`});
 assert.equal(d.advanceOnboarding(null,{type:'RESUME'},await repo.snapshot()).step,'pet');
 const pet=await repo.savePet({name:'咪',type:'cat'});let p=d.advanceOnboarding(null,{type:'PET_SAVED',petId:pet.id},await repo.snapshot());assert.equal(p.step,'record');
 assert.throws(()=>d.advanceOnboarding(p,{type:'RECORDS_SAVED',recordIds:['missing']},awaitSnapshot),/记录/);
 const record=await repo.saveRecord({petId:pet.id,type:'daily',occurredDate:'2026-10-07',title:'玩耍'});p=d.advanceOnboarding(p,{type:'RECORDS_SAVED',recordIds:[record.id]},await repo.snapshot());assert.equal(p.step,'reminder');
 p=d.advanceOnboarding(p,{type:'REMINDER_SKIPPED'},await repo.snapshot());assert.equal(p.step,'done');await repo.saveOnboarding(p);
 const saved=(await repo.snapshot()).profile.stage3.onboardingByPet[pet.id];assert.equal(saved.step,'done');assert.equal(saved.recordIds[0],record.id);
 await repo.moveToTrash({kind:'record',ids:[record.id]});assert.equal(d.advanceOnboarding(saved,{type:'RESUME'},await repo.snapshot()).step,'record');
});
const awaitSnapshot={pets:[{id:'o2',deletedAt:null}],records:[],reminders:[]};
test('optional stage3 defaults preserve old snapshots and reject malformed metadata',async()=>{
 const {normalizeStage3State}=await import('../src/domain/stage3-state.js').catch(()=>({}));assert.equal(typeof normalizeStage3State,'function');assert.deepEqual(normalizeStage3State(undefined),{onboardingByPet:{},recaps:[]});assert.throws(()=>normalizeStage3State({onboardingByPet:[],recaps:[]}));
});
test('resume recovers a saved first record when progress write was interrupted',async()=>{
 let n=0;const repo=createLocalRepository({indexedDB:new IDBFactory(),clock,idFactory:()=>`resume${++n}`}),pet=await repo.savePet({name:'咪',type:'cat'});const initial=d.advanceOnboarding(null,{type:'PET_SAVED',petId:pet.id},await repo.snapshot());await repo.saveOnboarding(initial);const stored=(await repo.snapshot()).profile.stage3.onboardingByPet[pet.id];assert.equal(d.advanceOnboarding(stored,{type:'RESUME'},await repo.snapshot()).step,'record');
 const record=await repo.saveRecord({petId:pet.id,type:'daily',occurredDate:'2026-10-07',title:'玩耍'});const resumed=d.advanceOnboarding(stored,{type:'RESUME'},await repo.snapshot());assert.equal(resumed.step,'reminder');assert.deepEqual(resumed.recordIds,[record.id]);const skipped=d.advanceOnboarding(resumed,{type:'REMINDER_SKIPPED'},await repo.snapshot());assert.equal(d.advanceOnboarding(skipped,{type:'RESUME'},await repo.snapshot()).step,'done');assert.equal((await repo.snapshot()).records.length,1);
});
