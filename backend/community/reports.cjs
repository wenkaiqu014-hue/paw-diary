'use strict';
const {onlyFields,communityId}=require('../../src/domain/community.js');
const {requirePrincipal}=require('./profiles.cjs');
const {hash,livePost}=require('./store.cjs');
const {relationId}=require('./posts.cjs');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const REPORT_REASONS=Object.freeze(['广告骚扰','不当内容','隐私问题','其他']);
const reportIdFor=(ownerId,postId)=>hash('community-report:'+ownerId+'\0'+postId);
const timestamp=clock=>{const date=new Date(clock());if(!Number.isFinite(date.getTime()))fail('UNAVAILABLE');return date.toISOString();};
async function report(payload,deps){
 onlyFields(payload,['postId','reason','note']);const postId=communityId(payload.postId),ownerId=requirePrincipal(deps.principal);
 if(!REPORT_REASONS.includes(payload.reason)||payload.note!==undefined&&(typeof payload.note!=='string'||payload.note.length>200))fail('INVALID_INPUT');
 return deps.mutate(async tx=>{
  const post=await tx.get('posts',postId);if(!livePost(post))fail('NOT_FOUND');
  const id=reportIdFor(ownerId,postId),previous=await tx.get('reports',id);
  if(previous){if(previous.reporterId!==ownerId||previous.postId!==postId)fail('FORBIDDEN');return {reportId:id,status:previous.status};}
  await tx.put('reports',id,{id,reporterId:ownerId,postId,reason:payload.reason,note:(payload.note??'').trim(),status:'queued',createdAt:timestamp(deps.clock)});
  return {reportId:id,status:'queued'};
 });
}
async function hide(payload,deps){
 onlyFields(payload,['postId','hidden']);const postId=communityId(payload.postId),ownerId=requirePrincipal(deps.principal);if(typeof payload.hidden!=='boolean')fail('INVALID_INPUT');
 return deps.mutate(async tx=>{
  const id=relationId(ownerId,postId),previous=await tx.get('hidden',id);if(previous&&(previous.ownerId!==ownerId||previous.postId!==postId))fail('FORBIDDEN');
  if(payload.hidden){if(!livePost(await tx.get('posts',postId)))fail('NOT_FOUND');const now=timestamp(deps.clock);await tx.put('hidden',id,{id,ownerId,postId,hidden:true,createdAt:previous?.createdAt??now,updatedAt:now});}
  else await tx.remove('hidden',id);
  return {postId,hidden:payload.hidden};
 });
}
async function listHidden(payload,deps){
 onlyFields(payload,['cursor','limit']);const ownerId=requirePrincipal(deps.principal),result=await deps.store.listOwnHidden(ownerId,payload);if(!result||!Array.isArray(result.items))fail('UNAVAILABLE');const items=[];
 for(const row of result.items){if(row.ownerId!==ownerId||row.hidden===false)continue;const item=await deps.store.transaction(async tx=>{const current=await tx.get('hidden',row.id);if(!current||current.ownerId!==ownerId||current.postId!==row.postId||current.hidden===false)return null;const post=await tx.get('posts',current.postId),available=livePost(post);return {postId:current.postId,title:available?post.title:null,available,hiddenAt:current.createdAt};});if(item)items.push(item);}
 return {items,nextCursor:result.nextCursor};
}
async function handleReports(action,payload,deps){const handler={'community.report':report,'community.hide':hide,'community.hidden.list':listHidden}[action];if(!handler)fail('INVALID_INPUT');return handler(payload,deps);}
// This is used only by the local management CLI, never by handleReports/gateway.
async function moderateReport({store,reportId,action,managementAuthorized=false,clock=()=>new Date()}={}){
 if(managementAuthorized!==true)fail('FORBIDDEN');communityId(reportId);if(!['hide','dismiss'].includes(action)||!store?.transaction)fail('INVALID_INPUT');
 return store.transaction(async tx=>{
  const report=await tx.get('reports',reportId);if(!report||report.id!==reportId)fail('NOT_FOUND');
  if(report.status!=='queued'){if(report.resolution!==action)fail('CONFLICT');return {reportId,postId:report.postId,status:report.status,action:report.resolution,handledAt:report.handledAt};}
  const now=timestamp(clock);
  if(action==='hide'){const post=await tx.get('posts',report.postId);if(!post)fail('NOT_FOUND');if(post.moderationStatus!=='hidden'){if(!Number.isInteger(post.revision)||post.revision<1)fail('UNAVAILABLE');post.moderationStatus='hidden';post.revision++;post.updatedAt=now;await tx.put('posts',post.id,post);}}
  report.status=action==='hide'?'resolved':'dismissed';report.resolution=action;report.handledAt=now;report.handledBy='FUJI management';await tx.put('reports',reportId,report);
  return {reportId,postId:report.postId,status:report.status,action,handledAt:now};
 });
}
module.exports={handleReports,report,hide,listHidden,moderateReport,REPORT_REASONS,reportIdFor};
