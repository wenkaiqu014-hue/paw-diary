import test from 'node:test';
import assert from 'node:assert/strict';
let api;try{api=await import('../src/features/photo-wall.js');}catch{}
const available=()=>assert.ok(api,'photo-wall module must be available');
test('photo picker rejects unsupported images, over 10MiB originals and batches over 10',()=>{
  available();
  assert.throws(()=>api.validatePhotoSelection([{type:'image/gif',size:100}]),e=>e.code==='media_type');
  assert.throws(()=>api.validatePhotoSelection([{type:'image/png',size:10*1024*1024+1}]),e=>e.code==='media_size');
  assert.throws(()=>api.validatePhotoSelection(Array.from({length:11},()=>({type:'image/jpeg',size:100}))),e=>e.code==='batch_limit');
  assert.equal(api.validatePhotoSelection([{type:'image/webp',size:10*1024*1024}]).length,1);
});
test('photo session shows only current-pet photo assets and releases every URL on pet switch',async()=>{
  available();let pet='a',released=[];
  const media={list:async()=>({items:[{id:'a-photo',petId:'a',kind:'photo'},{id:'a-avatar',petId:'a',kind:'avatar'},{id:'b-photo',petId:'b',kind:'photo'}]}),resolveUrl:async id=>({url:'blob:'+id,release:()=>released.push(id)})};
  const session=api.createPhotoSession({media,getPetId:()=>pet,getGeneration:()=>0});
  await session.load();assert.deepEqual(session.items.map(a=>a.id),['a-photo']);
  await session.resolve('a-photo');pet='b';await session.load();assert.deepEqual(released,['a-photo']);
  assert.deepEqual(session.items.map(a=>a.id),['b-photo']);session.destroy();
});
test('old-generation asynchronous URL resolves are released and never exposed',async()=>{
  available();let generation=0,releaseCount=0,complete;
  const media={list:async()=>({items:[{id:'p',petId:'a',kind:'photo'}]}),resolveUrl:()=>new Promise(resolve=>complete=resolve)};
  const session=api.createPhotoSession({media,getPetId:()=> 'a',getGeneration:()=>generation});await session.load();
  const pending=session.resolve('p');generation++;complete({url:'blob:private-old',release:()=>releaseCount++});
  assert.equal(await pending,null);assert.equal(releaseCount,1);assert.equal(session.getUrl('p'),null);
});
test('failed photo reads remain retryable and resolved URLs are reused until release',async()=>{
  available();let attempts=0,released=0;
  const session=api.createPhotoSession({media:{list:async()=>({items:[{id:'p',petId:'a',kind:'photo'}]}),resolveUrl:async()=>{attempts++;if(attempts===1)throw Error('offline');return {url:'blob:okay',release:()=>released++};}},getPetId:()=> 'a'});
  await session.load();await assert.rejects(session.resolve('p'),/offline/);assert.equal(await session.resolve('p'),'blob:okay');assert.equal(await session.resolve('p'),'blob:okay');assert.equal(attempts,2);session.destroy();session.destroy();assert.equal(released,1);
});
test('pagination retains stable order and stale list response cannot replace new pet photos',async()=>{
  available();let pet='a',finish;
  const media={list:async({petId,cursor})=>{if(petId==='a')return new Promise(resolve=>finish=resolve);return cursor?{items:[{id:'b2',petId:'b',kind:'photo'}],nextCursor:null}:{items:[{id:'b1',petId:'b',kind:'photo'}],nextCursor:'b1'};}};
  const session=api.createPhotoSession({media,getPetId:()=>pet});const old=session.load();pet='b';await session.load();finish({items:[{id:'a1',petId:'a',kind:'photo'}]});await old;assert.deepEqual(session.items.map(a=>a.id),['b1','b2']);
});
test('explicit URL release also invalidates pending reads when slideshow closes',async()=>{
  available();let complete,releases=0;
  const session=api.createPhotoSession({media:{list:async()=>({items:[{id:'p',petId:'a',kind:'photo'}]}),resolveUrl:()=>new Promise(resolve=>complete=resolve)},getPetId:()=> 'a'});
  await session.load();const pending=session.resolve('p');session.releaseAll();complete({url:'blob:after-close',release:()=>releases++});
  assert.equal(await pending,null);assert.equal(releases,1);assert.equal(session.getUrl('p'),null);
});
