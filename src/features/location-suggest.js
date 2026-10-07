const codeFor=error=>error?.code===1?'LOCATION_DENIED':error?.code===3?'LOCATION_TIMEOUT':'LOCATION_UNAVAILABLE';
export function createLocationSuggest({geolocation=globalThis.navigator?.geolocation,repository,getGeneration=()=>0,visitorId,timeoutMs=25000}={}){
 let generation=0,busy=false;
 return {async suggest(){
  if(busy)return {suggestion:null,reason:'LOCATION_BUSY'};if(!geolocation?.getCurrentPosition)return {suggestion:null,reason:'LOCATION_UNAVAILABLE'};
  const turn=++generation,ownerGeneration=getGeneration();busy=true;let timer;
  try{
   const result=await Promise.race([(async()=>{const position=await new Promise((resolve,reject)=>geolocation.getCurrentPosition(resolve,reject,{maximumAge:0,timeout:10000,enableHighAccuracy:false}));if(turn!==generation||ownerGeneration!==getGeneration())return {suggestion:null,reason:'WORKSPACE_CHANGED'};const {latitude,longitude}=position.coords;const reply=await repository.request('regions.suggest',{latitude,longitude,...(visitorId?{visitorId}:{})});return reply;})(),new Promise(resolve=>{timer=setTimeout(()=>{if(turn===generation){generation++;busy=false;}resolve({suggestion:null,reason:'LOCATION_TIMEOUT'});},timeoutMs);})]);
   if(result?.reason==='LOCATION_TIMEOUT')return result;
   if(turn!==generation||ownerGeneration!==getGeneration())return {suggestion:null,reason:'WORKSPACE_CHANGED'};return result;
  }catch(error){return {suggestion:null,reason:typeof error?.code==='string'?error.code:codeFor(error)};}finally{clearTimeout(timer);if(turn===generation)busy=false;}
 },destroy(){generation++;busy=false;}};
}
