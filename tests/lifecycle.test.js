import test from 'node:test';
import assert from 'node:assert/strict';
import * as schema from '../src/domain/schema.js';
import {applyRecord} from '../src/domain/records.js';
import {applyReminder,completeReminder} from '../src/domain/reminders.js';
import {createDemoRepository} from '../src/data/demo-repository.js';
import {validateBackup,previewImport,mergeBackup,exportRecordsCsv} from '../src/domain/backup.js';
import {v1,now,ids,memoryStorage} from './fixtures/local-state.js';
const base=()=>schema.migrateV1(v1(),{now});
const lifecycle=async()=>{const module=await import('../src/domain/lifecycle.js').catch(()=>({}));assert.equal(typeof module.moveToTrash,'function','recoverable lifecycle API is missing');return module;};
const repository=storage=>createDemoRepository({storage,clock:()=>now,idFactory:ids()});
const asV2=()=>{const s=base();s.version=2;for(const field of ['pets','records','reminders'])for(const item of s[field])delete item.deletedAt;return s;};
test('v1 and v2 migrations preserve all content and output explicit V3 lifecycle markers',()=>{
  const s=base();assert.equal(s.version,3);for(const field of ['pets','records','reminders'])assert.ok(s[field].every(item=>item.deletedAt===null));
  assert.equal(typeof schema.migrateV2,'function');const raw=asV2(),copy=structuredClone(raw),migrated=schema.migrateV2(JSON.stringify(raw));assert.equal(migrated.version,3);assert.deepEqual(raw,copy);assert.equal(migrated.records.length,4);assert.equal(migrated.activePetId,'p2');assert.deepEqual(migrated.posts,raw.posts);
});
test('trash current and final pet selects first visible pet then true empty; restore respects current selection',async()=>{
  const {moveToTrash,restoreFromTrash,visibleHealth}=await lifecycle(),s=base();
  const first=moveToTrash(s,{kind:'pet',ids:['p2']},{now});assert.equal(first.activePetId,'p1');assert.equal(first.records.length,4);assert.deepEqual(first.records,s.records);assert.deepEqual(visibleHealth(first).pets.map(p=>p.id),['p1']);assert.equal(visibleHealth(first).records.length,3);
  const empty=moveToTrash(first,{kind:'pet',ids:['p1']},{now});assert.equal(empty.activePetId,null);assert.equal(empty.pets.length,2);assert.equal(visibleHealth(empty).records.length,0);
  const restored=restoreFromTrash(empty,{kind:'pet',ids:['p2','p1']});assert.equal(restored.activePetId,'p1');assert.deepEqual(restoreFromTrash(first,{kind:'pet',ids:['p2']}).activePetId,'p1');assert.deepEqual(s.pets.map(p=>p.deletedAt),[null,null]);
});
test('record trash cancels pending followup; restoring parent and record never restarts cancelled care',async()=>{
  const {moveToTrash,restoreFromTrash,visibleHealth}=await lifecycle(),s=base();const removed=moveToTrash(s,{kind:'record',ids:['d']},{now});
  assert.equal(removed.records.find(r=>r.id==='d').deletedAt,now);assert.equal(removed.reminders.find(r=>r.originRecordId==='d').status,'cancelled');assert.equal(removed.reminders.find(r=>r.originRecordId==='c').status,'completed');
  const parent=moveToTrash(removed,{kind:'pet',ids:['p1']},{now});assert.throws(()=>restoreFromTrash(parent,{kind:'record',ids:['d']}));
  const parentRestored=restoreFromTrash(parent,{kind:'pet',ids:['p1']});assert.ok(!visibleHealth(parentRestored).records.some(r=>r.id==='d'));
  const restored=restoreFromTrash(parentRestored,{kind:'record',ids:['d']});assert.equal(restored.records.find(r=>r.id==='d').deletedAt,null);assert.equal(restored.reminders.find(r=>r.originRecordId==='d').status,'cancelled');
});
test('trashing completed reminder or completion record retains factual completion links and time',async()=>{
  const {moveToTrash,restoreFromTrash}=await lifecycle(),s=base(),id=s.reminders.find(r=>r.status==='pending').id;
  const done=completeReminder(s,id,{occurredDate:'2026-10-06'},{now,idFactory:ids()});
  const hidden=moveToTrash(done.state,{kind:'reminder',ids:[id]},{now});assert.deepEqual(hidden.records,done.state.records);assert.equal(hidden.reminders.find(r=>r.id===id).completedAt,now);
  const restored=restoreFromTrash(hidden,{kind:'reminder',ids:[id]});assert.deepEqual(restored,done.state);
  const recordHidden=moveToTrash(done.state,{kind:'record',ids:[done.record.id]},{now});assert.equal(recordHidden.reminders.find(r=>r.id===id).completionRecordId,done.record.id);assert.equal(recordHidden.records.length,5);
});
test('trash and restore are idempotent and validate all selections before any change',async()=>{
  const {moveToTrash,restoreFromTrash}=await lifecycle(),s=base(),copy=structuredClone(s),input={kind:'pet',ids:['p2']};const hidden=moveToTrash(s,input,{now});
  assert.deepEqual(moveToTrash(hidden,input,{now:'2026-10-07T00:00:00.000Z'}),hidden);const restored=restoreFromTrash(hidden,input);assert.deepEqual(restoreFromTrash(restored,input),restored);
  for(const input of [{kind:'pet',ids:['p2','missing']},{kind:'oops',ids:['p2']},{kind:'pet',ids:[]},{kind:'record',ids:['a','c'],petId:'p1'},{kind:'reminder',ids:s.reminders.map(r=>r.id),petId:'p1'}])assert.throws(()=>moveToTrash(s,input,{now}));
  assert.throws(()=>restoreFromTrash(hidden,{kind:'pet',ids:['p2','missing']}));assert.deepEqual(s,copy);
});
test('reorder changes only visible pet positions, persists ordered active selection and rejects non permutations',async()=>{
  const {moveToTrash,restoreFromTrash,reorderPets}=await lifecycle(),s=base();s.pets.push({...s.pets[0],id:'p3',name:'第三只'});
  const hidden=moveToTrash(s,{kind:'pet',ids:['p2']},{now});const reordered=reorderPets(hidden,['p3','p1']);assert.deepEqual(reordered.pets.map(p=>p.id),['p3','p2','p1']);assert.equal(reordered.activePetId,'p1');assert.deepEqual(restoreFromTrash(reordered,{kind:'pet',ids:['p2']}).pets.map(p=>p.id),['p3','p2','p1']);
  for(const ids of [['p1'],['p1','p1'],['p1','p2'],['p1','unknown'],null])assert.throws(()=>reorderPets(hidden,ids));assert.deepEqual(s.pets.map(p=>p.id),['p1','p2','p3']);
});
test('hidden entities and hidden parents reject editing, completing and new child creation',async()=>{
  const {moveToTrash}=await lifecycle(),s=base(),id=s.reminders.find(r=>r.status==='pending').id;
  const hidden=moveToTrash(moveToTrash(s,{kind:'record',ids:['a']},{now}),{kind:'reminder',ids:[id]},{now});
  assert.throws(()=>applyRecord(hidden,{id:'a',value:24},{now}));assert.throws(()=>applyRecord(s,{id:'a',deletedAt:now},{now}));assert.throws(()=>applyReminder(hidden,{id,title:'改名'}));assert.throws(()=>completeReminder(hidden,id,{occurredDate:'2026-10-06'},{now}));
  const parent=moveToTrash(s,{kind:'pet',ids:['p1']},{now});assert.throws(()=>applyRecord(parent,{id:'a',value:24},{now}));assert.throws(()=>applyRecord(parent,{petId:'p1',type:'daily',title:'新记录',occurredDate:'2026-10-06'},{now}));assert.throws(()=>applyReminder(parent,{petId:'p1',title:'新事项',dueDate:'2026-10-08'}));assert.throws(()=>completeReminder(parent,id,{occurredDate:'2026-10-06'},{now}));
});
test('complete snapshots reject invalid lifecycle markers, deleted active pet and derived visible views',async()=>{
  const {visibleHealth,moveToTrash}=await lifecycle(),s=base();for(const value of [undefined,'bad-time',42]){const invalid=structuredClone(s);invalid.pets[0].deletedAt=value;assert.throws(()=>schema.validateSnapshot(invalid));}
  const invalid=structuredClone(s);invalid.pets[1].deletedAt=now;assert.throws(()=>schema.validateSnapshot(invalid));assert.throws(()=>schema.validateSnapshot(visibleHealth(s)));assert.equal(schema.validateSnapshot(moveToTrash(s,{kind:'pet',ids:['p1','p2']},{now})).activePetId,null);
});
test('repository batch failure retains full state, storage and selection; successful lifecycle survives reload',async()=>{
  const storage=memoryStorage({'paw-diary:v1':JSON.stringify(v1())}),r=repository(storage),before=await r.snapshot();assert.equal(typeof r.moveToTrash,'function');
  storage.fail=true;await assert.rejects(r.moveToTrash({kind:'pet',ids:['p1','p2']}));assert.deepEqual(await r.snapshot(),before);storage.fail=false;
  await assert.rejects(r.moveToTrash({kind:'pet',ids:['p2','missing']}));assert.deepEqual(await r.snapshot(),before);
  await r.reorderPets(['p2','p1']);await r.moveToTrash({kind:'pet',ids:['p2']});await assert.rejects(r.selectPet('p2'));await assert.rejects(r.savePet({id:'p2',name:'修改'}));
  const hidden=await r.snapshot();assert.deepEqual(await repository(storage).snapshot(),hidden);assert.equal(hidden.pets[0].deletedAt,now);await r.restoreFromTrash({kind:'pet',ids:['p2']});assert.equal((await r.snapshot()).activePetId,'p1');await r.deleteRecord('d');assert.equal((await r.snapshot()).records.find(x=>x.id==='d').deletedAt,now);
});
test('V2 migration retains both original keys and rejects corrupt newer source instead of falling back',async()=>{
  const legacy=JSON.stringify(v1()),v2=JSON.stringify(asV2()),storage=memoryStorage({'paw-diary:v1':legacy,'paw-diary:v2:demo':v2});const result=await repository(storage).snapshot();assert.equal(result.version,3);assert.equal(storage.data.get('paw-diary:v2:demo'),v2);assert.equal(storage.data.get('paw-diary:v1'),legacy);assert.ok(storage.data.has('paw-diary:v3:demo'));
  for(const initial of [{'paw-diary:v1':legacy,'paw-diary:v2:demo':'{bad'},{'paw-diary:v2:demo':v2,'paw-diary:v3:demo':'{bad'}]){const broken=memoryStorage(initial),r=repository(broken);await assert.rejects(r.snapshot());assert.equal(await r.getRawBackup(),Object.values(initial).at(-1));assert.equal(broken.data.size,Object.keys(initial).length);}
});
test('failed V3 migration retries without overwriting source and protects source changed during async backup',async()=>{
  const v2=JSON.stringify(asV2()),storage=memoryStorage({'paw-diary:v2:demo':v2}),set=storage.setItem;storage.setItem=function(k,v){if(k==='paw-diary:v3:demo'&&this.failV3)throw new Error('new write failed');return set.call(this,k,v);};storage.failV3=true;const r=repository(storage);await assert.rejects(r.snapshot());assert.equal(storage.data.get('paw-diary:v2:demo'),v2);storage.failV3=false;assert.equal((await r.snapshot()).version,3);
  const raced=memoryStorage({'paw-diary:v1':JSON.stringify(v1())}),write=raced.setItem;raced.setItem=async function(k,v){write.call(this,k,v);if(k==='paw-diary:v1:backup')write.call(this,'paw-diary:v1','{changed');};await assert.rejects(repository(raced).snapshot());assert.equal(raced.data.has('paw-diary:v3:demo'),false);assert.equal(raced.data.get('paw-diary:v1'),'{changed');
});
test('old backup restoring deleted content requires explicit conflict acceptance; full V3 round trip retains trash',async()=>{
  const {moveToTrash}=await lifecycle(),s=base(),hidden=moveToTrash(s,{kind:'pet',ids:['p1']},{now}),old=asV2();
  const preview=previewImport(hidden,old),conflict=preview.conflicts.find(x=>x.kind==='pet'&&x.id==='p1');assert.equal(conflict.effect,'restore');assert.equal(mergeBackup(hidden,old).pets.find(x=>x.id==='p1').deletedAt,now);
  const accepted=mergeBackup(hidden,old,{acceptedConflictIds:['pet:p1']});assert.equal(accepted.pets.find(x=>x.id==='p1').deletedAt,null);assert.deepEqual(validateBackup(JSON.stringify(hidden)),hidden);assert.deepEqual(mergeBackup(hidden,hidden),hidden);
  assert.equal(previewImport(s,hidden).conflicts.find(x=>x.kind==='pet'&&x.id==='p1').effect,'trash');
});
test('backup accepting last-pet trash or restoring first pet keeps valid active selection',async()=>{
  const {moveToTrash}=await lifecycle(),s=base(),hidden=moveToTrash(s,{kind:'pet',ids:['p1','p2']},{now});const trashed=mergeBackup(s,hidden,{acceptedConflictIds:['pet:p1','pet:p2']});assert.equal(trashed.activePetId,null);const restored=mergeBackup(hidden,s,{acceptedConflictIds:['pet:p1']});assert.equal(restored.activePetId,'p1');assert.equal(restored.pets.find(p=>p.id==='p2').deletedAt,now);
});
test('CSV refuses to include independently deleted records even when passed full records array',async()=>{
  const {moveToTrash}=await lifecycle(),hidden=moveToTrash(base(),{kind:'record',ids:['d']},{now});const csv=exportRecordsCsv(hidden.records);assert.doesNotMatch(csv,/"d","p1"/);assert.match(csv,/"a","p1"/);
});
test('simultaneous repositories cannot overwrite each other after a synchronous final compare',async()=>{
  const storage=memoryStorage({'paw-diary:v1':JSON.stringify(v1())}),a=repository(storage);await a.snapshot();const b=repository(storage);await b.snapshot();
  const results=await Promise.allSettled([a.saveRecord({petId:'p1',type:'daily',title:'窗口甲',occurredDate:'2026-10-06'}),b.saveRecord({petId:'p2',type:'daily',title:'窗口乙',occurredDate:'2026-10-06'})]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal((await repository(storage).snapshot()).records.length,5);
});
test('V2 lifecycle extension is retained rather than silently discarded during migration',()=>{
  assert.equal(typeof schema.migrateV2,'function');const old=asV2();old.records.find(r=>r.id==='d').deletedAt=now;const migrated=schema.migrateV2(old);assert.equal(migrated.records.find(r=>r.id==='d').deletedAt,now);
});
test('pet removal selects first remaining pet in persisted order even when the removed pet was not current',async()=>{
  const {moveToTrash}=await lifecycle(),s=base();s.pets.push({...s.pets[0],id:'p3',name:'第三只'});const next=moveToTrash(s,{kind:'pet',ids:['p3']},{now});assert.equal(next.activePetId,'p1');
});
test('backup cannot restore an individual child while its parent remains trashed',async()=>{
  const {moveToTrash}=await lifecycle(),s=base(),child=moveToTrash(s,{kind:'record',ids:['a']},{now}),parent=moveToTrash(child,{kind:'pet',ids:['p1']},{now});
  assert.throws(()=>mergeBackup(parent,s,{acceptedConflictIds:['record:a']}),/恢复.*宠物/);const both=mergeBackup(parent,s,{acceptedConflictIds:['pet:p1','record:a']});assert.equal(both.pets.find(p=>p.id==='p1').deletedAt,null);assert.equal(both.records.find(r=>r.id==='a').deletedAt,null);
});
test('explicit record-trash backup acceptance also cancels pending linked care atomically',async()=>{
  const {moveToTrash}=await lifecycle(),s=base(),incoming=moveToTrash(s,{kind:'record',ids:['d']},{now});const merged=mergeBackup(s,incoming,{acceptedConflictIds:['record:d']});assert.equal(merged.records.find(r=>r.id==='d').deletedAt,now);assert.equal(merged.reminders.find(r=>r.originRecordId==='d').status,'cancelled');
});
test('retrying a previously trashed pet preserves the current pet selected after the original deletion',async()=>{
  const s=base();s.pets.push({...s.pets[0],id:'p3',name:'第三只'});
  const storage=memoryStorage({'paw-diary:v3:demo':JSON.stringify(s)}),r=repository(storage);
  await r.moveToTrash({kind:'pet',ids:['p3']});assert.equal((await r.snapshot()).activePetId,'p1');
  await r.selectPet('p2');const before=await r.snapshot();
  await r.moveToTrash({kind:'pet',ids:['p3']});const retried=await r.snapshot();
  assert.equal(retried.activePetId,'p2');assert.deepEqual(retried,before);assert.deepEqual(await repository(storage).snapshot(),before);
});
