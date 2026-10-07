'use strict';
const {createHash,randomUUID}=require('node:crypto');
const error=code=>Object.assign(new Error(code),{code});
function createLocationLimits({store,clock=()=>new Date(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),freeDaily=0,freeMonthly=0,daily=100,monthly=1000,queueWaitMs=1250,qpsIntervalMs=250}={}){
 const bounded=(value,max)=>Number.isSafeInteger(value)&&value>=0?Math.min(value,max):0;
 const dayLimit=Math.min(bounded(daily,100),bounded(freeDaily,100)),monthLimit=Math.min(bounded(monthly,1000),bounded(freeMonthly,1000));
 const dates=()=>{const now=new Date(clock());if(!Number.isFinite(now.getTime()))throw error('REGION_UNAVAILABLE');const day=new Date(now.getTime()+8*3600000).toISOString().slice(0,10);return{day,month:day.slice(0,7)};};
 async function reserveCounters(tx,keys){const counters=await Promise.all(keys.map(async({key,limit})=>({key,limit,count:(await tx.get(key))?.count??0})));if(counters.some(c=>!Number.isSafeInteger(c.count)||c.count<0||c.count>=c.limit))throw error('LOCATION_QUOTA_EXCEEDED');for(const c of counters)await tx.put(c.key,{count:c.count+1});return true;}
 async function reserve(keys){if(!store?.transaction)throw error('REGION_UNAVAILABLE');return store.transaction(tx=>reserveCounters(tx,keys));}
 const upstreamKeys=()=>{const {day,month}=dates();return [{key:'upstream:day:'+day,limit:dayLimit},{key:'upstream:month:'+month,limit:monthLimit}];};
 const interval=Number.isFinite(qpsIntervalMs)?Math.max(250,qpsIntervalMs):250,maxWait=Number.isFinite(queueWaitMs)?Math.max(0,Math.min(1500,queueWaitMs)):1250;
 async function callUpstream(operation){
  if(typeof operation!=='function'||!store?.transaction)throw error('REGION_UNAVAILABLE');
  const leaseId=randomUUID(),began=Number(new Date(clock())),wallBegan=Date.now();let acquired=false,attempted=false;
  // A shared lease covers the actual HTTP request. Pacing starts after completion,
  // so slow responses/late wakeups cannot bunch independently reserved future slots.
  while(!acquired){
   const now=Number(new Date(clock()));if(!Number.isFinite(now))throw error('REGION_UNAVAILABLE');
   if(attempted&&(now-began>=maxWait||Date.now()-wallBegan>=maxWait))throw error('LOCATION_RATE_LIMITED');attempted=true;
   const result=await store.transaction(async tx=>{const gate=await tx.get('upstream:shared-qps')??{},blockedUntil=Math.max(gate.leaseUntil??0,gate.nextAllowedAt??0);if(blockedUntil>now)return {delay:Math.min(250,blockedUntil-now)};await reserveCounters(tx,upstreamKeys());await tx.put('upstream:shared-qps',{leaseId,leaseUntil:now+15000,nextAllowedAt:gate.nextAllowedAt??0});return {acquired:true};});
   if(result.acquired){acquired=true;break;}
   const remaining=Math.min(maxWait-(now-began),maxWait-(Date.now()-wallBegan));if(remaining<=0)throw error('LOCATION_RATE_LIMITED');await sleep(Math.min(result.delay,remaining));
  }
  try{return await operation();}
  finally{await store.transaction(async tx=>{const gate=await tx.get('upstream:shared-qps');if(gate?.leaseId!==leaseId)return;const now=Number(new Date(clock()));if(!Number.isFinite(now))throw error('REGION_UNAVAILABLE');await tx.put('upstream:shared-qps',{leaseId:null,leaseUntil:0,nextAllowedAt:now+interval});});}
 }
 return {callUpstream,reserveUpstream:()=>reserve(upstreamKeys()),async reserveSuggestion({visitorId,ipHash}={}){if(typeof visitorId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(visitorId)||typeof ipHash!=='string'||!/^[a-f0-9]{64}$/.test(ipHash))throw error('REGION_UNAVAILABLE');const {day}=dates(),visitor=createHash('sha256').update(visitorId).digest('hex');return reserve([{key:`visitor:${day}:${visitor}`,limit:5},{key:`ip:${day}:${ipHash}`,limit:10}]);}};
}
module.exports={createLocationLimits};
