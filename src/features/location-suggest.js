let memoryVisitorId=null;
export function getLocationVisitorId({storage,idFactory=()=>globalThis.crypto.randomUUID()}={}){const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(value);try{const target=storage??globalThis.localStorage,old=target?.getItem('paw-diary:location-visitor');if(valid(old)){memoryVisitorId=old;return old;}memoryVisitorId??=idFactory();target?.setItem('paw-diary:location-visitor',memoryVisitorId);return memoryVisitorId;}catch{memoryVisitorId??=idFactory();return memoryVisitorId;}}
const codeFor=error=>error?.code===1?'LOCATION_DENIED':error?.code===3?'LOCATION_TIMEOUT':'LOCATION_UNAVAILABLE';
export function createLocationSuggest({geolocation=globalThis.navigator?.geolocation,repository,getGeneration=()=>0,visitorId,timeoutMs=25000}={}){
 let generation=0,busy=false;
 return {async suggest(){
  if(busy)return {suggestion:null,reason:'LOCATION_BUSY'};if(!geolocation?.getCurrentPosition)return {suggestion:null,reason:'LOCATION_UNSUPPORTED'};
  const turn=++generation,ownerGeneration=getGeneration(),requestVisitor=visitorId??getLocationVisitorId();busy=true;let timer;
  try{
   const result=await Promise.race([(async()=>{const position=await new Promise((resolve,reject)=>geolocation.getCurrentPosition(resolve,reject,{maximumAge:0,timeout:10000,enableHighAccuracy:false}));if(turn!==generation||ownerGeneration!==getGeneration())return {suggestion:null,reason:'WORKSPACE_CHANGED'};const {latitude,longitude}=position.coords;const reply=await repository.request('regions.suggest',{latitude,longitude,visitorId:requestVisitor});return reply;})(),new Promise(resolve=>{timer=setTimeout(()=>{if(turn===generation){generation++;busy=false;}resolve({suggestion:null,reason:'LOCATION_TIMEOUT'});},timeoutMs);})]);
   if(result?.reason==='LOCATION_TIMEOUT')return result;
   if(turn!==generation||ownerGeneration!==getGeneration())return {suggestion:null,reason:'WORKSPACE_CHANGED'};return result;
  }catch(error){return {suggestion:null,reason:typeof error?.code==='string'?error.code:codeFor(error)};}finally{clearTimeout(timer);if(turn===generation)busy=false;}
 },destroy(){generation++;busy=false;}};
}

export function locationFailureMessage(reason,locale='zh-CN'){
 const messages={
 LOCATION_UNAVAILABLE:['浏览器未能获取当前位置。请检查系统定位及浏览器位置权限，或手动选择地区。','Your browser could not obtain a position. Check system location settings and browser permissions, or choose a region manually.'],
 LOCATION_UNSUPPORTED:['当前浏览器无法提供定位，请换用支持定位的浏览器或手动选择地区。','This browser does not support location. Use a supported browser or choose a region manually.'],
 LOCATION_DENIED:['位置权限未开启。请检查系统及浏览器的位置权限，或手动选择地区。','Location permission was denied. Check system and browser permissions, or choose a region manually.'],
 LOCATION_TIMEOUT:['定位超时，请检查网络后重试，或手动选择地区。','Location timed out. Check your connection and retry, or choose a region manually.'],
 LOCATION_RATE_LIMITED:['定位请求较多，请稍后重试，也可以手动选择地区。','Location requests are busy. Retry later or choose a region manually.'],
 LOCATION_QUOTA_EXCEEDED:['本期定位额度已用完，请手动选择地区。','The location allowance is exhausted. Choose a region manually.'],
 LOCATION_NOT_IN_DIRECTORY:['当前位置暂不在可选地区目录中，请手动选择地区。','Your position is not in the supported region directory. Choose a region manually.'],
 LOCATION_MANUAL_REQUIRED:['当前位置需要手动选择地区，请选择城市和行政区。','This position requires manual region selection. Choose a city and district.'],
 LOCATION_BUSY:['正在获取位置，请等待本次请求完成。','Location is being requested. Wait for the current request.'],
 WORKSPACE_CHANGED:['账号已切换，请重新获取建议或手动选择地区。','Your account changed. Request a new suggestion or choose a region manually.']};
 const unavailable=['地区解析服务暂时不可用，请稍后重试或手动选择地区。','The region lookup service is unavailable. Retry later or choose a region manually.'];
 return (messages[reason]??unavailable)[locale==='en'?1:0];
}
