import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudApiError,createCloudRepository} from '../src/data/cloud-repository.js';
const snapshot={version:3,mode:'account',pets:[],records:[],reminders:[],posts:[],activePetId:null,profile:{city:'深圳'}};
const makeRepo=invoke=>createCloudRepository({invoke,principal:{userId:'synthetic-user'},storage:null});
function assertError(error,code,params){
 assert.ok(error instanceof CloudApiError);assert.equal(error.code,code);assert.equal(error.messageKey,'errors.'+code.toLowerCase());assert.equal(error.message,error.messageKey);assert.deepEqual(error.params,params);return true;
}
for(const code of ['BETA_ACCESS_REQUIRED','BETA_CONFIG_INVALID','RATE_LIMITED']){
 test(`snapshot preserves reviewed thrown ${code} and discards private message`,async()=>{
  const error=Object.assign(new Error('private upstream email/token detail'),{code,messageKey:'private.raw',params:{retryAfterSeconds:45,private:'do not forward'}});
  await assert.rejects(makeRepo(async()=>{throw error;}).snapshot(),e=>assertError(e,code,code==='RATE_LIMITED'?{retryAfterSeconds:45}:undefined));
 });
 test(`write retry preserves reviewed thrown ${code} without exposing original params`,async()=>{
  let writes=0;const repo=makeRepo(async request=>{if(request.action==='health.snapshot')return{ok:true,data:snapshot,revision:0};writes++;throw Object.assign(Error('private upstream'),{code,messageKey:'unsafe',params:{retryAfterSeconds:0,extra:'private'}});});
  await repo.snapshot();await assert.rejects(repo.request('profile.save',{city:'深圳'},{operationId:'synthetic-op'}),e=>assertError(e,code,code==='RATE_LIMITED'?{retryAfterSeconds:0}:undefined));assert.equal(writes,2);
 });
}
for(const [name,seconds,want]of [['upper bound',86400,{retryAfterSeconds:86400}],['too large',86401,undefined],['negative',-1,undefined],['fractional',1.5,undefined],['string','30',undefined],['unsafe integer',Number.MAX_SAFE_INTEGER+1,undefined]])test(`thrown RATE_LIMITED ${name} keeps only bounded integer retry timing`,async()=>{
 await assert.rejects(makeRepo(async()=>{throw{code:'RATE_LIMITED',params:{retryAfterSeconds:seconds}};}).snapshot(),e=>assertError(e,'RATE_LIMITED',want));
});
for(const retry of [false,true])test(`unknown thrown private error stays generic on ${retry?'retry':'initial'} path`,async()=>{
 const repo=makeRepo(async request=>{if(retry&&request.action==='health.snapshot')return{ok:true,data:snapshot,revision:0};throw Object.assign(Error('secret token=unsafe'),{code:'UNEXPECTED_PRIVATE',messageKey:'private.secret',params:{retryAfterSeconds:15}});});
 if(retry)await repo.snapshot();await assert.rejects(retry?repo.request('profile.save',{}, {operationId:'synthetic-op'}):repo.snapshot(),e=>assertError(e,'UNAVAILABLE',undefined));
});
