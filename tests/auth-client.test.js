import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudbaseAuth} from '../src/auth/cloudbase-auth.js';
function fixture(){
 let user={id:'A',email:'synthetic@example.invalid',is_anonymous:false},raw={sub:'A',email:user.email},token='issued-A',event,proof='A',sets=0;const calls=[];
 const sdk={getSession:async()=>({data:{user,session:{user,access_token:token}},error:null}),getUser:async()=>({data:{user},error:null}),getUserInfo:async()=>raw,setSession:async session=>{sets++;token=session.access_token;return {data:{user,session:{...session,user}},error:null};},signOut:async()=>{},onAuthStateChange:fn=>{event=fn;return {data:{subscription:{unsubscribe(){}}}};}};
 const invokeAuth=async request=>{calls.push(request);if(request.action==='auth.requestEmailCode')return {ok:true,data:{id:'server-challenge'}};if(request.action==='auth.verifyEmailCode')return {ok:true,data:{session:{access_token:'issued-A',refresh_token:'refresh-A'},principal:{userId:'A'}}};if(request.action==='auth.session')return proof?{ok:true,data:{principal:{userId:proof}}}:{ok:false,error:{code:'UNAUTHENTICATED'}};throw Error('Unexpected action');};
 return {sdk,invokeAuth,calls,get sets(){return sets;},setProof:value=>proof=value,setToken:value=>token=value,setRaw:value=>raw=value,setUser:value=>user=value,emit:(...args)=>event(...args)};
}
test('server OTP transport installs issued session then obtains authoritative proof without fabricating optional verified flag',async()=>{
 const f=fixture(),auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth:f.invokeAuth});const challenge=await auth.requestEmailCode({email:'synthetic@example.invalid'});
 assert.deepEqual(challenge,{id:'server-challenge'});assert.deepEqual(await auth.verifyEmailCode({challenge,code:'123456'}),{userId:'A'});assert.equal(f.sets,1);
 assert.deepEqual(f.calls.map(x=>x.action),['auth.requestEmailCode','auth.verifyEmailCode','auth.session']);assert.deepEqual(f.calls[1].payload,{id:'server-challenge',code:'123456'});
 assert.equal(f.calls[2].authToken,'issued-A');assert.deepEqual(f.calls[2].payload,{});assert.deepEqual(await auth.getRequestSession(),{principal:{userId:'A'},authToken:'issued-A'});
});
test('optional raw flag plus UID/email alone never authorizes without server proof',async()=>{
 const f=fixture();f.setProof(null);const auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth:f.invokeAuth});await assert.rejects(auth.getSession(),{code:'UNAUTHENTICATED'});
 assert.equal(await createCloudbaseAuth({app:{auth:()=>f.sdk}}).getSession(),null);f.setProof('B');assert.equal(await auth.getSession(),null);
 f.setRaw({sub:'B',email:'synthetic@example.invalid'});f.setProof('A');assert.equal(await auth.getRequestSession(),null);
});
test('server proof transport preserves same-user transient errors and clears old identity immediately on UID switch',async()=>{
 const f=fixture(),auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth:async request=>{if(request.action==='auth.session'&&offline)throw Error('network');return f.invokeAuth(request);}});let offline=false;
 await auth.getSession();const seen=[];auth.subscribe(x=>seen.push(x));offline=true;f.emit('TOKEN_REFRESHED',{user:{id:'A',email:'synthetic@example.invalid',is_anonymous:false},access_token:'issued-A'});await new Promise(r=>setTimeout(r,0));assert.deepEqual(seen,[]);
 f.setUser({id:'B',email:'b@example.invalid',is_anonymous:false});f.setRaw({sub:'B',email:'b@example.invalid'});f.emit('SIGNED_IN',{user:{id:'B',email:'b@example.invalid',is_anonymous:false},access_token:'issued-B'});await new Promise(r=>setTimeout(r,0));assert.deepEqual(seen,[null]);
});
test('a server verification response with a foreign principal cannot confirm the SDK user',async()=>{
 const f=fixture(),auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth:async request=>request.action==='auth.verifyEmailCode'?{ok:true,data:{session:{access_token:'issued-A',refresh_token:'refresh-A'},principal:{userId:'B'}}}:f.invokeAuth(request)});
 const challenge=await auth.requestEmailCode({email:'synthetic@example.invalid'});await assert.rejects(auth.verifyEmailCode({challenge,code:'123456'}),{code:'UNAUTHENTICATED'});
});

test('late A server verification cannot install its session after B becomes current',async()=>{
 const f=fixture();let resolveVerify;const auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth:async request=>request.action==='auth.verifyEmailCode'?new Promise(resolve=>resolveVerify=resolve):f.invokeAuth(request)});
 await auth.getSession();auth.subscribe(()=>{});const challenge=await auth.requestEmailCode({email:'synthetic@example.invalid'}),pending=auth.verifyEmailCode({challenge,code:'123456'});await new Promise(r=>setTimeout(r,0));
 f.setUser({id:'B',email:'b@example.invalid',is_anonymous:false});f.setRaw({sub:'B',email:'b@example.invalid'});f.setToken('issued-B');f.setProof('B');f.emit('SIGNED_IN',{user:{id:'B',email:'b@example.invalid',is_anonymous:false},access_token:'issued-B'});
 resolveVerify({ok:true,data:{session:{access_token:'issued-A',refresh_token:'refresh-A'},principal:{userId:'A'}}});await assert.rejects(pending,{code:'UNAUTHENTICATED'});
 assert.equal((await f.sdk.getSession()).data.session.access_token,'issued-B');assert.deepEqual(await auth.getSession(),{userId:'B'});
});

for(const oldUser of [null,{id:'OLD',email:'old@example.invalid',is_anonymous:false}]){
 test(`verification refreshes normalized SDK cache after setSession instead of retaining ${oldUser?'old UID':'empty user'}`,async()=>{
  const f=fixture(),fresh={id:'A',email:'synthetic@example.invalid',is_anonymous:false};let user=oldUser,token=null;
  f.sdk.getSession=async()=>({data:{user,session:token?{access_token:token,user}:null},error:null});
  f.sdk.setSession=async input=>{token=input.access_token;return {data:{user,session:{...input,user}},error:null};};
  f.sdk.getUser=async force=>{if(force===true)user=fresh;return {data:{user},error:null};};
  // The real raw getter refreshes data, but the old normalized user already passed
  // into checked() remains a separate immutable null/OLD value.
  f.sdk.getUserInfo=async()=>{user=fresh;return {sub:'A',email:fresh.email};};
  const auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth:f.invokeAuth}),challenge=await auth.requestEmailCode({email:fresh.email});
  assert.deepEqual(await auth.verifyEmailCode({challenge,code:'123456'}),{userId:'A'});
  assert.deepEqual(await auth.getRequestSession(),{principal:{userId:'A'},authToken:'issued-A'});
 });
}

test('issued session metadata reaches SDK refresh while untrusted response fields stay out',async()=>{
 const f=fixture(),metadata={token_type:'Bearer',version:'v2',scope:'user',expires_at:'2026-10-07T04:00:00.000Z',expires_in:3600};let installed;
 const original=f.sdk.setSession;f.sdk.setSession=async session=>{installed=session;if(session.version!=='v2')return {data:{user:null,session:null},error:{error:'unauthorized_client'}};return original(session);};
 const invokeAuth=async request=>request.action==='auth.verifyEmailCode'?{ok:true,data:{session:{access_token:'issued-A',refresh_token:'refresh-A',...metadata,email_verified:true,userId:'forged',client_id:'forged'},principal:{userId:'A'}}}:f.invokeAuth(request);
 const auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth}),challenge=await auth.requestEmailCode({email:'synthetic@example.invalid'});
 assert.deepEqual(await auth.verifyEmailCode({challenge,code:'123456'}),{userId:'A'});
 assert.deepEqual(installed,{access_token:'issued-A',refresh_token:'refresh-A',...metadata});
});
