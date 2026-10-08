'use strict';
const cloudbase=require('@cloudbase/node-sdk');
const {createAuthService,createAuthStore,createEmailPlatform}=require('../../backend/email-auth.cjs');
const {readBetaPolicy,reviewedError}=require('../../backend/beta-access.cjs');
const {resolvePrincipal}=require('../../backend/identity.cjs');
const env=process.env.PAW_CLOUD_ENV_ID??'paw-diary-d8g3p4tlsb305221d';
const app=cloudbase.init({env,region:'ap-shanghai'});
exports.main=async(event,context)=>{try{
 const betaPolicy=readBetaPolicy(process.env,{requireInviteCode:true});
 const platform=createEmailPlatform({environmentId:env,publishableKey:process.env.PAW_CLOUD_PUBLISHABLE_KEY});
 const store=createAuthStore({db:app.database()});
 const readProof=uid=>store.transaction(tx=>tx.get('p:'+uid));
 const service=createAuthService({store,platform,betaPolicy,observe:(phase,flags)=>console.log(JSON.stringify({authPhase:phase,...flags,fieldNames:flags.fieldNames?.filter(k=>/^[A-Za-z_][A-Za-z0-9_]{0,60}$/.test(k))})),principalForToken:token=>resolvePrincipal(context,{auth:app.auth(),getPlatformContext:cloudbase.getCloudbaseContext,authToken:token,betaPolicy,readVerifiedProfile:platform.profile,readVerifiedProof:readProof})});
 const trusted=cloudbase.getCloudbaseContext(context);
 return await service.handle(event,{ip:trusted?.TCB_SOURCE_IP});
 }catch(error){return reviewedError(error);}};
