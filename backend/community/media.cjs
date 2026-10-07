'use strict';
const {randomUUID,createHash}=require('node:crypto');
const {ApiError}=require('../workspace.cjs');
const {inflateSync}=require('node:zlib');
const {decode:decodeJpeg}=require('jpeg-js');
const MAX_BYTES=1048576,MAX_QUOTA=50*MAX_BYTES,TTL=86400000;
const error=code=>{throw new ApiError(code);};
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(id);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function metadata(p){
 if(!p||!['avatar','post'].includes(p.kind)||!['image/png','image/jpeg'].includes(p.mime)||!Number.isInteger(p.bytes)||p.bytes<1||p.bytes>MAX_BYTES||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width>(p.kind==='avatar'?512:1920)||p.height>(p.kind==='avatar'?512:1920)||!/^([a-f0-9]{64})$/.test(p.sha256))error('INVALID_INPUT');
 return {kind:p.kind,mime:p.mime,bytes:p.bytes,sha256:p.sha256,width:p.width,height:p.height};
}
function imageDetails(b){
 let mime,width,height;
 if(b.length>=45&&b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&b.readUInt32BE(8)===13&&b.toString('ascii',12,16)==='IHDR'&&b.subarray(-8,-4).toString('ascii')==='IEND'){
  mime='image/png';width=b.readUInt32BE(16);height=b.readUInt32BE(20);
  // Bound all PNG chunk lengths and require image data and an exact final IEND.
  let at=8;const data=[];while(at<b.length){if(at+12>b.length)error('INVALID_INPUT');const len=b.readUInt32BE(at),end=at+12+len;if(end>b.length||crc32(b.subarray(at+4,end-4))!==b.readUInt32BE(end-4))error('INVALID_INPUT');const type=b.toString('ascii',at+4,at+8);if(type==='IDAT')data.push(b.subarray(at+8,at+8+len));if(type==='IEND'&&(len!==0||end!==b.length))error('INVALID_INPUT');at=end;}if(!data.length||width>1920||height>1920)error('INVALID_INPUT');
  try{
   const depth=b[24],color=b[25],channels={0:1,2:3,3:1,4:2,6:4}[color],allowedDepths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]}[color];
   if(!channels||!allowedDepths.includes(depth)||b[26]!==0||b[27]!==0||b[28]>1)error('INVALID_INPUT');
   const pixels=inflateSync(Buffer.concat(data),{maxOutputLength:width*height*8+height*8+1024});let offset=0;
   const passes=b[28]===0?[[0,0,1,1]]:[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]];
   for(const[x,y,dx,dy]of passes){const w=Math.max(0,Math.ceil((width-x)/dx)),h=Math.max(0,Math.ceil((height-y)/dy));if(!w||!h)continue;const stride=1+Math.ceil(w*channels*depth/8);for(let row=0;row<h;row++){if(offset+stride>pixels.length||pixels[offset]>4)error('INVALID_INPUT');offset+=stride;}}
   if(offset!==pixels.length||!offset)error('INVALID_INPUT');
  }catch{error('INVALID_INPUT');}
 }else if(b.length>20&&b[0]===255&&b[1]===216&&b.at(-2)===255&&b.at(-1)===217){
  let at=2,hasScan=false;
  while(at+4<b.length){if(b[at]!==255)error('INVALID_INPUT');while(b[at+1]===255)at++;const marker=b[at+1];if(marker===0xd9)break;const length=b.readUInt16BE(at+2);if(length<2||at+2+length>b.length)error('INVALID_INPUT');if(marker===0xda){const components=b[at+4];if(!components||length!==6+components*2||at+2+length>=b.length-2)error('INVALID_INPUT');hasScan=true;break;}at+=length+2;}
  if(!hasScan)error('INVALID_INPUT');
  try{const image=decodeJpeg(b,{tolerantDecoding:false,maxResolutionInMP:4,maxMemoryUsageInMB:64,useTArray:true,formatAsRGBA:false});mime='image/jpeg';width=image.width;height=image.height;if(!image.data||image.data.length!==width*height*3)error('INVALID_INPUT');}catch{error('INVALID_INPUT');}
 }
 if(!mime||!width||!height)error('INVALID_INPUT');return {mime,width,height};
}
function verifiedBytes(ticket,text){
 if(typeof text!=='string'||text.length>Math.ceil(MAX_BYTES/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))error('INVALID_INPUT');
 const b=Buffer.from(text,'base64'),actual=imageDetails(b);if(b.toString('base64')!==text||b.length!==ticket.bytes||digest(b)!==ticket.sha256||actual.mime!==ticket.mime||actual.width!==ticket.width||actual.height!==ticket.height)error('INVALID_INPUT');return b;
}
function livePost(p){return p&&p.deletedAt===null&&p.moderationStatus==='visible';}
function liveComment(p){return p&&p.deletedAt===null;}
async function bindCommunityAsset(tx,{assetId,ownerId,targetKind,targetId,now=Date.now()}){
 if(!validId(assetId)||!validId(targetId)||!['profile','post'].includes(targetKind))error('FORBIDDEN');
 const a=await tx.get('media',assetId);if(!a||a.entity!=='community-image'||a.ownerId!==ownerId||a.state!=='draft'||a.binding||a.used||a.expiresAt<=now||a.kind!==(targetKind==='profile'?'avatar':'post'))error('FORBIDDEN');
 a.binding={kind:targetKind,id:targetId};a.used=true;a.state='bound';await tx.put('media',assetId,a);return {assetId};
}
async function unbindCommunityAsset(tx,{assetId,targetKind,targetId}){
 const a=await tx.get('media',assetId);if(!a||a.binding?.kind!==targetKind||a.binding.id!==targetId)error('FORBIDDEN');a.binding=null;a.state='retired';await tx.put('media',assetId,a);
}
async function allowedPublic(tx,a,r){
 if(!r||!validId(r.id)||!['post','comment','profile'].includes(r.kind)||a.state!=='bound'||!a.binding)return false;
 let parent=await tx.get(r.kind==='profile'?'profiles':r.kind==='post'?'posts':'comments',r.id);
 if(r.kind==='profile')return a.binding.kind==='profile'&&a.binding.id===r.id&&parent?.discoverable===true&&parent.avatarAssetId===a.id;
 if(r.kind==='post'&&!livePost(parent)||r.kind==='comment'&&(!liveComment(parent)||!livePost(await tx.get('posts',parent.postId))))return false;
 if(r.kind==='post'&&a.binding.kind==='post')return a.binding.id===r.id&&parent.imageAssetId===a.id;
 if(a.binding.kind!=='profile'||parent.authorId!==a.binding.id)return false;
 const profile=await tx.get('profiles',parent.authorId);return profile?.avatarAssetId===a.id&&profile.ownerId===a.ownerId;
}
function createCommunityMediaService({store,storage,clock:readClock=Date.now,idFactory=randomUUID,fetch:uploadFetch=globalThis.fetch,ownerIdFor=uid=>require('./store.cjs').hashOwner(uid)}={}){
 const clock=()=>{const now=Number(new Date(readClock()));if(!Number.isFinite(now))error('UNAVAILABLE');return now;};
 const owner=principal=>{if(!principal?.userId)error('UNAUTHENTICATED');return ownerIdFor(principal.userId);};
 function receiptFor(context,ownerId,action,input){
  if(context.idempotencyKey===undefined)return null;
  if(typeof context.idempotencyKey!=='string'||!context.idempotencyKey||context.idempotencyKey.length>128||/[\x00-\x1f]/.test(context.idempotencyKey))error('INVALID_INPUT');
  return {id:'media:'+digest(JSON.stringify([ownerId,context.idempotencyKey])),ownerId,signature:digest(JSON.stringify([action,input]))};
 }
 async function prior(tx,receipt){if(!receipt)return null;const existing=await tx.get('receipts',receipt.id);if(!existing)return null;if(existing.ownerId!==receipt.ownerId||existing.signature!==receipt.signature)error('CONFLICT');return existing.result;}
 async function remember(tx,receipt,result){if(receipt)await tx.put('receipts',receipt.id,{ownerId:receipt.ownerId,signature:receipt.signature,result,createdAt:clock()});return result;}
 async function release(id,{ownerId,expired=false,dryRun=false,receipt}={}){
  const candidate=await store.transaction(async tx=>{const a=await tx.get('media',id);if(!a||a.entity!=='community-image'||a.binding||!['ticket','draft','retired','cleaning',...(expired?['uploading']:[])].includes(a.state)||ownerId&&a.ownerId!==ownerId||expired&&a.expiresAt>clock()||a.state==='uploading'&&a.uploadLeaseUntil>clock())return null;if(dryRun)return a;if(a.state==='uploading'&&a.uploadLeaseUntil){a.uploadMayComplete=true;a.uploadCleanupAfter=clock()+60000;}a.state='cleaning';await tx.put('media',id,a);return a;});
  if(!candidate)return false;if(candidate.uploadMayComplete&&candidate.uploadCleanupAfter>clock())return false;if(dryRun)return true;if(candidate.fileRef)await storage.remove(candidate.fileRef);
  return store.transaction(async tx=>{const cached=await prior(tx,receipt);if(cached)return true;const a=await tx.get('media',id);if(!a||a.state!=='cleaning'||a.binding||a.fileRef!==candidate.fileRef)error('CONFLICT');if(a.uploadMayComplete&&a.uploadCleanupAfter>clock())return false;const q=await tx.get('media','quota:'+a.ownerId);if(q){q.bytes=Math.max(0,q.bytes-a.bytes);delete q.pending[id];}if(q)await tx.put('media','quota:'+a.ownerId,q);await tx.remove('media',id);await remember(tx,receipt,{removed:true});return true;});
 }
 return {
  async handle(action,p={},context={}){
   if(action==='community.media.prepare'){
    const ownerId=owner(context.principal),m=metadata(p),id=idFactory(),receipt=receiptFor(context,ownerId,action,m);if(!validId(id))error('INVALID_INPUT');
    return store.transaction(async tx=>{const cached=await prior(tx,receipt);if(cached)return cached;const key='quota:'+ownerId,q=await tx.get('media',key)??{kind:'quota',ownerId,bytes:0,pending:{}};if(Object.keys(q.pending).length>=20||q.bytes+m.bytes>MAX_QUOTA)error('QUOTA_EXCEEDED');if(await tx.get('media',id))error('CONFLICT');const a={...m,entity:'community-image',id,ownerId,state:'ticket',binding:null,used:false,expiresAt:clock()+TTL,createdAt:clock(),fileRef:null};q.bytes+=m.bytes;q.pending[id]=a.expiresAt;await tx.put('media',id,a);await tx.put('media',key,q);return remember(tx,receipt,{ticketId:id});});
   }
   if(action==='community.media.confirm'){
    const ownerId=owner(context.principal);if(!validId(p.ticketId))error('FORBIDDEN');if(typeof p.bytesBase64!=='string'||p.bytesBase64.length>Math.ceil(MAX_BYTES/3)*4)error('INVALID_INPUT');const receipt=receiptFor(context,ownerId,action,{ticketId:p.ticketId,encodedHash:digest(p.bytesBase64)}),cached=await store.transaction(tx=>prior(tx,receipt));if(cached)return cached;const ticket=await store.transaction(tx=>tx.get('media',p.ticketId));if(!ticket||ticket.entity!=='community-image'||ticket.ownerId!==ownerId)error('FORBIDDEN');if(ticket.expiresAt<=clock())error('INVALID_INPUT');const bytes=verifiedBytes(ticket,p.bytesBase64);if(['draft','bound'].includes(ticket.state))return store.transaction(tx=>remember(tx,receipt,{assetId:ticket.id}));
    const uploadToken=randomUUID();let uploadFileRef=null,putStarted=false,putCompleted=false;
    await store.transaction(async tx=>{const a=await tx.get('media',ticket.id);if(a?.state!=='ticket')error('CONFLICT');a.state='uploading';a.uploadToken=uploadToken;a.uploadLeaseUntil=Math.max(a.expiresAt,clock())+60000;await tx.put('media',a.id,a);});
    try{
     const prepared=await storage.prepare(`community/${ownerId}/${ticket.id}`);if(!prepared?.fileRef||!prepared.upload?.url?.startsWith('https://')||typeof uploadFetch!=='function')error('UNAVAILABLE');uploadFileRef=prepared.fileRef;await store.transaction(async tx=>{const a=await tx.get('media',ticket.id);if(a?.state!=='uploading'||a.uploadToken!==uploadToken)error('CONFLICT');a.fileRef=prepared.fileRef;await tx.put('media',a.id,a);});
     putStarted=true;const response=await uploadFetch(prepared.upload.url,{method:prepared.upload.method??'PUT',headers:{...prepared.upload.headers,'Content-Type':ticket.mime},body:bytes,redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)error('UNAVAILABLE');putCompleted=true;
     const check=await storage.read(prepared.fileRef,MAX_BYTES);if(!Buffer.isBuffer(check)||digest(check)!==ticket.sha256||check.length!==ticket.bytes)error('INVALID_INPUT');
     return await store.transaction(async tx=>{const saved=await prior(tx,receipt);if(saved)return saved;const a=await tx.get('media',ticket.id);if(a?.state!=='uploading'||a.uploadToken!==uploadToken||a.expiresAt<=clock())error('CONFLICT');a.state='draft';delete a.uploadToken;delete a.uploadLeaseUntil;await tx.put('media',a.id,a);const q=await tx.get('media','quota:'+ownerId);delete q.pending[a.id];await tx.put('media','quota:'+ownerId,q);return remember(tx,receipt,{assetId:a.id});});
    }catch(e){
     const committed=await store.transaction(async tx=>{let a=await tx.get('media',ticket.id);if(a&&['draft','bound'].includes(a.state)&&a.fileRef===uploadFileRef)return true;if(!uploadFileRef){if(a?.state==='uploading'&&a.uploadToken===uploadToken){a.state='ticket';delete a.uploadToken;delete a.uploadLeaseUntil;await tx.put('media',a.id,a);}return false;}if(!a){a={...ticket};const key='quota:'+ownerId,q=await tx.get('media',key)??{kind:'quota',ownerId,bytes:0,pending:{}};q.bytes+=ticket.bytes;q.pending[ticket.id]=ticket.expiresAt;await tx.put('media',key,q);}if(a.ownerId!==ownerId||a.binding||a.uploadToken&&a.uploadToken!==uploadToken)error('CONFLICT');a.state='cleaning';a.fileRef=uploadFileRef;a.uploadMayComplete=putStarted&&!putCompleted;if(a.uploadMayComplete)a.uploadCleanupAfter=Math.max(ticket.expiresAt,clock())+60000;a.expiresAt=Math.min(a.expiresAt,clock());delete a.uploadToken;delete a.uploadLeaseUntil;await tx.put('media',a.id,a);return false;});
     if(committed)return {assetId:ticket.id};
     // A rejected/aborted local PUT does not prove COS did not commit later.
     // Keep the exact reference and its capacity charged until the safety window.
     if(putStarted&&!putCompleted)throw e;
     if(uploadFileRef){try{await storage.remove(uploadFileRef);}catch{error('UNAVAILABLE');}await store.transaction(async tx=>{const a=await tx.get('media',ticket.id);if(!a)return;if(a.state!=='cleaning'||a.binding||a.fileRef!==uploadFileRef)error('CONFLICT');if(ticket.expiresAt>clock()){a.state='ticket';a.fileRef=null;a.expiresAt=ticket.expiresAt;delete a.uploadMayComplete;delete a.uploadCleanupAfter;await tx.put('media',a.id,a);return;}const q=await tx.get('media','quota:'+ownerId);if(q){q.bytes=Math.max(0,q.bytes-a.bytes);delete q.pending[a.id];await tx.put('media','quota:'+ownerId,q);}await tx.remove('media',a.id);});}
     throw e;
    }
   }
   if(action==='community.media.read'){
    if(!validId(p.assetId))error('FORBIDDEN');let own=null;if(context.principal?.userId)own=ownerIdFor(context.principal.userId);
    const authorized=tx=>tx.get('media',p.assetId).then(async a=>{if(!a||a.entity!=='community-image'||!['draft','bound','retired'].includes(a.state))error('FORBIDDEN');if(!p.reference){if(a.ownerId!==own||a.state!=='bound'&&a.expiresAt<=clock())error('FORBIDDEN');}else if(!await allowedPublic(tx,a,p.reference))error('FORBIDDEN');return a;});
    const a=await store.transaction(authorized),b=await storage.read(a.fileRef,MAX_BYTES);if(!Buffer.isBuffer(b)||b.length!==a.bytes||digest(b)!==a.sha256)error('INVALID_INPUT');await store.transaction(authorized);return {dataUrl:`data:${a.mime};base64,${b.toString('base64')}`,sha256:a.sha256};
   }
   if(action==='community.media.remove'){
    const ownerId=owner(context.principal);if(!validId(p.assetId))error('FORBIDDEN');const receipt=receiptFor(context,ownerId,action,{assetId:p.assetId}),cached=await store.transaction(tx=>prior(tx,receipt));if(cached)return cached;const a=await store.transaction(tx=>tx.get('media',p.assetId));if(!a||a.ownerId!==ownerId||a.entity!=='community-image')error('FORBIDDEN');if(a.binding)error('CONFLICT');if(!await release(p.assetId,{ownerId,receipt}))error('CONFLICT');return {removed:true};
   }
   error('INVALID_INPUT');
  },
  async cleanupCandidates(ids,{dryRun=false}={}){if(!Array.isArray(ids)||ids.length>100||!ids.every(validId))error('INVALID_INPUT');const removed=[];for(const id of [...new Set(ids)])if(await release(id,{expired:true,dryRun}))removed.push(id);return {removed,dryRun};}
 };
}
async function handleCommunityMedia(action,payload,deps){return createCommunityMediaService(deps).handle(action,payload,{principal:deps.principal,idempotencyKey:deps.idempotencyKey});}
module.exports={createCommunityMediaService,handleCommunityMedia,bindCommunityAsset,unbindCommunityAsset};
