import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';const require=createRequire(import.meta.url);
let createAuthService,createAuthStore;
try{({createAuthService,createAuthStore}=require('../backend/email-auth.cjs'));}catch{}
function fixture(){let seq=0,now=Date.parse('2026-10-07T02:00:00Z');const docs=new Map(),tx=async fn=>fn({get:async(k)=>structuredClone(docs.get(k)),put:async(k,v)=>docs.set(k,structuredClone(v)),remove:async k=>docs.delete(k)});const calls=[];
const platform={send:async email=>{calls.push({send:email});return{verification_id:'platform-id',is_user:true};},verify:async(id,code)=>{calls.push({id,code});return{verification_token:'platform-proof'};},sign:async(input)=>{calls.push(input);return{sub:'A',access_token:'issued-A',refresh_token:'issued-refresh'};},profile:async()=>({sub:'A',email:'a@example.test'})};
return{docs,calls,platform,advance:n=>now+=n,service:()=>createAuthService({store:{transaction:tx},platform,clock:()=>now,idFactory:()=>`nonce-${++seq}`}),request:{action:'auth.requestEmailCode',payload:{email:'a@example.test'}},context:{ip:'127.0.0.1'}};}
test('server owns platform verification evidence and issues proof only after matching signed UID and challenge email',async()=>{const f=fixture(),s=f.service(),challenge=await s.handle(f.request,f.context);assert.equal(challenge.ok,true);const result=await s.handle({action:'auth.verifyEmailCode',payload:{id:challenge.data.id,code:'123456',email_verified:true,ownerId:'forged'}},f.context);assert.equal(result.ok,true);assert.deepEqual(result.data.principal,{userId:'A'});assert.equal(f.calls[2].verification_token,'platform-proof');const proof=[...f.docs.values()].find(d=>d.kind==='verified');assert.equal(proof.ownerId,'A');assert.equal(typeof proof.emailHash,'string');assert.equal(JSON.stringify([...f.docs.values()]).includes('issued-A'),false);assert.equal(JSON.stringify([...f.docs.values()]).includes('123456'),false);const again=await s.handle({action:'auth.verifyEmailCode',payload:{id:challenge.data.id,code:'123456'}},f.context);assert.equal(again.ok,false);});
test('server rejects profile/session mismatch, non-verified attempts and excess requests before mail',async()=>{const f=fixture(),s=f.service();for(let i=0;i<3;i++){assert.equal((await s.handle(f.request,f.context)).ok,true);f.advance(60000);}assert.equal((await s.handle(f.request,f.context)).ok,false);assert.equal(f.calls.length,3);const id=[...f.docs.values()].find(d=>d.kind==='challenge').id;f.platform.profile=async()=>({sub:'B',email:'a@example.test'});assert.equal((await s.handle({action:'auth.verifyEmailCode',payload:{id,code:'123456'}},f.context)).ok,false);assert.equal([...f.docs.values()].some(d=>d.kind==='verified'),false);});
test('challenge lease excludes concurrent verifiers and stops after five failed codes',async()=>{const f=fixture(),s=f.service(),c=await s.handle(f.request,f.context);f.platform.verify=async()=>{throw Object.assign(Error('bad'),{code:'INVALID_INPUT'});};for(let i=0;i<5;i++)assert.equal((await s.handle({action:'auth.verifyEmailCode',payload:{id:c.data.id,code:'123456'}},f.context)).ok,false);let calls=0;f.platform.verify=async()=>{calls++;return{verification_token:'x'};};assert.equal((await s.handle({action:'auth.verifyEmailCode',payload:{id:c.data.id,code:'123456'}},f.context)).ok,false);assert.equal(calls,0);});
test('trusted platform UID plus server proof replaces absent optional raw bool, mismatched email proof never grants',async()=>{const {resolvePrincipal}=require('../backend/identity.cjs');const {emailHash}=require('../backend/email-auth.cjs');const options={auth:{getAuthContext:async()=>({uid:'A'}),getUserInfo:()=>({uid:'A',isAnonymous:false})},authToken:'credential',readVerifiedProfile:async()=>({sub:'A',email:'a@example.test'}),readVerifiedProof:async()=>({kind:'verified',ownerId:'A',emailHash:emailHash('a@example.test'),verifiedAt:'2026-10-07T02:00:00Z'})};assert.equal((await resolvePrincipal({},options))?.userId,'A');options.readVerifiedProfile=async()=>({sub:'A',email:'changed@example.test'});assert.equal(await resolvePrincipal({},options),null);});

test('official signed session without optional sub binds proof to fixed Bearer profile UID',async()=>{const f=fixture(),s=f.service(),c=await s.handle(f.request,f.context);f.platform.sign=async()=>({access_token:'issued',refresh_token:'refresh'});const r=await s.handle({action:'auth.verifyEmailCode',payload:{id:c.data.id,code:'123456'}},f.context);assert.equal(r.ok,true);assert.equal(r.data.principal.userId,'A');});
test('real transaction document get object and query array both unwrap stored proof values',async()=>{for(const shape of ['object','array']){const value={kind:'challenge',id:'nonce'};const doc={_id:'opaque',value};const db={runTransaction:async fn=>fn({collection:()=>({doc:()=>({get:async()=>({data:shape==='object'?doc:[doc]})})})})};const store=createAuthStore({db});assert.deepEqual(await store.transaction(tx=>tx.get('c:nonce')),value);}});

for(const [name,flag,path] of [['missing',undefined,'signup'],['null',null,'signup'],['false',false,'signup'],['true',true,'signin']]){
 test(`optional is_user ${name} selects ${path} only after platform code verification and binds proof`,async()=>{
  const {createEmailPlatform,emailHash}=require('../backend/email-auth.cjs'),f=fixture(),httpCalls=[];
  Object.assign(f.platform,createEmailPlatform({environmentId:'synthetic-test',publishableKey:'synthetic-public-key',fetch:async(url,options)=>{
   const endpoint=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;httpCalls.push({endpoint,body});
   let response;
   if(endpoint==='/auth/v1/verification')response={verification_id:'platform-id',...(flag===undefined?{}:{is_user:flag})};
   else if(endpoint==='/auth/v1/verification/verify'){
    assert.deepEqual(body,{verification_id:'platform-id',verification_code:'123456'});response={verification_token:'platform-proof'};
   }else if(endpoint===`/auth/v1/${path}`){
    assert.deepEqual(body,path==='signup'?{email:'a@example.test',verification_token:'platform-proof'}:{username:'a@example.test',verification_token:'platform-proof'});
    response={sub:'A',access_token:'issued-A',refresh_token:'issued-refresh'};
   }else if(endpoint==='/auth/v1/user/me'){
    assert.equal(options.headers.Authorization,'Bearer issued-A');response={sub:'A',email:'a@example.test'};
   }else throw Error('Unexpected platform endpoint');
   return Response.json(response);
  }}));
  const s=f.service(),challenge=await s.handle(f.request,f.context);assert.equal(challenge.ok,true);
  assert.equal(f.docs.get('c:'+challenge.data.id).isUser,flag===true);
  const result=await s.handle({action:'auth.verifyEmailCode',payload:{id:challenge.data.id,code:'123456'}},f.context);
  assert.deepEqual(result.data?.principal,{userId:'A'});
  assert.deepEqual(httpCalls.map(call=>call.endpoint),['/auth/v1/verification','/auth/v1/verification/verify',`/auth/v1/${path}`,'/auth/v1/user/me']);
  assert.deepEqual(f.docs.get('p:A'),{kind:'verified',ownerId:'A',emailHash:emailHash('a@example.test'),verifiedAt:'2026-10-07T02:00:00.000Z'});
 });
}

test('optional is_user still rejects non-boolean non-null values and malformed verification IDs',async()=>{
 for(const response of [{verification_id:'platform-id',is_user:'false'},{verification_id:'platform-id',is_user:'true'},{verification_id:'platform-id',is_user:0},{verification_id:'platform-id',is_user:1},{verification_id:'platform-id',is_user:{}},{verification_id:'platform-id',is_user:[]},{verification_id:''},{verification_id:null},{is_user:null},{verification_id:42}]){
  const f=fixture();f.platform.send=async()=>response;
  assert.deepEqual(await f.service().handle(f.request,f.context),{ok:false,error:{code:'UNAVAILABLE',messageKey:'errors.unavailable'}});
  assert.equal([...f.docs.values()].some(doc=>doc.kind==='challenge'),false);
 }
});

for(const failure of ['missing verified token','foreign profile UID','foreign profile email']){
 test(`new-user signup with ${failure} never stores verified identity proof`,async()=>{
  const f=fixture();f.platform.send=async()=>({verification_id:'platform-id'});
  if(failure==='missing verified token')f.platform.verify=async()=>({});
  else if(failure==='foreign profile UID')f.platform.profile=async()=>({sub:'B',email:'a@example.test'});
  else f.platform.profile=async()=>({sub:'A',email:'foreign@example.test'});
  const s=f.service(),challenge=await s.handle(f.request,f.context);assert.equal(challenge.ok,true);
  const result=await s.handle({action:'auth.verifyEmailCode',payload:{id:challenge.data.id,code:'123456'}},f.context);
  assert.equal(result.ok,false);assert.equal([...f.docs.values()].some(doc=>doc.kind==='verified'),false);
  if(failure==='missing verified token')assert.equal(f.calls.some(call=>Object.hasOwn(call,'verification_token')),false);
 });
}
