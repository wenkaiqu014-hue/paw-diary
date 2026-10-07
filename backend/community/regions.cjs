'use strict';
const {createHash}=require('node:crypto');
const {createLocationLimits}=require('./limits.cjs');
const {coordinates}=require('./tencent-location.cjs');
const error=code=>Object.assign(new Error(code),{code});
const DAY=24*3600000;
function createRegionsService({store,client,clock=()=>new Date(),providerReady=false,freeDaily=0,freeMonthly=0,limits=createLocationLimits({store,clock,freeDaily,freeMonthly}),refreshMs=DAY}={}){
 let refreshing=null;
 const now=()=>new Date(clock());
 async function load(){
  let cached;try{cached=await store.readDirectory();}catch{throw error('REGION_UNAVAILABLE');}
  const stale=!cached||now().getTime()-Date.parse(cached.updatedAt)>=refreshMs;
  if(stale&&providerReady&&client?.getDistrictDirectory){
   refreshing??=(async()=>{if(store.claimRefresh&&!await store.claimRefresh(now().getTime()))return;await limits.reserveUpstream();const items=await client.getDistrictDirectory();if(!Array.isArray(items)||!items.length)throw error('REGION_UNAVAILABLE');const version=createHash('sha256').update(JSON.stringify(items)).digest('hex');await store.writeDirectory({items,version,updatedAt:now().toISOString()});})().finally(()=>{refreshing=null;});
   try{await refreshing;cached=await store.readDirectory();}catch{/* Last-good cache remains usable; no supplier exception or URL escapes. */}
  }
  if(!cached)return null;return {...cached,stale:now().getTime()-Date.parse(cached.updatedAt)>=refreshMs};
 }
 async function normalize(input){if(input?.cityId==null&&input?.districtId==null)return {cityId:null,districtId:null,cityName:null,districtName:null};const directory=await load();if(!directory)throw error('REGION_UNAVAILABLE');const {normalizeRegion}=await import('../../src/domain/region-filter.js');return normalizeRegion(input,directory.items);}
 const metadata=d=>({available:!!d,version:d?.version??null,updatedAt:d?.updatedAt??null,stale:d?.stale??true,source:'Tencent WebService administrative districts',providerReady:!!providerReady});
 async function dispatch(action,payload={},context={}){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw error('INVALID_INPUT');
  if(!['regions.meta','regions.search','regions.children','regions.suggest'].includes(action))throw error('INVALID_INPUT');
  if(action==='regions.suggest'){
   const point=coordinates(payload);if(!providerReady||!client?.translateGps||!client?.reverse)throw error('REGION_UNAVAILABLE');
   await limits.reserveSuggestion({visitorId:context.visitorId??payload.visitorId,ipHash:context.ipHash});
   const directory=await load();if(!directory)throw error('REGION_UNAVAILABLE');
   await limits.reserveUpstream();let translated;try{translated=coordinates(await client.translateGps(point));}catch{throw error('REGION_UNAVAILABLE');}
   await limits.reserveUpstream();let region;try{region=await client.reverse(translated);}catch{throw error('REGION_UNAVAILABLE');}
   // Identify this exception only by the supplier's region code, never a guessed rectangle.
   if(String(region.districtId).startsWith('71'))return {...metadata(directory),suggestion:null,reason:'LOCATION_MANUAL_REQUIRED'};
   const district=directory.items.find(r=>r.level==='district'&&r.id===region.districtId),city=directory.items.find(r=>r.level==='city'&&r.id===(district?.parentId??region.districtId));
   if(!city)return {...metadata(directory),suggestion:null,reason:'LOCATION_NOT_IN_DIRECTORY'};
   const suggestion=await normalize({cityId:city.id,districtId:district?.id??null});return {...metadata(directory),suggestion};
  }
  const directory=await load();if(action==='regions.meta')return metadata(directory);if(!directory)throw error('REGION_UNAVAILABLE');
  if(action==='regions.children'){if(typeof payload.parentId!=='string'||!directory.items.some(r=>r.id===payload.parentId&&r.level==='city'))throw error('INVALID_INPUT');return {...metadata(directory),items:directory.items.filter(r=>r.level==='district'&&r.parentId===payload.parentId).sort((a,b)=>a.id.localeCompare(b.id))};}
  const {level='city',query='',parentId=null,cursor=null}=payload,limit=payload.limit??20;
  if(!['city','district'].includes(level)||typeof query!=='string'||query.length>80||!Number.isInteger(limit)||limit<1||limit>50||parentId!==null&&typeof parentId!=='string')throw error('INVALID_INPUT');
  if(parentId!==null&&!directory.items.some(r=>r.id===parentId&&r.level==='city'))throw error('INVALID_INPUT');
  const needle=query.trim().toLowerCase(),items=directory.items.filter(r=>r.level===level&&(!parentId||r.parentId===parentId)&&(!needle||r.name.toLowerCase().includes(needle)||r.pinyin?.includes(needle)||r.id.includes(needle))).sort((a,b)=>a.id.localeCompare(b.id));
  const signature=createHash('sha256').update(JSON.stringify({level,query,parentId,version:directory.version})).digest('hex');let start=0;
  if(cursor){try{if(typeof cursor!=='string'||cursor.length>512)throw Error();const decoded=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));if(decoded.signature!==signature)throw Error();const index=items.findIndex(r=>r.id===decoded.lastId);if(index<0)throw Error();start=index+1;}catch{throw error('INVALID_INPUT');}}
  const slice=items.slice(start,start+limit),nextCursor=start+limit<items.length?Buffer.from(JSON.stringify({signature,lastId:slice.at(-1).id})).toString('base64url'):null;return {...metadata(directory),items:slice,nextCursor};
 }
 return {dispatch,normalize,normalizeRegion:normalize,meta:()=>dispatch('regions.meta',{})};
}
module.exports={createRegionsService};
