import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppSession} from '../src/app-session.js';
const snapshot=mode=>({version:3,mode,activePetId:null,pets:[],records:[],reminders:[],posts:[],profile:{city:'深圳'}});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function repo(mode){let data=snapshot(mode);return {snapshot:async()=>structuredClone(data),refresh:async()=>structuredClone(data),save:async city=>{data.profile.city=city;},getRevision:()=>0};}
test('switching workspaces replaces identity and keeps independent saved local data',async()=>{
 const local=repo('local'),cloud=repo('account'),session=createAppSession(local);await session.load();
 await session.run(r=>r.save('成都'));await session.switchWorkspace({mode:'account',repository:cloud,principal:{userId:'A'}});
 assert.equal(session.snapshot().mode,'account');assert.equal(session.snapshot().profile.city,'深圳');
 await session.switchWorkspace({mode:'local',repository:local});assert.equal(session.snapshot().profile.city,'成都');assert.equal(session.mode,'local');
});
test('late account response after logout cannot render or overwrite current loading and error state',async()=>{
 const slow=deferred(),local=repo('local');const session=createAppSession(local);await session.load();
 const promise=session.switchWorkspace({mode:'account',repository:{snapshot:()=>slow.promise},principal:{userId:'A'}});
 await Promise.resolve();await session.switchWorkspace({mode:'local',repository:local});slow.resolve(snapshot('account'));
 await promise.catch(()=>{});assert.equal(session.snapshot().mode,'local');assert.equal(session.loading,false);assert.equal(session.error,null);
});
test('queued writes from a replaced generation never execute in another workspace',async()=>{
 const slow=deferred(),local=repo('local'),session=createAppSession(local);await session.load();
 const read=session.run(()=>slow.promise);let executed=false;const write=session.run(r=>{executed=true;return r.save('北京');});
 await Promise.resolve();await session.switchWorkspace({mode:'local',repository:repo('local')});slow.resolve();
 await read.catch(()=>{});await write.catch(()=>{});assert.equal(executed,false);assert.equal(session.snapshot().profile.city,'深圳');
});
test('failed refresh keeps successful cloud state and exposes recoverable error',async()=>{
 const cloud=repo('account'),session=createAppSession(cloud);await session.load();cloud.refresh=async()=>{throw new Error('offline');};
 await assert.rejects(session.refresh(),/offline/);assert.equal(session.snapshot().mode,'account');assert.equal(session.snapshot().profile.city,'深圳');assert.equal(session.error.message,'offline');
});
