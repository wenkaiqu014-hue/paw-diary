import test from 'node:test';
import assert from 'node:assert/strict';
import {collectVerifiedSession} from '../scripts/lib/capture-session.mjs';

test('capture refreshes stale SDK user and binds current bearer to raw and trusted identities',async()=>{
 const calls=[];
 const auth={getUser:async refresh=>{calls.push(['user',refresh]);return {data:{user:{id:'current',is_anonymous:false}}};},getSession:async()=>{calls.push(['session']);return {data:{user:{id:'stale'},session:{access_token:'latest',refresh_token:'refresh',version:'v2',scope:'user'}}};}};
 const result=await collectVerifiedSession({auth,config:{env:'fixture'},label:'A',fetchProfile:async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer latest');return {ok:true,json:async()=>({sub:'current',email:'fixture@example.invalid'})};},serverCall:async(action,payload,token)=>{assert.equal(token,'latest');return {principal:{userId:'current'}};}});
 assert.deepEqual(calls,[['user',true],['session']]);assert.equal(result.emailVerified,true);assert.equal(result.session.version,'v2');
});

test('capture rejects trusted server mismatch even when SDK and raw profile agree',async()=>{
 const auth={getUser:async()=>({data:{user:{id:'current',is_anonymous:false}}}),getSession:async()=>({data:{session:{access_token:'latest',refresh_token:'refresh'}}})};
 await assert.rejects(collectVerifiedSession({auth,config:{env:'fixture'},label:'B',fetchProfile:async()=>({ok:true,json:async()=>({sub:'current',email:'fixture@example.invalid'})}),serverCall:async()=>({principal:{userId:'other'}})}),{code:'ACCEPTANCE_IDENTITY_NOT_VERIFIED'});
});
