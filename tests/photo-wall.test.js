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

test('photo wall exposes draft and saving guards without opening or writing any data',()=>{
 available();let reads=0,writes=0;
 const wall=api.createPhotoWall({media:{list:async()=>{reads++;return[];},save:async()=>writes++},getPetId:()=> 'a',t:key=>key});
 assert.equal(wall.hasUnsavedChanges(),false);
 assert.equal(wall.isSaving(),false);
 wall.destroy();assert.equal(wall.hasUnsavedChanges(),false);
 assert.equal(reads,0);assert.equal(writes,0);
});

// Small DOM adapter for lifecycle assertions; the separate Chrome test covers native DOM/focus.
function photoWallDom(){
 const document={};
 class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.listeners=new Map();this.attributes=new Map();this.value='';}
  append(...children){for(const child of children){child.remove();child.parentElement=this;this.children.push(child);}}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}}
  replaceChildren(...children){for(const child of [...this.children])child.remove();this.append(...children);}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  removeAttribute(key){this.attributes.delete(key);}
  addEventListener(type,handler){this.listeners.set(type,[...(this.listeners.get(type)??[]),handler]);}
  async dispatch(type){for(const handler of this.listeners.get(type)??[])await handler({preventDefault(){},target:this});}
  contains(node){return this===node||this.children.some(child=>child.contains(node));}
  get isConnected(){return document.body.contains(this);}
  focus(){document.activeElement=this;}
  select(){}
  get dataset(){return this._dataset??={};}
 }
 document.createElement=tag=>new Element(tag);document.body=new Element('body');document.activeElement=document.body;
 const find=(className,node=document.body)=>node.className===className?node:node.children.map(child=>find(className,child)).find(Boolean);
 const host=document.createElement('div');document.body.append(host);return {document,host,find};
}

test('photo rename stays mounted with its draft across render and cancel clears the guard',async()=>{
 available();const dom=photoWallDom();let locale='zh',writes=0;
 const media={list:async()=>({items:[{id:'photo',petId:'a',kind:'photo',displayName:'original.png'}]}),resolveUrl:async()=>({url:'synthetic'}),rename:async()=>writes++};
 const wall=api.createPhotoWall({media,getPetId:()=> 'a',t:key=>locale+':'+key,document:dom.document});
 await wall.mount(dom.host);await dom.find('text-button').dispatch('click');
 const editor=dom.find('paw-photo-rename'),input=dom.find('paw-photo-rename-input');input.value='unsaved original user name';
 locale='en';await wall.render();
 assert.equal(dom.find('paw-photo-rename'),editor,'same draft editor must be visible after render');
 assert.equal(dom.find('paw-photo-rename-input').value,'unsaved original user name');
 assert.equal(input.attributes.get('aria-label'),'en:photo.name');assert.equal(wall.hasUnsavedChanges(),true);
 const cancel=editor.children.find(child=>child.tagName==='BUTTON'&&child.type==='button');
 assert.equal(cancel.textContent,'en:common.cancel');await cancel.dispatch('click');
 assert.equal(dom.find('paw-photo-rename'),undefined);assert.equal(wall.hasUnsavedChanges(),false);assert.equal(writes,0);wall.destroy();
});

test('deleted renamed asset clears both its visible editor and unsaved guard',async()=>{
 available();const dom=photoWallDom();let items=[{id:'photo',petId:'a',kind:'photo',displayName:'original.png'}];
 const wall=api.createPhotoWall({media:{list:async()=>({items}),resolveUrl:async()=>({url:'synthetic'})},getPetId:()=> 'a',t:key=>key,document:dom.document});
 await wall.mount(dom.host);await dom.find('text-button').dispatch('click');dom.find('paw-photo-rename-input').value='removed asset draft';
 items=[];await wall.render();assert.equal(dom.find('paw-photo-rename'),undefined);assert.equal(wall.hasUnsavedChanges(),false);wall.destroy();
});
