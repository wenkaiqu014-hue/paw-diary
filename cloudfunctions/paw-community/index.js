'use strict';
const cloudbase=require('@cloudbase/node-sdk');
const{resolvePrincipal}=require('../../backend/identity.cjs');
const{createPlatformProfileLookup}=require('../../backend/verified-profile.cjs');
const{createAuthStore}=require('../../backend/email-auth.cjs');
const{createCloudbaseStorage}=require('../../backend/storage.cjs');
const{createCommunityStore,hash}=require('../../backend/community/store.cjs');
const{handleCommunity}=require('../../backend/community/gateway.cjs');
const{handleCommunityMedia}=require('../../backend/community/media.cjs');
const{handlePosts}=require('../../backend/community/posts.cjs');
const{handleInteractions}=require('../../backend/community/interactions.cjs');
const{handleReports}=require('../../backend/community/reports.cjs');
const{createRegionStore}=require('../../backend/community/region-store.cjs');
const{createRegionsService}=require('../../backend/community/regions.cjs');
const{createTencentLocationClient}=require('../../backend/community/tencent-location.cjs');
const environmentId=process.env.PAW_CLOUD_ENV_ID??'paw-diary-d8g3p4tlsb305221d';
const application=cloudbase.init({env:environmentId,region:'ap-shanghai'});
// Dependency injection keeps the actual SDK proof/identity implementation in tests.
function createCommunityEntrypoint({app=application,getPlatformContext=cloudbase.getCloudbaseContext,readVerifiedProfile,readVerifiedProof,store,storage,regions,handlers={},clock=Date.now,idFactory}={}){
 const lookup=readVerifiedProfile??createPlatformProfileLookup({environmentId,publishableKey:process.env.PAW_CLOUD_PUBLISHABLE_KEY});
 return async(event,context)=>{
  try{
   const platform=getPlatformContext(context),hasEventToken=Object.hasOwn(event??{},'authToken'),contextToken=context?.extendedContext?.accessToken,token=hasEventToken?event.authToken:contextToken,hasCredential=hasEventToken||contextToken!==undefined;
   if(hasEventToken&&contextToken!==undefined&&contextToken!==token)return{ok:false,error:{code:'UNAUTHENTICATED',messageKey:'errors.community.unauthenticated'}};
   if(hasCredential&&(typeof token!=='string'||!token||token.length>8192||/[\s\x00-\x1f\x7f]/.test(token)))return{ok:false,error:{code:'UNAUTHENTICATED',messageKey:'errors.community.unauthenticated'}};
   let profilePromise;const verifiedLookup=credential=>{profilePromise??=lookup(credential);return profilePromise;};
   const principal=hasCredential?await resolvePrincipal(context,{auth:app.auth(),getPlatformContext,authToken:token,readVerifiedProfile:verifiedLookup,readVerifiedProof:readVerifiedProof??(uid=>createAuthStore({db:app.database()}).transaction(tx=>tx.get('p:'+uid)))}):null;
   if(hasCredential&&!principal)return{ok:false,error:{code:'UNAUTHENTICATED',messageKey:'errors.community.unauthenticated'}};
   const request={...event};delete request.authToken;
   // CloudBase injects transport metadata; it is never an identity authority.
   delete request.tcbContext;
   const db=store&&storage&&regions?null:app.database(),publicStore=store??createCommunityStore({db}),publicStorage=storage??createCloudbaseStorage({app,readTimeoutMs:15000});
   const locationService=regions??createRegionsService({store:createRegionStore({db}),client:createTencentLocationClient({key:process.env.PAW_LBS_KEY,secretKey:process.env.PAW_LBS_SECRET_KEY}),providerReady:process.env.PAW_LBS_PROVIDER_READY==='true',freeDaily:Number(process.env.PAW_LBS_FREE_DAILY??0),freeMonthly:Number(process.env.PAW_LBS_FREE_MONTHLY??0),clock});
   const builtinHandlers={
    community:(r,d)=>['community.report','community.hide','community.hidden.list'].includes(r.action)?handleReports(r.action,r.payload,d):handlePosts(r.action,r.payload,d),
    comments:(r,d)=>handleInteractions(r.action,r.payload,d),
    likes:(r,d)=>handleInteractions(r.action,r.payload,d),
    'community.media':(r,d)=>handleCommunityMedia(r.action,r.payload,{...d,clock:()=>new Date(clock()).getTime()}),
    regions:(r,d)=>locationService.dispatch(r.action,r.payload,{principal:d.principal,visitorId:r.payload?.visitorId,ipHash:d.ipHash}),
    ...handlers,
   };
   const reply=await handleCommunity(request,{principal,hasCredential,store:publicStore,storage:publicStorage,regions:locationService,clock,idFactory,handlers:builtinHandlers,sourceIp:platform?.TCB_SOURCE_IP,ipHash:typeof platform?.TCB_SOURCE_IP==='string'&&platform.TCB_SOURCE_IP?hash('paw-community-ip:'+platform.TCB_SOURCE_IP):undefined,
    getOwnAccountInfo:async p=>{const profile=await profilePromise;if(!principal||p.userId!==principal.userId||(profile?.sub??profile?.uid??profile?.id)!==principal.userId||typeof profile?.email!=='string')throw Object.assign(new Error('UNAUTHENTICATED'),{code:'UNAUTHENTICATED'});return{email:profile.email};},
   });
   return reply;
  }catch(error){return{ok:false,error:{code:'UNAVAILABLE',messageKey:'errors.community.unavailable'}};}
 };
}
exports.createCommunityEntrypoint=createCommunityEntrypoint;
exports.main=createCommunityEntrypoint();
