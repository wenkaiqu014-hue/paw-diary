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

test('same-user SDK event after setSession receipt while refreshing the fresh user still verifies',async()=>{
 const f=fixture(),original=f.sdk.getUser;
 f.sdk.getUser=async force=>{await Promise.resolve();void f.emit('SIGNED_IN',{user:{id:'A',email:'synthetic@example.invalid',is_anonymous:false},access_token:'issued-A'});return original(force);};
 const auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth:f.invokeAuth});auth.subscribe(()=>{});
 const challenge=await auth.requestEmailCode({email:'synthetic@example.invalid'});
 assert.deepEqual(await auth.verifyEmailCode({challenge,code:'123456'}),{userId:'A'});
});

function pendingSessionProof(){
 const f=fixture();let entered,release,wait=true;
 const proofStarted=new Promise(resolve=>entered=resolve),proofGate=new Promise(resolve=>release=resolve);
 const auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth:async request=>{
  if(request.action==='auth.session'&&wait){wait=false;entered();await proofGate;}
  return f.invokeAuth(request);
 }});auth.subscribe(()=>{});
 return {f,auth,proofStarted,release};
}

test('same-user SIGNED_IN and TOKEN_REFRESHED delivered during server proof do not reject verification',async()=>{
 const {f,auth,proofStarted,release}=pendingSessionProof(),challenge=await auth.requestEmailCode({email:'synthetic@example.invalid'});
 const pending=auth.verifyEmailCode({challenge,code:'123456'});await proofStarted;
 void f.emit('SIGNED_IN',{user:{id:'A',email:'synthetic@example.invalid',is_anonymous:false},access_token:'issued-A'});
 void f.emit('TOKEN_REFRESHED',{user:{id:'A',email:'synthetic@example.invalid',is_anonymous:false},access_token:'issued-A'});
 release();assert.deepEqual(await pending,{userId:'A'});
});

for(const interruption of ['different UID','signed out','different UID then original UID','explicit signOut without SDK event']){
 test(`${interruption} during server proof invalidates pending email verification`,async()=>{
  const {f,auth,proofStarted,release}=pendingSessionProof(),challenge=await auth.requestEmailCode({email:'synthetic@example.invalid'});
  const pending=auth.verifyEmailCode({challenge,code:'123456'});await proofStarted;
  if(interruption==='explicit signOut without SDK event')await auth.signOut();
  else if(interruption==='signed out'){f.setUser(null);void f.emit('SIGNED_OUT',null);}
  else{
   f.setUser({id:'B',email:'b@example.invalid',is_anonymous:false});f.setRaw({sub:'B',email:'b@example.invalid'});f.setToken('issued-B');f.setProof('B');
   void f.emit('SIGNED_IN',{user:{id:'B',email:'b@example.invalid',is_anonymous:false},access_token:'issued-B'});
   if(interruption==='different UID then original UID'){
    f.setUser({id:'A',email:'synthetic@example.invalid',is_anonymous:false});f.setRaw({sub:'A',email:'synthetic@example.invalid'});f.setToken('issued-A');f.setProof('A');
    void f.emit('TOKEN_REFRESHED',{user:{id:'A',email:'synthetic@example.invalid',is_anonymous:false},access_token:'issued-A'});
   }
  }
  release();await assert.rejects(pending,{code:'UNAUTHENTICATED'});
 });
}

test('beta auth refuses missing gateway even for already SDK-verified identity',()=>{
 const f=fixture();f.setRaw({sub:'A',email:'synthetic@example.invalid',email_verified:true});
 assert.throws(()=>createCloudbaseAuth({app:{auth:()=>f.sdk},betaRequired:true}),{code:'BETA_CONFIG_INVALID'});
});
test('beta auth validates before transport and sends leading-zero beta value through both OTP actions',async()=>{
 const f=fixture(),auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth:f.invokeAuth,betaRequired:true});
 await assert.rejects(auth.requestEmailCode({email:'synthetic@example.invalid'}),{code:'BETA_CODE_REQUIRED'});
 await assert.rejects(auth.requestEmailCode({email:'synthetic@example.invalid',betaCode:'12345'}),{code:'BETA_CODE_INVALID'});
 assert.equal(f.calls.length,0);
 const challenge=await auth.requestEmailCode({email:'synthetic@example.invalid',betaCode:'012349'});
 await assert.rejects(auth.verifyEmailCode({challenge,code:'123456'}),{code:'BETA_CODE_REQUIRED'});
 assert.deepEqual(await auth.verifyEmailCode({challenge,code:'123456',betaCode:'012349'}),{userId:'A'});
 assert.deepEqual(f.calls[0].payload,{email:'synthetic@example.invalid',betaCode:'012349'});
 assert.deepEqual(f.calls[1].payload,{id:'server-challenge',code:'123456',betaCode:'012349'});
});
for(const code of ['BETA_CODE_REQUIRED','BETA_CODE_INVALID','BETA_ACCESS_REQUIRED','BETA_CONFIG_INVALID','RATE_LIMITED']){
 test(`auth preserves reviewed ${code} from rejection envelopes without exposing arbitrary details`,async()=>{
  const f=fixture(),auth=createCloudbaseAuth({app:{auth:()=>f.sdk},betaRequired:true,invokeAuth:async()=>({ok:false,error:{code,status:401,private:'secret'}})});
  await assert.rejects(auth.requestEmailCode({email:'synthetic@example.invalid',betaCode:'012349'}),error=>error.code===code&&!JSON.stringify(error).includes('secret'));
 });
}
test('beta session access always asks gateway and preserves missing admission rejection',async()=>{
 const f=fixture();f.setRaw({sub:'A',email:'synthetic@example.invalid',email_verified:true});
 const auth=createCloudbaseAuth({app:{auth:()=>f.sdk},betaRequired:true,invokeAuth:async()=>({ok:false,error:{code:'BETA_ACCESS_REQUIRED'}})});
 await assert.rejects(auth.getSession(),{code:'BETA_ACCESS_REQUIRED'});
 await assert.rejects(auth.getRequestSession(),{code:'BETA_ACCESS_REQUIRED'});
});

test('beta rate errors retain only bounded reviewed retry seconds',async()=>{
 const f=fixture();
 for(const value of [60,-1,86401,'private-token']){
  const auth=createCloudbaseAuth({app:{auth:()=>f.sdk},invokeAuth:async()=>({ok:false,error:{code:'RATE_LIMITED',params:{retryAfterSeconds:value,private:'secret'}}})});
  await assert.rejects(auth.requestEmailCode({email:'synthetic@example.invalid'}),error=>{assert.deepEqual(error.params,value===60?{retryAfterSeconds:60}:undefined);assert.equal(JSON.stringify(error).includes('secret'),false);return error.code==='RATE_LIMITED';});
 }
});
test('beta admission denial clears a previously confirmed subscribed identity',async()=>{
 const f=fixture();let denied=false;const auth=createCloudbaseAuth({app:{auth:()=>f.sdk},betaRequired:true,invokeAuth:async input=>denied?{ok:false,error:{code:'BETA_ACCESS_REQUIRED'}}:f.invokeAuth(input)});
 await auth.getSession();const seen=[];auth.subscribe(value=>seen.push(value));denied=true;
 await f.emit('TOKEN_REFRESHED',{user:{id:'A',email:'synthetic@example.invalid',is_anonymous:false},access_token:'issued-A'});
 assert.deepEqual(seen,[null]);
});
