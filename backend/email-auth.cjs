'use strict';
const {randomUUID,createHash}=require('node:crypto');const {ApiError}=require('./workspace.cjs');
const digest=v=>createHash('sha256').update(v).digest('hex');const emailHash=email=>digest(email.trim());
function createAuthStore({db}){return{transaction:fn=>db.runTransaction(async tx=>fn({get:async key=>{const r=await tx.collection(key.startsWith('p:')?'auth_verified':'auth_challenges').doc(digest(key)).get();if(r?.code)throw new ApiError('UNAVAILABLE');const doc=Array.isArray(r?.data)?r.data[0]:r?.data;return doc?.value;},put:async(key,value)=>{const r=await tx.collection(key.startsWith('p:')?'auth_verified':'auth_challenges').doc(digest(key)).set({value});if(r?.code)throw new ApiError('UNAVAILABLE');},remove:async key=>{const r=await tx.collection('auth_challenges').doc(digest(key)).remove();if(r?.code)throw new ApiError('UNAVAILABLE');}}))};}
function createAuthService({store,platform,principalForToken,clock=Date.now,idFactory=randomUUID,observe=()=>{}}){return{readProof:uid=>store.transaction(tx=>tx.get('p:'+uid)),async handle(request,context={}){try{
 if(!request||typeof request.action!=='string'||!request.payload||typeof request.payload!=='object'||Array.isArray(request.payload)||Buffer.byteLength(JSON.stringify(request.payload))>2048)throw new ApiError('INVALID_INPUT');
 const p=request.payload,now=clock();
 if(request.action==='auth.session'){const principal=await principalForToken?.(request.authToken,context);if(!principal)throw new ApiError('UNAUTHENTICATED');return{ok:true,data:{principal:{userId:principal.userId}}};}
 if(request.action==='auth.requestEmailCode'){
  if(typeof p.email!=='string'||p.email.length>254||!/^\S+@\S+\.\S+$/.test(p.email.trim())||typeof context.ip!=='string'||!context.ip||context.ip.length>128)throw new ApiError('INVALID_INPUT');
  const email=p.email.trim(),id=idFactory(),rateKey='r:'+digest(context.ip);
  await store.transaction(async tx=>{let rate=await tx.get(rateKey);if(!rate||rate.until<=now)rate={kind:'rate',count:0,until:now+600000};if(rate.count>=3)throw new ApiError('INVALID_INPUT');rate.count++;await tx.put(rateKey,rate);});
  const remote=await platform.send(email);if(typeof remote?.verification_id!=='string'||!remote.verification_id||(remote.is_user!=null&&typeof remote.is_user!=='boolean'))throw new ApiError('UNAVAILABLE');
  // The platform omits is_user (or returns null) for a new account; only true signs in.
  await store.transaction(tx=>tx.put('c:'+id,{kind:'challenge',id,email,verificationId:remote.verification_id,isUser:remote.is_user===true,expiresAt:now+600000,attempts:0,leaseUntil:0,consumed:false}));
  return{ok:true,data:{id}};
 }
 if(request.action==='auth.verifyEmailCode'){
  if(typeof p.id!=='string'||!p.id||p.id.length>128||typeof p.code!=='string'||!/^[0-9]{4,10}$/.test(p.code))throw new ApiError('INVALID_INPUT');
  const challenge=await store.transaction(async tx=>{const c=await tx.get('c:'+p.id);if(!c||c.kind!=='challenge'||c.consumed||c.expiresAt<=now||c.attempts>=5||c.leaseUntil>now)throw new ApiError('INVALID_INPUT');c.attempts++;c.leaseUntil=now+30000;await tx.put('c:'+p.id,c);return c;});
  try{
   observe('verify',{attempt:challenge.attempts});
   const verified=await platform.verify(challenge.verificationId,p.code);observe('verificationFields',{fieldNames:Object.keys(verified??{})});if(typeof verified?.verification_token!=='string'||!verified.verification_token)throw new ApiError('INVALID_INPUT');
   observe('signin',{existingUser:challenge.isUser});
   const session=await platform.sign({email:challenge.email,isUser:challenge.isUser,verification_token:verified.verification_token});observe('sessionFields',{fieldNames:Object.keys(session??{}),accessPresent:typeof session?.access_token==='string',refreshPresent:typeof session?.refresh_token==='string',subPresent:typeof session?.sub==='string'});
   if(typeof session?.access_token!=='string'||!session.access_token||typeof session.refresh_token!=='string'||!session.refresh_token||session.scope==='anonymous')throw new ApiError('UNAVAILABLE');
   observe('profile',{});const raw=await platform.profile(session.access_token);observe('profileFields',{fieldNames:Object.keys(raw??{})});const issuedUid=raw?.sub??raw?.uid??raw?.id;
   if(typeof issuedUid!=='string'||!issuedUid||(session.sub!==undefined&&session.sub!==issuedUid)||raw.email!==challenge.email||raw.is_anonymous===true||raw.isAnonymous===true)throw new ApiError('UNAUTHENTICATED');
   await store.transaction(async tx=>{const latest=await tx.get('c:'+p.id);if(!latest||latest.consumed||latest.attempts!==challenge.attempts||latest.leaseUntil!==challenge.leaseUntil)throw new ApiError('INVALID_INPUT');await tx.put('p:'+issuedUid,{kind:'verified',ownerId:issuedUid,emailHash:emailHash(raw.email),verifiedAt:new Date(now).toISOString()});await tx.put('c:'+p.id,{kind:'consumed',id:p.id,consumed:true,expiresAt:challenge.expiresAt});});
   return{ok:true,data:{session:{access_token:session.access_token,refresh_token:session.refresh_token},principal:{userId:issuedUid}}};
  }catch(error){observe('failed',{code:error instanceof ApiError?error.code:'UNAVAILABLE'});await store.transaction(async tx=>{const c=await tx.get('c:'+p.id);if(c?.kind==='challenge'&&c.attempts===challenge.attempts){c.leaseUntil=0;await tx.put('c:'+p.id,c);}});throw error;}
 }
 throw new ApiError('INVALID_INPUT');
 }catch(error){const code=error instanceof ApiError?error.code:['INVALID_INPUT','UNAUTHENTICATED'].includes(error?.code)?error.code:'UNAVAILABLE';return{ok:false,error:{code,messageKey:'errors.'+code.toLowerCase()}};}}};}
function createEmailPlatform({environmentId,publishableKey,fetch:requestFetch=globalThis.fetch}){
 if(typeof environmentId!=='string'||!/^[a-z0-9-]{1,80}$/.test(environmentId)||!publishableKey)throw new ApiError('UNAVAILABLE');
 const profile=require('./verified-profile.cjs').createPlatformProfileLookup({environmentId,publishableKey,fetch:requestFetch});
 async function post(path,body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);try{
  const r=await requestFetch(`https://${environmentId}.api.tcloudbasegateway.com/auth/v1/${path}?client_id=${encodeURIComponent(environmentId)}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${publishableKey}`,'X-TCB-Region':'ap-shanghai'},body:JSON.stringify(body),redirect:'error',signal:controller.signal});
  if(!r.ok)throw new ApiError(r.status>=400&&r.status<500?'INVALID_INPUT':'UNAVAILABLE');const reader=r.body?.getReader();if(!reader)throw new ApiError('UNAVAILABLE');let n=0;const chunks=[];for(;;){const{done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>65536){await reader.cancel();throw new ApiError('UNAVAILABLE');}chunks.push(Buffer.from(value));}const data=JSON.parse(Buffer.concat(chunks,n).toString('utf8'));if(data?.error||data?.error_code||data?.code)throw new ApiError('INVALID_INPUT');return data;
 }catch(e){if(e instanceof ApiError)throw e;throw new ApiError('UNAVAILABLE');}finally{clearTimeout(timer);}}
 return{send:email=>post('verification',{email,usage:'email'}),verify:(id,code)=>post('verification/verify',{verification_id:id,verification_code:code}),sign:({email,isUser,verification_token})=>post(isUser?'signin':'signup',isUser?{username:email,verification_token}:{email,verification_token}),profile};
}
module.exports={createAuthService,createAuthStore,createEmailPlatform,emailHash};
