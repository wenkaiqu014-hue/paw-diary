import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createAuthService,emailHash}=require('../backend/email-auth.cjs');
const {resolvePrincipal}=require('../backend/identity.cjs');
let readBetaPolicy;
try { ({readBetaPolicy}=require('../backend/beta-access.cjs')); } catch {}
const active={enabled:true,inviteCode:'012349',fingerprint:'synthetic-policy-v1'};
const disabled={enabled:false,fingerprint:'synthetic-disabled'};
const admission={version:1,grantedAt:'2026-10-07T00:00:00.000Z',source:'legacy'};
function fixture(policy=active) {
 let now=Date.parse('2026-10-08T07:40:50.000Z'),seq=0,queue=Promise.resolve();
 const docs=new Map(),calls=[];
 const store={transaction(fn){const run=queue.then(async()=>{const pending=new Map(structuredClone([...docs]));const r=await fn({get:async k=>structuredClone(pending.get(k)),put:async(k,v)=>pending.set(k,structuredClone(v)),remove:async k=>pending.delete(k)});docs.clear();for(const[k,v]of pending)docs.set(k,v);return r;});queue=run.catch(()=>{});return run;}};
 const platform={send:async email=>{calls.push(['send',email]);return{verification_id:'remote',is_user:true};},verify:async()=>{calls.push(['verify']);return{verification_token:'verified'};},sign:async()=>({access_token:'session',refresh_token:'refresh',sub:'A'}),profile:async()=>({sub:'A',email:'a@example.test'})};
 const service=betaPolicy=>createAuthService({store,platform,betaPolicy,clock:()=>now,idFactory:()=>`challenge-${++seq}`});
 const s=service(policy),request=(email='a@example.test',betaCode='012349',ip='127.0.0.1')=>s.handle({action:'auth.requestEmailCode',payload:{email,betaCode}},{ip});
 return{docs,calls,platform,service,s,request,advance:n=>now+=n,verify:(id,betaCode='012349')=>s.handle({action:'auth.verifyEmailCode',payload:{id,code:'123456',betaCode}},{ip:'127.0.0.1'})};
}
function identityOptions(profile={sub:'A',email:'a@example.test',email_verified:true},proof=null){return{auth:{getAuthContext:async()=>({uid:'A'}),getUserInfo:()=>({uid:'A',isAnonymous:false}),getEndUserInfo:async()=>({userInfo:profile})},authToken:'credential',readVerifiedProfile:async()=>profile,readVerifiedProof:async()=>proof,betaPolicy:active};}
const proof=(extra={})=>({kind:'verified',ownerId:'A',emailHash:emailHash('a@example.test'),verifiedAt:'2026-10-07T00:00:00Z',...extra});
test('production policy fails closed for absent/malformed switches and auth requires a six-digit string',()=>{
 assert.equal(typeof readBetaPolicy,'function');
 for(const env of [{},{PAW_BETA_GATE_ENABLED:'yes'},{PAW_BETA_GATE_ENABLED:true}])assert.throws(()=>readBetaPolicy(env),e=>e.code==='BETA_CONFIG_INVALID');
 for(const code of [undefined,'12345','1234567',123456,'12 456'])assert.throws(()=>readBetaPolicy({PAW_BETA_GATE_ENABLED:'true',PAW_BETA_INVITE_CODE:code},{requireInviteCode:true}),e=>e.code==='BETA_CONFIG_INVALID');
 assert.equal(readBetaPolicy({PAW_BETA_GATE_ENABLED:'false'},{requireInviteCode:true}).enabled,false);
 assert.equal(readBetaPolicy({PAW_BETA_GATE_ENABLED:'true'}).enabled,true);
 const a=readBetaPolicy({PAW_BETA_GATE_ENABLED:'true',PAW_BETA_INVITE_CODE:'012349'},{requireInviteCode:true});
 assert.equal(a.inviteCode,'012349');assert.equal(a.fingerprint.includes('012349'),false);
 assert.notEqual(a.fingerprint,readBetaPolicy({PAW_BETA_GATE_ENABLED:'true',PAW_BETA_INVITE_CODE:'012348'},{requireInviteCode:true}).fingerprint);
});
test('missing and wrong beta codes never send email or consume send quota; bad attempts have independent IP limit',async()=>{
 const f=fixture();assert.equal((await f.request('a@example.test','')).error?.code,'BETA_CODE_REQUIRED');
 for(let i=0;i<19;i++)assert.equal((await f.request('a@example.test','999999')).error?.code,'BETA_CODE_INVALID');
 assert.equal((await f.request('a@example.test','999999')).error?.code,'RATE_LIMITED');assert.equal(f.calls.length,0);
 assert.equal((await f.request()).ok,true);
});
test('leading-zero beta code grants admission only after OTP and stores no plaintext code',async()=>{
 const f=fixture(),c=await f.request();assert.equal(c.ok,true);assert.equal((await f.verify(c.data.id,'999999')).error?.code,'BETA_CODE_INVALID');assert.equal(f.calls.length,1);
 const done=await f.verify(c.data.id);assert.equal(done.ok,true);const stored=f.docs.get('p:A');
 assert.deepEqual(stored.betaAdmission,{version:1,grantedAt:'2026-10-08T07:40:50.000Z',source:'invite'});
 assert.equal(JSON.stringify([...f.docs]).includes('012349'),false);assert.equal((await f.verify(c.data.id)).ok,false);
});
test('login preserves an owned existing OTP proof and admission instead of rewriting their timestamps',async()=>{
 const f=fixture(),original=proof({betaAdmission:admission});f.docs.set('p:A',original);const c=await f.request();assert.equal((await f.verify(c.data.id)).ok,true);assert.deepEqual(f.docs.get('p:A'),original);
});
test('gate enabling or secret rotation invalidates outstanding challenges before remote verification',async()=>{
 for(const initial of [disabled,active]){
  const f=fixture(initial),c=await f.request();const rotated=f.service({...active,fingerprint:'rotated'});
  const r=await rotated.handle({action:'auth.verifyEmailCode',payload:{id:c.data.id,code:'123456',betaCode:'012349'}},{ip:'127.0.0.1'});
  assert.equal(r.error?.code,'BETA_ACCESS_REQUIRED');assert.equal(f.calls.length,1);
 }
});
test('verified platform email and OTP fallback both require persisted owned admission; forged flags do not grant',async()=>{
 for(const verified of [true,false]){
  const profile={sub:'A',email:'a@example.test',email_verified:verified,betaAdmission:admission};
  await assert.rejects(()=>resolvePrincipal({},identityOptions(profile,proof())),e=>e.code==='BETA_ACCESS_REQUIRED');
  assert.equal((await resolvePrincipal({},identityOptions(profile,proof({betaAdmission:admission})))).userId,'A');
  for(const bad of [proof({ownerId:'B',betaAdmission:admission}),proof({betaAdmission:{...admission,version:2}}),proof({betaAdmission:{...admission,grantedAt:'bad'}})]) {
   const result=await resolvePrincipal({},identityOptions(profile,bad)).catch(e=>e.code);assert.ok(result===null||result==='BETA_ACCESS_REQUIRED');
  }
 }
});
test('fallback identity lookup enforces same admission and owned email proof',async()=>{
 const options=identityOptions(undefined,proof());delete options.readVerifiedProfile;
 await assert.rejects(()=>resolvePrincipal({},options),e=>e.code==='BETA_ACCESS_REQUIRED');
 options.readVerifiedProof=async()=>proof({betaAdmission:admission});assert.equal((await resolvePrincipal({},options)).userId,'A');
});
test('mailbox interval is 60 seconds and sliding ten-minute allowance is three sends',async()=>{
 const f=fixture();assert.equal((await f.request()).ok,true);
 const early=await f.request();assert.equal(early.error?.code,'RATE_LIMITED');assert.equal(early.error.params.retryAfterSeconds,60);
 f.advance(59999);assert.equal((await f.request()).error?.code,'RATE_LIMITED');f.advance(1);assert.equal((await f.request()).ok,true);
 f.advance(60000);assert.equal((await f.request()).ok,true);f.advance(60000);assert.equal((await f.request()).error?.code,'RATE_LIMITED');
 f.advance(420000);assert.equal((await f.request()).ok,true);assert.equal(f.calls.length,4);
});
test('same IP allows ten distinct mailboxes per sliding ten minutes and independent IP may continue',async()=>{
 const f=fixture();for(let i=0;i<10;i++)assert.equal((await f.request(`box${i}@example.test`)).ok,true);
 assert.equal((await f.request('box10@example.test')).error?.code,'RATE_LIMITED');assert.equal((await f.request('box10@example.test','012349','127.0.0.2')).ok,true);
 f.advance(600000);assert.equal((await f.request('box11@example.test')).ok,true);
});
test('transactional send reservations exclude concurrent mailbox sends and release quotas on platform failure',async()=>{
 const f=fixture();let release;f.platform.send=async()=>{f.calls.push(['send']);if(f.calls.length===1)await new Promise(r=>release=r);throw Error('remote unavailable');};
 const first=f.request();while(!release)await new Promise(r=>setImmediate(r));const concurrent=await f.request();release();assert.equal((await first).error?.code,'UNAVAILABLE');assert.equal(concurrent.error?.code,'RATE_LIMITED');
 f.platform.send=async()=>({verification_id:'retry'});assert.equal((await f.request()).ok,true);
});
test('late OTP platform responses after the 30-second lease expires never grant admission',async()=>{
 const f=fixture(),c=await f.request();f.platform.verify=async()=>{f.advance(30000);return{verification_token:'verified'};};
 const result=await f.verify(c.data.id);assert.equal(result.error?.code,'INVALID_INPUT');assert.equal(f.docs.has('p:A'),false);
});
test('challenge expiry at exactly ten minutes prevents platform OTP calls and proof writes',async()=>{
 const f=fixture(),c=await f.request();f.advance(600000);assert.equal((await f.verify(c.data.id)).error?.code,'INVALID_INPUT');assert.equal(f.calls.length,1);assert.equal(f.docs.has('p:A'),false);
});
test('foreign proof is replaced by this verified OTP but its forged admission is not preserved',async()=>{
 const f=fixture();f.docs.set('p:A',proof({ownerId:'B',betaAdmission:admission}));const c=await f.request();assert.equal((await f.verify(c.data.id)).ok,true);const saved=f.docs.get('p:A');assert.equal(saved.ownerId,'A');assert.equal(saved.betaAdmission.source,'invite');assert.equal(saved.betaAdmission.grantedAt,'2026-10-08T07:40:50.000Z');
});
test('gate-off login preserves existing admission and original proof for later reenabling',async()=>{
 const f=fixture(disabled),original=proof({betaAdmission:admission});f.docs.set('p:A',original);const c=await f.request('a@example.test','');assert.equal((await f.verify(c.data.id,'')).ok,true);assert.deepEqual(f.docs.get('p:A'),original);
});
test('conflicting context and event credentials never borrow a valid contextual identity',async()=>{
 const options=identityOptions(undefined,proof({betaAdmission:admission}));assert.equal(await resolvePrincipal({extendedContext:{accessToken:'different-credential'}},options),null);
});
test('calendar-invalid proof/grant timestamps cannot become admission',async()=>{
 for(const p of [proof({verifiedAt:'2026-02-31T00:00:00Z',betaAdmission:admission}),proof({betaAdmission:{...admission,grantedAt:'2026-02-31T00:00:00Z'}})])await assert.rejects(()=>resolvePrincipal({},identityOptions(undefined,p)),e=>e.code==='BETA_ACCESS_REQUIRED');
});
