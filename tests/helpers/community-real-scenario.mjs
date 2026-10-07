import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import jpeg from 'jpeg-js';
export const COMMUNITY_ENVIRONMENT='paw-diary-d8g3p4tlsb305221d';
const fail=(code,action)=>Object.assign(new Error(code),{code,...(action?{action}:{})});
const safeCode=error=>/^[A-Z0-9_]{1,80}$/.test(error?.code??'')?error.code:'REAL_COMMUNITY_ACCEPTANCE_FAILED';
const expect=(condition,label)=>assert.equal(Boolean(condition),true,label);
const profileFields=['nickname','avatarAssetId','bio','cityId','districtId','petTypes','purposes','discoverable'];
const profileInput=(p,extra={})=>Object.fromEntries(profileFields.map(k=>[k,Object.hasOwn(extra,k)?extra[k]:p[k]]));
function safeProjection(value){if(!value||typeof value!=='object')return true;if(Array.isArray(value))return value.every(safeProjection);return Object.entries(value).every(([k,v])=>!['ownerId','email','uid','userId','authToken','token','fileRef','snapshot','records'].includes(k)&&safeProjection(v));}
export function communityRealConfiguration({environment=process.env,config}={}){
 const aPath=environment.PAW_DIARY_REAL_SESSIONS_FILE,bPath=environment.PAW_DIARY_STAGE4_B_SESSIONS_FILE||aPath;
 if(typeof aPath!=='string'||!aPath.trim())throw fail('REAL_COMMUNITY_SESSIONS_REQUIRED');
 if((config?.environmentId??config?.env)!==COMMUNITY_ENVIRONMENT)throw fail('REAL_COMMUNITY_ENVIRONMENT_MISMATCH');
 if(typeof config?.publishableKey!=='string'||!config.publishableKey)throw fail('REAL_COMMUNITY_PUBLIC_CONFIGURATION_REQUIRED');
 return{aPath,bPath,envId:COMMUNITY_ENVIRONMENT,publicKey:config.publishableKey};
}
export async function verifyCommunitySessionFiles(configuration){for(const file of new Set([configuration.aPath,configuration.bPath])){let info;try{info=await fs.stat(file);}catch{throw fail('REAL_COMMUNITY_SESSION_FILE_UNREADABLE');}if(!info.isFile()||(info.mode&0o777)!==0o600)throw fail('REAL_COMMUNITY_SESSION_FILE_MUST_BE_PRIVATE');}}
export async function persistCommunityReceipt(file,receipt){await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.tmp-'+randomUUID();try{await fs.writeFile(temporary,JSON.stringify(receipt,null,2)+'\n',{mode:0o600,flag:'wx'});await fs.rename(temporary,file);await fs.chmod(file,0o600);}finally{await fs.rm(temporary,{force:true});}}
export async function runCommunityAcceptance({clients,runId='stage4-'+randomUUID(),persist=async()=>{}}={}){
 if(!clients?.A?.community||!clients?.B?.community||!clients?.anonymous?.community)throw fail('REAL_COMMUNITY_CLIENTS_REQUIRED');
 const receipt={version:1,runId,createdAt:new Date().toISOString(),status:'running',profiles:[],tickets:[],assets:[],posts:[],comments:[],reports:[],operations:[],profileRestored:{A:false,B:false},cleanupFailures:[]},flags={},previous=new Map(),attemptedProfiles=new Set();let sequence=0,error;
 const checkpoint=()=>persist(structuredClone(receipt));
 const raw=(actor,action,payload={},options={})=>clients[actor].community({version:1,action,payload,...options});
 const call=async(actor,action,payload={},options={})=>{let result;try{result=await raw(actor,action,payload,options);}catch(e){throw fail(safeCode(e),action);}if(result?.ok!==true)throw fail(safeCode(result?.error),action);return result.data;};
 const write=async(actor,action,payload,revision,key)=>{const idempotencyKey=runId+'-'+(key??'operation-'+(++sequence));if(!receipt.operations.some(o=>o.actor===actor&&o.idempotencyKey===idempotencyKey)){receipt.operations.push({actor,action,idempotencyKey});await checkpoint();}return call(actor,action,payload,{idempotencyKey,...(revision!==undefined?{expectedRevision:revision}:{})});};
 const denied=async(actor,action,payload,code,revision)=>{const result=await raw(actor,action,payload,{idempotencyKey:runId+'-denied-'+(++sequence),...(revision!==undefined?{expectedRevision:revision}:{})});expect(result?.ok===false&&result.error?.code===code,'REAL_DENIAL_'+action);};
 const cleanup=async(label,operation)=>{try{await operation();}catch(e){receipt.cleanupFailures.push({step:label,code:safeCode(e)});}await checkpoint();};
 await checkpoint();
 try{
  const ownA=await call('A','auth.getOwn'),ownB=await call('B','auth.getOwn');expect(typeof ownA.email==='string'&&!!ownA.email&&typeof ownB.email==='string'&&ownA.email!==ownB.email,'DISTINCT_REAL_ACCOUNTS');flags.distinctRealAccounts=true;
  const directory=await call('anonymous','regions.search',{query:'北京',level:'city',limit:20}),city=directory?.items?.find(v=>v.name.includes('北京'));expect(city?.id,'REAL_DIRECTORY_VIA_SDK');flags.realDirectoryViaSDK=true;
  for(const actor of['A','B']){const profile=await call(actor,'profiles.getOwn');expect(profile?.authorId&&profile.nickname,'EXISTING_PROFILE_REQUIRED_FOR_REVERSIBLE_ACCEPTANCE');previous.set(actor,profile);}
  for(const actor of['A','B']){attemptedProfiles.add(actor);const prior=previous.get(actor),p=await write(actor,'profiles.saveOwn',profileInput(prior,{nickname:'合成验收'+actor+'-'+runId.slice(-8),cityId:city.id,districtId:null,petTypes:['cat'],purposes:['新手互助'],discoverable:true}),prior.revision);receipt.profiles.push({actor,authorId:p.authorId});await checkpoint();const publicCard=await call('anonymous','profiles.getPublic',{authorId:p.authorId});expect(safeProjection(publicCard),'PUBLIC_PROFILE_PROJECTION');}
  const discover=await call('anonymous','profiles.discover',{scope:'city',cityId:city.id,petTypes:['cat'],purposes:['新手互助'],limit:50});expect(receipt.profiles.every(p=>discover.items.some(v=>v.authorId===p.authorId))&&safeProjection(discover),'REAL_DISCOVERY_PROJECTION');flags.privateProjection=true;
  await denied('anonymous','profiles.saveOwn',{nickname:'Unauthenticated'},'UNAUTHENTICATED',0);flags.anonymousWriteDenied=true;
  const bytes=jpeg.encode({data:Buffer.from([40,90,60,255,40,90,60,255,40,90,60,255,40,90,60,255]),width:2,height:2},70).data,sha=createHash('sha256').update(bytes).digest('hex');
  const ticket=await write('A','community.media.prepare',{kind:'post',mime:'image/jpeg',bytes:bytes.length,width:2,height:2,sha256:sha});receipt.tickets.push({actor:'A',id:ticket.ticketId});await checkpoint();
  const image=await write('A','community.media.confirm',{ticketId:ticket.ticketId,bytesBase64:bytes.toString('base64')});receipt.assets.push({actor:'A',id:image.assetId});await checkpoint();
  const payload={title:'阶段4合成共享验收',text:'合成内容 <script>literal</script>',topic:'今日萌宠',cityId:city.id,districtId:null,imageAssetId:image.assetId};
  const created=await write('A','community.save',payload,0,'post');receipt.posts.push({actor:'A',id:created.post.id,deleted:false});await checkpoint();const replay=await write('A','community.save',payload,0,'post');expect(replay.post.id===created.post.id,'POST_IDEMPOTENCE');flags.postIdempotent=true;
  const byB=await call('B','community.get',{id:created.post.id});expect(byB.post.text===payload.text&&byB.isOwn===false&&safeProjection(byB),'CROSS_ACCOUNT_PUBLIC_READ');flags.crossAccountRead=true;
  for(const actor of['B','anonymous']){const picture=await call(actor,'community.media.read',{assetId:image.assetId,reference:{kind:'post',id:created.post.id}});expect(createHash('sha256').update(Buffer.from(picture.dataUrl.split(',')[1],'base64')).digest('hex')===sha,'PUBLIC_BYTES_HASH');}flags.publicBytesHash=true;
  await denied('B','community.save',{...payload,id:created.post.id,title:'Unauthorized'},'FORBIDDEN',created.post.revision);await denied('B','community.delete',{id:created.post.id},'FORBIDDEN',created.post.revision);await denied('B','community.save',{...payload,title:'Foreign image binding'},'FORBIDDEN',0);flags.authorGuard=true;
  const like1=await write('B','likes.set',{postId:created.post.id,liked:true},undefined,'like-1'),like2=await write('B','likes.set',{postId:created.post.id,liked:true});expect(like1.likeCount===1&&like2.likeCount===1,'DESIRED_LIKE');flags.desiredLike=true;
  const commentInput={postId:created.post.id,text:'合成评论 <script>literal</script>'},comment=await write('B','comments.save',commentInput,undefined,'comment');receipt.comments.push({actor:'B',id:comment.comment.id,postId:created.post.id,deleted:false});await checkpoint();const commentReplay=await write('B','comments.save',commentInput,undefined,'comment');expect(commentReplay.comment.id===comment.comment.id,'COMMENT_IDEMPOTENCE');const comments=await call('A','comments.list',{postId:created.post.id,limit:20});expect(comments.items.some(v=>v.comment.id===comment.comment.id&&v.comment.text===commentInput.text)&&safeProjection(comments),'REAL_COMMENT_READ');flags.realComment=true;
  const report=await write('B','community.report',{postId:created.post.id,reason:'其他',note:'仅本轮合成验收'});receipt.reports.push({actor:'B',id:report.reportId,postId:created.post.id,status:report.status});await checkpoint();expect(report.status==='queued','REPORT_QUEUED');
  await write('B','community.hide',{postId:created.post.id,hidden:true});await denied('B','community.get',{id:created.post.id},'NOT_FOUND');expect((await call('B','community.hidden.list',{})).items.some(v=>v.postId===created.post.id),'HIDDEN_RECOVERY');expect((await call('A','community.get',{id:created.post.id})).post.id===created.post.id,'HIDE_IS_PERSONAL');await write('B','community.hide',{postId:created.post.id,hidden:false});flags.reportAndPersonalHide=true;
  const edited=await write('A','community.save',{...payload,id:created.post.id,text:payload.text+' 已编辑'},created.post.revision);await denied('A','community.save',{...payload,id:created.post.id},'CONFLICT',created.post.revision);expect(edited.post.revision===2&&(await call('B','community.get',{id:created.post.id})).post.text.endsWith('已编辑'),'EDIT_CAS');flags.editCas=true;
  const latestA=await call('A','profiles.getOwn');await write('A','profiles.saveOwn',profileInput(latestA,{discoverable:false}),latestA.revision);await denied('anonymous','profiles.getPublic',{authorId:latestA.authorId},'NOT_FOUND');expect((await call('anonymous','community.get',{id:created.post.id})).identity.nickname===latestA.nickname,'OPT_OUT_PRESERVES_AUTHOR');flags.optOutPreservesAuthor=true;
  await write('B','comments.delete',{id:comment.comment.id});receipt.comments[0].deleted=true;await write('B','likes.set',{postId:created.post.id,liked:false});await checkpoint();
  const live=await call('A','community.get',{id:created.post.id});await write('A','community.delete',{id:created.post.id},live.post.revision);receipt.posts[0].deleted=true;await checkpoint();
  const revoked=await raw('anonymous','community.media.read',{assetId:image.assetId,reference:{kind:'post',id:created.post.id}});expect(revoked.ok===false&&['FORBIDDEN','NOT_FOUND'].includes(revoked.error?.code),'PUBLIC_REVOKED');await denied('B','comments.save',{postId:created.post.id,text:'Cannot revive'},'NOT_FOUND');flags.revocation=true;
 }catch(e){error=fail(safeCode(e),e.action);}
 finally{
  for(const comment of receipt.comments.filter(c=>!c.deleted))await cleanup('comment-delete',async()=>{const r=await raw(comment.actor,'comments.delete',{id:comment.id},{idempotencyKey:runId+'-cleanup-comment-'+comment.id});if(r.ok||r.error?.code==='NOT_FOUND')comment.deleted=true;else throw fail(safeCode(r.error));});
  for(const post of receipt.posts){await cleanup('personal-unhide',()=>write('B','community.hide',{postId:post.id,hidden:false},undefined,'cleanup-unhide-'+post.id));if(!post.deleted)await cleanup('post-delete',async()=>{const r=await raw(post.actor,'community.get',{id:post.id});if(r.error?.code==='NOT_FOUND'){post.deleted=true;return;}if(!r.ok)throw fail(safeCode(r.error));await write(post.actor,'community.delete',{id:post.id},r.data.post.revision,'cleanup-post-'+post.id);post.deleted=true;});}
  for(const id of new Set([...receipt.tickets,...receipt.assets].map(v=>v.id)))await cleanup('media-remove',async()=>{const r=await raw('A','community.media.remove',{assetId:id},{idempotencyKey:runId+'-cleanup-media-'+id});if(!r.ok)throw fail(safeCode(r.error));});
  for(const[actor,prior]of previous)if(attemptedProfiles.has(actor))await cleanup('profile-restore-'+actor,async()=>{const current=await call(actor,'profiles.getOwn');await write(actor,'profiles.saveOwn',profileInput(prior),current.revision,'restore-profile-'+actor);receipt.profileRestored[actor]=true;});
  receipt.status=error||receipt.cleanupFailures.length?'failed':'passed';receipt.flags=flags;receipt.remainingOperatorRefs={reports:receipt.reports.map(r=>r.id),operationKeys:receipt.operations.map(o=>o.idempotencyKey)};await checkpoint();
 }
 if(error)throw error;if(receipt.cleanupFailures.length)throw fail('REAL_COMMUNITY_CLEANUP_INCOMPLETE');return{flags,receipt};
}
