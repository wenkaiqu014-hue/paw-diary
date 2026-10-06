import test from 'node:test';
import assert from 'node:assert/strict';
const {IDBFactory}=await import('fake-indexeddb').catch(()=>({}));
const {createLocalRepository}=await import('../src/data/local-repository.js').catch(()=>({}));
const {createIndexedDBStore}=await import('../src/data/indexeddb-store.js').catch(()=>({}));
test('local personal repository has an isolated IDB implementation',()=>assert.equal(typeof createLocalRepository,'function'));
const clock=()=> '2026-10-07T00:00:00.000Z';
const pet=name=>({name,type:'cat'});
function fixture(){const indexedDB=new IDBFactory();let n=0;return {indexedDB,dbName:'personal',clock,idFactory:()=>`id-${++n}`};}
test('personal starts empty and reopens independently of all legacy keys',async()=>{const opts=fixture(),repo=createLocalRepository(opts);const old=globalThis.localStorage;globalThis.localStorage={getItem(){throw Error('legacy read');},setItem(){throw Error('legacy write');}};try{assert.deepEqual((await repo.snapshot()).pets,[]);assert.equal((await repo.snapshot()).mode,'local');const saved=await repo.savePet(pet('米米'));assert.equal(repo.getRevision(),1);const reopened=createLocalRepository(opts);assert.equal((await reopened.snapshot()).pets[0].id,saved.id);assert.equal(reopened.getWorkspaceId(),repo.getWorkspaceId());}finally{globalThis.localStorage=old;}});
test('two tabs preserve both inputs and only one stale writer commits',async()=>{const opts=fixture(),a=createLocalRepository(opts),b=createLocalRepository(opts);await Promise.all([a.snapshot(),b.snapshot()]);const results=await Promise.allSettled([a.savePet(pet('A')),b.savePet(pet('B'))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'CONFLICT');assert.equal((await a.refresh()).pets.length,1);});
test('transaction abort rolls snapshot media and blob back together',async()=>{const opts=fixture(),store=createIndexedDBStore(opts);await store.initialize({snapshot:{value:0},revision:0,workspaceId:'one'});await assert.rejects(store.transaction(0,ctx=>{ctx.envelope.snapshot.value=1;ctx.media.set('m',{id:'m'});ctx.blobs.set('m',new Blob(['x']));ctx.transaction.abort();}));const state=await store.read();assert.equal(state.envelope.snapshot.value,0);assert.equal(state.media.size,0);assert.equal(state.blobs.size,0);});
test('unavailable IDB rejects instead of seeding demo',async()=>{const repo=createLocalRepository({indexedDB:null});await assert.rejects(repo.snapshot(),/存储|IndexedDB/);});
test('local supports soft delete restore reorder and records reminder lifecycle',async()=>{const repo=createLocalRepository(fixture()),a=await repo.savePet(pet('A')),b=await repo.savePet(pet('B'));const rec=await repo.saveRecord({petId:a.id,type:'daily',occurredDate:'2026-10-06',title:'护理',note:'',nextDate:'2026-10-07'});const snapshot=await repo.snapshot();await repo.completeReminder(snapshot.reminders[0].id,{occurredDate:'2026-10-07',note:''});await repo.moveToTrash({kind:'pet',ids:[a.id]});await repo.restoreFromTrash({kind:'pet',ids:[a.id]});assert.deepEqual((await repo.reorderPets([b.id,a.id])).pets.map(p=>p.id),[b.id,a.id]);assert.ok((await repo.snapshot()).records.some(r=>r.id===rec.id));await repo.saveProfile({city:'上海'});assert.equal((await repo.snapshot()).profile.city,'上海');});
test('local pet selection survives reopening without incrementing shared revision',async()=>{const options=fixture(),repo=createLocalRepository(options),a=await repo.savePet(pet('A')),b=await repo.savePet(pet('B')),revision=repo.getRevision();await repo.selectPet(b.id);assert.equal(repo.getRevision(),revision);assert.equal((await createLocalRepository(options).snapshot()).activePetId,b.id);});
test('corrupt personal snapshot can be exported raw and explicitly recovered without overwriting its original',async()=>{const options=fixture(),store=createIndexedDBStore(options),original={version:3,mode:'local',broken:'original'};await store.initialize({snapshot:original,revision:4,workspaceId:'keep-source',receipts:{}});const repo=createLocalRepository(options);await assert.rejects(repo.snapshot());assert.deepEqual(JSON.parse(await repo.getRawBackup()),original);const good={version:3,mode:'local',pets:[],records:[],reminders:[],posts:[],activePetId:null,profile:{city:'杭州'}};await repo.replaceSnapshot(good);assert.equal((await repo.snapshot()).profile.city,'杭州');assert.equal(repo.getWorkspaceId(),'keep-source');const stored=(await store.read()).envelope;assert.deepEqual(JSON.parse(stored.recoverySnapshots[0].raw),original);});
test('initial transaction abort can be retried after the storage problem ends',async()=>{const indexedDB=new IDBFactory();let abort=true;const wrapped={open(name,version){const request=indexedDB.open(name,version);request.addEventListener('success',()=>{const db=request.result,transaction=db.transaction.bind(db);db.transaction=(...args)=>{const tx=transaction(...args);if(abort&&args[1]==='readwrite'){abort=false;queueMicrotask(()=>tx.abort());}return tx;};});return request;}};const repo=createLocalRepository({indexedDB:wrapped});await assert.rejects(repo.snapshot());assert.equal((await repo.snapshot()).pets.length,0);});

// Regression: actual form adapter passes CAS options separately from domain input.
const {captureFormContext,bindFormRepository}=await import('../src/ui/form-context.js');
for(const method of ['savePet','saveRecord','saveReminder','saveProfile','deleteRecord','reorderPets','moveToTrash','restoreFromTrash','completeReminder']){
  test(`real form ${method} rejects stale independent options without changing IDB or cache`,async()=>{
    const opts=fixture(),repo=createLocalRepository(opts),a=await repo.savePet(pet('A')),b=await repo.savePet(pet('B'));
    const record=await repo.saveRecord({petId:a.id,type:'daily',occurredDate:'2026-10-06',title:'护理',nextDate:'2026-10-07'});
    const reminder=(await repo.snapshot()).reminders[0];
    if(method==='restoreFromTrash')await repo.moveToTrash({kind:'pet',ids:[b.id]});
    const getGeneration=()=>1,context=captureFormContext({repository:repo,getGeneration,petId:a.id}),bound=bindFormRepository(repo,context,getGeneration);
    await repo.saveProfile({city:'新版'});
    const args={savePet:[{id:a.id,name:'旧表单'}],saveRecord:[{id:record.id,title:'旧表单'}],saveReminder:[{id:reminder.id,title:'旧表单'}],saveProfile:[{city:'旧表单'}],deleteRecord:[record.id],reorderPets:[[b.id,a.id]],moveToTrash:[{kind:'pet',ids:[a.id]}],restoreFromTrash:[{kind:'pet',ids:[b.id]}],completeReminder:[reminder.id,{occurredDate:'2026-10-07'}]}[method];
    const before=await repo.snapshot(),revision=repo.getRevision();
    await assert.rejects(bound[method](...args),{code:'CONFLICT'});
    assert.deepEqual(await repo.snapshot(),before);assert.equal(repo.getRevision(),revision);
    assert.deepEqual(await createLocalRepository(opts).snapshot(),before);
  });
}
test('explicit local write options override legacy input revision in both directions',async()=>{
  const repo=createLocalRepository(fixture()),p=await repo.savePet(pet('A')),stale=repo.getRevision();await repo.saveProfile({city:'新版'});const current=repo.getRevision();
  await assert.rejects(repo.savePet({id:p.id,name:'旧表单',baseRevision:current},{baseRevision:stale}),{code:'CONFLICT'});
  await repo.savePet({id:p.id,name:'新表单',baseRevision:stale},{baseRevision:current});assert.equal((await repo.snapshot()).pets[0].name,'新表单');
});

test('revision-one pet form cannot overwrite a revision-two local edit',async()=>{
 const repo=createLocalRepository(fixture()),p=await repo.savePet(pet('原名')),getGeneration=()=>0,context=captureFormContext({repository:repo,getGeneration,petId:p.id});assert.equal(context.baseRevision,1);
 await repo.savePet({id:p.id,name:'新名'});assert.equal(repo.getRevision(),2);await assert.rejects(bindFormRepository(repo,context,getGeneration).savePet({id:p.id,name:'过期名'}),{code:'CONFLICT'});assert.equal(repo.getRevision(),2);assert.equal((await repo.snapshot()).pets[0].name,'新名');
});
