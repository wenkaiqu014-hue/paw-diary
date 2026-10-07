import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSnapshot,normalizePet,normalizeRecord} from '../src/domain/schema.js';
import {applyRecord} from '../src/domain/records.js';
import {completeReminder} from '../src/domain/reminders.js';
import {validateBackup,exportRecordsCsv} from '../src/domain/backup.js';
const now='2026-10-07T01:00:00.000Z';
const base=()=>({version:3,mode:'demo',activePetId:'p',pets:[normalizePet({id:'p',name:'团团',type:'cat'})],records:[],reminders:[],posts:[],profile:{city:'深圳'}});
test('personal local snapshots are valid and retain avatar asset references',()=>{
 const raw=base();raw.mode='local';raw.pets[0].avatarAssetId='asset-1';
 const out=validateSnapshot(raw);assert.equal(out.mode,'local');assert.equal(out.pets[0].avatarAssetId,'asset-1');assert.equal(validateBackup(raw).mode,'local');
});
test('other pet labels are trimmed and validated without dog fallback or leaking labels to native types',()=>{
 const pet=normalizePet({id:'rabbit',name:'兔兔',type:'other',typeLabel:'  兔子  '});assert.equal(pet.typeLabel,'兔子');assert.equal(pet.image,'');
 assert.throws(()=>normalizePet({id:'p',name:'兔',type:'other',typeLabel:' '}));assert.throws(()=>normalizePet({id:'p',name:'兔',type:'other',typeLabel:'啊'.repeat(21)}));
 assert.equal(normalizePet({id:'p',name:'猫',type:'cat',typeLabel:'兔子'}).typeLabel,undefined);
});
test('custom records retain labels through completion and export without weight values',()=>{
 let i=0;const ids=()=>`n${++i}`;
 const state=applyRecord(base(),{petId:'p',type:'other',typeLabel:'剪指甲',title:'剪指甲',occurredDate:'2026-10-06',note:'很乖',nextDate:'2026-10-09'},{now,idFactory:ids});
 assert.equal(state.records[0].typeLabel,'剪指甲');assert.equal(state.records[0].value,null);assert.equal(state.records[0].unit,null);
 const done=completeReminder(state,state.reminders[0].id,{occurredDate:'2026-10-07'},{now,idFactory:ids});
 assert.equal(done.record.type,'other');assert.equal(done.record.typeLabel,'剪指甲');
 assert.ok(exportRecordsCsv(done.state.records).includes('剪指甲'));assert.ok(exportRecordsCsv(done.state.records).includes('typeLabel'));
 assert.equal(validateBackup(done.state).records[0].typeLabel,'剪指甲');
});
test('changing other record to daily removes label and arbitrary custom weight fields are rejected',()=>{
 const record={id:'r',petId:'p',type:'other',typeLabel:'剪指甲',occurredDate:'2026-10-06',title:'护理',createdAt:now,updatedAt:now};
 assert.throws(()=>normalizeRecord({...record,value:12}));assert.throws(()=>normalizeRecord({...record,typeLabel:''}));
 const state=base();state.records=[normalizeRecord(record)];
 const changed=applyRecord(state,{id:'r',type:'daily'},{now});assert.equal(changed.records[0].typeLabel,undefined);
});

test('other species cannot inherit stock cat or dog photo after a type edit',()=>{
 const old=normalizePet({id:'p',name:'团团',type:'dog',image:'assets/dog.jpg'});
 assert.equal(normalizePet({...old,type:'other',typeLabel:'兔子'}).image,'');
 const actual='data:image/png;base64,AA==';assert.equal(normalizePet({...old,type:'other',typeLabel:'兔子',image:actual}).image,actual);
});
