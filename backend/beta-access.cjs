'use strict';
const {createHash,timingSafeEqual}=require('node:crypto');
const {ApiError}=require('./workspace.cjs');
const fingerprint=(enabled,secret='')=>createHash('sha256').update(`paw-beta:v1:${enabled?'on':'off'}:${secret}`).digest('hex');
const DISABLED_BETA_POLICY=Object.freeze({enabled:false,fingerprint:fingerprint(false)});
const reviewed=new Set(['BETA_CODE_REQUIRED','BETA_CODE_INVALID','BETA_ACCESS_REQUIRED','BETA_CONFIG_INVALID','RATE_LIMITED','UNAUTHENTICATED','INVALID_INPUT']);
function readBetaPolicy(env,{requireInviteCode=false}={}) {
 const flag=env?.PAW_BETA_GATE_ENABLED;
 if(flag!=='true'&&flag!=='false')throw new ApiError('BETA_CONFIG_INVALID');
 const enabled=flag==='true';
 if(!enabled)return DISABLED_BETA_POLICY;
 if(!requireInviteCode)return {enabled:true,fingerprint:fingerprint(true)};
 const inviteCode=env.PAW_BETA_INVITE_CODE;
 if(typeof inviteCode!=='string'||!/^\d{6}$/.test(inviteCode))throw new ApiError('BETA_CONFIG_INVALID');
 return {enabled:true,inviteCode,fingerprint:fingerprint(true,inviteCode)};
}
function validIso(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))return false;
 const canonical=new Date(value).toISOString();return value===canonical||value===canonical.replace('.000Z','Z');
}
function validProof(proof,uid,email) {
 return !!proof&&proof.kind==='verified'&&proof.ownerId===uid&&typeof uid==='string'&&!!uid&&
 typeof proof.emailHash==='string'&&/^[a-f0-9]{64}$/.test(proof.emailHash)&&
 (email===undefined||proof.emailHash===createHash('sha256').update(email.trim()).digest('hex'))&&
 validIso(proof.verifiedAt);
}
function hasBetaAdmission(proof,uid,email) {
 const grant=proof?.betaAdmission;
 return validProof(proof,uid,email)&&!!grant&&grant.version===1&&['invite','legacy'].includes(grant.source)&&
 validIso(grant.grantedAt);
}
function assertBetaAdmission(policy,proof,uid,email) {
 if(policy?.enabled&&!hasBetaAdmission(proof,uid,email))throw new ApiError('BETA_ACCESS_REQUIRED');
}
function betaCodeError(policy,code) {
 if(!policy.enabled)return null;
 if(typeof policy.inviteCode!=='string'||!/^\d{6}$/.test(policy.inviteCode)||typeof policy.fingerprint!=='string'||!policy.fingerprint)throw new ApiError('BETA_CONFIG_INVALID');
 if(code===undefined||code===null||code==='')return 'BETA_CODE_REQUIRED';
 if(typeof code!=='string'||!/^\d{6}$/.test(code))return 'BETA_CODE_INVALID';
 return timingSafeEqual(Buffer.from(code),Buffer.from(policy.inviteCode))?null:'BETA_CODE_INVALID';
}
function reviewedError(error,fallbackKey='errors.unavailable') {
 if(error instanceof ApiError&&reviewed.has(error.code))return {ok:false,error:{code:error.code,messageKey:error.messageKey,...(error.params?{params:error.params}:{})}};
 return {ok:false,error:{code:'UNAVAILABLE',messageKey:fallbackKey}};
}
module.exports={readBetaPolicy,DISABLED_BETA_POLICY,validProof,hasBetaAdmission,assertBetaAdmission,betaCodeError,reviewedError};
