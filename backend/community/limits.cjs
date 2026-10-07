'use strict';
const {createHash}=require('node:crypto');
const error=code=>Object.assign(new Error(code),{code});
function createLocationLimits({store,clock=()=>new Date(),freeDaily=0,freeMonthly=0,daily=100,monthly=1000}={}){
 const bounded=(value,max)=>Number.isSafeInteger(value)&&value>=0?Math.min(value,max):0;
 const dayLimit=Math.min(bounded(daily,100),bounded(freeDaily,100)),monthLimit=Math.min(bounded(monthly,1000),bounded(freeMonthly,1000));
 const dates=()=>{const now=new Date(clock());if(!Number.isFinite(now.getTime()))throw error('REGION_UNAVAILABLE');const day=new Date(now.getTime()+8*3600000).toISOString().slice(0,10);return{day,month:day.slice(0,7)};};
 async function reserve(keys){if(!store?.transaction)throw error('REGION_UNAVAILABLE');return store.transaction(async tx=>{const counters=await Promise.all(keys.map(async({key,limit})=>({key,limit,count:(await tx.get(key))?.count??0})));if(counters.some(c=>!Number.isSafeInteger(c.count)||c.count<0||c.count>=c.limit))throw error('LOCATION_QUOTA_EXCEEDED');for(const c of counters)await tx.put(c.key,{count:c.count+1});return true;});}
 return {reserveUpstream(){const {day,month}=dates();return reserve([{key:'upstream:day:'+day,limit:dayLimit},{key:'upstream:month:'+month,limit:monthLimit}]);},async reserveSuggestion({visitorId,ipHash}={}){if(typeof visitorId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(visitorId)||typeof ipHash!=='string'||!/^[a-f0-9]{64}$/.test(ipHash))throw error('REGION_UNAVAILABLE');const {day}=dates(),visitor=createHash('sha256').update(visitorId).digest('hex');return reserve([{key:`visitor:${day}:${visitor}`,limit:5},{key:`ip:${day}:${ipHash}`,limit:10}]);}};
}
module.exports={createLocationLimits};
