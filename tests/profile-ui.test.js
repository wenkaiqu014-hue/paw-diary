import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileEditor,createProfileSaveFlow} from '../src/features/profile.js';

const base={authorId:'author-a',nickname:'合成昵称',bio:'',cityId:null,districtId:null,petTypes:[],purposes:[],discoverable:false,avatarAssetId:null,revision:1};
function fixture(overrides={}){
 let scope={userId:'a',generation:1},saved=[];
 const repository={request:async(action,payload,options)=>{if(action==='profiles.getOwn')return structuredClone(base);if(action==='auth.getOwn')return {email:'fixture@example.test'};if(action==='profiles.saveOwn'){saved.push({payload,options});return {...payload,authorId:'author-a',revision:2};}throw new Error(action);},...overrides};
 return {editor:createProfileEditor({repository,getSession:()=>scope}),saved,setScope:next=>scope=next};
}
test('profile edits are account-level and public preview excludes private email',async()=>{
 const f=fixture();await f.editor.load();assert.equal(f.editor.account().email,'fixture@example.test');
 f.editor.set('nickname','新的合成昵称');assert.equal(f.editor.isDirty(),true);
 assert.equal(f.editor.preview().email,undefined);assert.equal(f.editor.preview().nickname,'新的合成昵称');
 await f.editor.save();assert.equal(f.saved[0].payload.nickname,'新的合成昵称');assert.equal(f.saved[0].options.baseRevision,1);assert.equal(f.editor.isDirty(),false);
});
test('a failed save preserves edits and operation ID for retry',async()=>{
 const calls=[];let fail=true;
 const f=fixture({request:async(action,payload,options)=>{if(action==='profiles.getOwn')return base;if(action==='auth.getOwn')return {email:'fixture@example.test'};calls.push(options.operationId);if(fail){fail=false;throw Object.assign(new Error('offline'),{code:'UNAVAILABLE'});}return {...payload,authorId:'author-a',revision:2};}});
 await f.editor.load();f.editor.set('bio','希望一起交流');await assert.rejects(f.editor.save());
 assert.equal(f.editor.values().bio,'希望一起交流');assert.equal(f.editor.isDirty(),true);
 await f.editor.save();assert.equal(calls[0],calls[1]);
});
test('a late account-A profile load cannot populate account B',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 const f=fixture({request:async action=>action==='profiles.getOwn'?wait:{email:'fixture@example.test'}});
 const pending=f.editor.load();f.setScope({userId:'b',generation:2});release(base);
 await assert.rejects(pending,error=>error.code==='WORKSPACE_CHANGED');assert.equal(f.editor.values().nickname,'');
});
test('changing the body after an uncertain save requires a new operation ID',async()=>{
 const calls=[];const f=fixture({request:async(action,payload,options)=>{if(action==='profiles.getOwn')return base;if(action==='auth.getOwn')return {};calls.push(options.operationId);throw new Error('offline');}});
 await f.editor.load();f.editor.set('nickname','初次尝试');await assert.rejects(f.editor.save());
 f.editor.set('nickname','改过的尝试');await assert.rejects(f.editor.save());assert.notEqual(calls[0],calls[1]);
});
test('conflict review merges explicit edits with the latest unrelated server fields',async()=>{
 let latest=false;const saves=[];
 const f=fixture({request:async(action,payload,options)=>{if(action==='profiles.getOwn')return latest?{...base,nickname:'云端昵称',bio:'云端新简介',revision:2}:base;if(action==='auth.getOwn')return {};saves.push({payload,options});if(!latest){latest=true;throw Object.assign(new Error('conflict'),{code:'CONFLICT'});}return {...payload,revision:3};}});
 await f.editor.load();f.editor.set('nickname','我的修改');await assert.rejects(f.editor.save(),e=>e.code==='CONFLICT');
 const review=await f.editor.reviewLatest();assert.equal(review.latest.bio,'云端新简介');assert.equal(f.editor.values().nickname,'我的修改');
 f.editor.acceptLatestRevision();await f.editor.save();assert.equal(saves[1].options.baseRevision,2);assert.equal(saves[1].payload.nickname,'我的修改');assert.equal(saves[1].payload.bio,'云端新简介');assert.notEqual(saves[0].options.operationId,saves[1].options.operationId);
});
test('avatar upload remains saving and cannot write after account change or disposal',async()=>{
 let owner={userId:'a',generation:1},release,writes=0;
 const editor={set:()=>{},save:async()=>{writes++;return {};}};
 const flow=createProfileSaveFlow({editor,getSession:()=>owner,uploadImage:()=>new Promise(resolve=>release=resolve)});
 const pending=flow.save({file:new Blob(['fixture'])});assert.equal(flow.isSaving(),true);
 owner={userId:'b',generation:2};flow.destroy();release({assetId:'asset-a'});
 await assert.rejects(pending,e=>e.code==='WORKSPACE_CHANGED');assert.equal(writes,0);assert.equal(flow.isSaving(),false);
});

const profileModule=await import('../src/features/profile.js');
function hiddenFixture({request,getSession}={}){assert.equal(typeof profileModule.createHiddenPostsController,'function','hidden posts controller must exist');let scope={userId:'hidden-A',generation:1};const calls=[];const repository={request:request??(async(a,p,o)=>{calls.push({a,p,o});if(a==='community.hidden.list')return{items:p.cursor?[{postId:'p2',title:null,available:false,hiddenAt:'2026-10-07T12:00:00Z'}]:[{postId:'p1',title:'<script>literal</script>',available:true,hiddenAt:'2026-10-07T12:00:00Z'}],nextCursor:p.cursor?null:'next'};return{postId:p.postId,hidden:false};})};return{controller:profileModule.createHiddenPostsController({repository,getSession:getSession??(()=>scope)}),calls,setScope:s=>scope=s};}
test('hidden list paginates owner-only items and recovery uses desired false with operation key',async()=>{const f=hiddenFixture();await f.controller.load();await f.controller.load({more:true});assert.deepEqual(f.controller.getState().items.map(x=>x.postId),['p1','p2']);await f.controller.restore('p1');assert.deepEqual(f.controller.getState().items.map(x=>x.postId),['p2']);const call=f.calls.find(x=>x.a==='community.hide');assert.deepEqual(call.p,{postId:'p1',hidden:false});assert.ok(call.o.operationId);});
test('hidden restore failure keeps row and reuses operation key on retry',async()=>{const keys=[];let fail=true;const f=hiddenFixture({request:async(a,p,o)=>{if(a==='community.hidden.list')return{items:[{postId:'p',title:'保留行',available:true}],nextCursor:null};keys.push(o.operationId);if(fail){fail=false;throw Object.assign(Error('offline'),{code:'UNAVAILABLE'});}return{postId:'p',hidden:false};}});await f.controller.load();await assert.rejects(f.controller.restore('p'));assert.equal(f.controller.getState().items.length,1);await f.controller.restore('p');assert.equal(f.controller.getState().items.length,0);assert.equal(keys[0],keys[1]);});
test('late hidden-A results do not populate B and guests cannot read hidden content',async()=>{let release;const f=hiddenFixture({request:()=>new Promise(r=>release=r)});const pending=f.controller.load().catch(e=>e);f.setScope({userId:'hidden-B',generation:2});release({items:[{postId:'private-A-title',title:'A only'}],nextCursor:null});assert.equal((await pending).code,'WORKSPACE_CHANGED');assert.equal(f.controller.getState().items.length,0);f.setScope({userId:null,generation:3});await assert.rejects(f.controller.load(),e=>e.code==='UNAUTHENTICATED');});
test('busy hidden restoration rejects duplicate requests and ignores destroyed responses',async()=>{let release,count=0;const f=hiddenFixture({request:async(a)=>{if(a==='community.hidden.list')return{items:[{postId:'p',title:'p',available:true}],nextCursor:null};count++;return new Promise(r=>release=r);}});await f.controller.load();const pending=f.controller.restore('p').catch(e=>e);await assert.rejects(f.controller.restore('p'),e=>e.code==='BUSY');assert.equal(count,1);f.controller.destroy();release({postId:'p',hidden:false});assert.equal((await pending).code,'WORKSPACE_CHANGED');});
test('invalid profile is rejected with field detail before a network save and retains edits',async()=>{
 const f=fixture();await f.editor.load();f.editor.set('discoverable',true);
 await assert.rejects(f.editor.save(),e=>e.code==='INVALID_INPUT'&&e.field==='cityId');
 assert.equal(f.saved.length,0);assert.equal(f.editor.values().discoverable,true);assert.equal(f.editor.isDirty(),true);assert.equal(f.editor.isBusy(),false);
});
test('profile flow validates fields before uploading a public image',async()=>{
 const f=fixture();await f.editor.load();f.editor.set('nickname','  ');let uploads=0;
 const flow=createProfileSaveFlow({editor:f.editor,getSession:()=>({userId:'a',generation:1}),uploadImage:async()=>{uploads++;return{assetId:'unneeded-image'};}});
 await assert.rejects(flow.save({file:new Blob(['source'])}),e=>e.code==='INVALID_INPUT'&&e.field==='nickname');assert.equal(uploads,0);assert.equal(flow.isSaving(),false);
});
test('profile feedback is bilingual and unknown server invalid input never invents a field',()=>{
 assert.match(profileModule.profileValidationMessage({code:'INVALID_INPUT',field:'petTypes',messageKey:'profile.petTypes.required'},'zh-CN'),/至少选择一种养宠类别/);
 assert.match(profileModule.profileValidationMessage({code:'INVALID_INPUT',field:'purposes',messageKey:'profile.purposes.required'},'en'),/Select at least one interest/);
 const unknown=profileModule.profileValidationMessage({code:'INVALID_INPUT',field:'nickname',message:'secret payload'},'zh-CN');assert.match(unknown,/当前输入和已有资料均已保留/);assert.equal(unknown.includes('secret payload'),false);
});
