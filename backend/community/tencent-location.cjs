'use strict';
const {createHash}=require('node:crypto');
const error=code=>Object.assign(new Error(code),{code});
function coordinates({latitude,longitude}={}){if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude < -90||latitude > 90||longitude < -180||longitude > 180)throw error('INVALID_INPUT');return {latitude,longitude};}
const municipalities=new Set(['110000','120000','310000','500000','810000','820000']);
function projectDirectory(raw){
 if(raw?.status!==0||!Array.isArray(raw.result)||!Array.isArray(raw.result[0])||!Array.isArray(raw.result[1]))throw error('REGION_UNAVAILABLE');
 const [provinces,cities,districts=[]]=raw.result,items=[],seen=new Set();
 const add=(node,level,parentId)=>{const id=String(node?.id??'');if(!/^\d{6}$/.test(id)||typeof(node.fullname??node.name)!=='string'||!(node.fullname??node.name).trim()||seen.has(id))return;seen.add(id);items.push({id,name:(node.fullname??node.name).trim().slice(0,80),level,parentId,pinyin:Array.isArray(node.pinyin)?node.pinyin.join('').toLowerCase():String(node.pinyin??'').toLowerCase().slice(0,120)});};
 const range=(node,list)=>Array.isArray(node?.cidx)&&node.cidx.length===2&&node.cidx.every(Number.isInteger)?list.slice(node.cidx[0],node.cidx[1]+1):[];
 for(const province of provinces){
  const provinceId=String(province.id),direct=municipalities.has(provinceId),children=range(province,cities);if(direct)add(province,'city',null);
  for(const city of children){
   const cityId=direct?provinceId:String(city.id),lower=range(city,districts);
   if(direct&& !String(city.id).endsWith('00')){add(city,'district',provinceId);continue;}
   if(!direct&&/(?:省|自治区)直辖/.test(city.fullname??city.name??'')){for(const county of lower)add(county,'city',provinceId);continue;}
   if(!direct)add(city,'city',provinceId);for(const district of lower)add(district,'district',cityId);
  }
 }
 // A partial hierarchy must not masquerade as a current nationwide directory.
 if(!items.some(r=>r.level==='city'))throw error('REGION_UNAVAILABLE');return items;
}
function createTencentLocationClient({key,secretKey,fetch:fetchImpl=globalThis.fetch,timeoutMs=5000,maxResponseBytes=4*1024*1024}={}){
 const ready=typeof key==='string'&&key.length>0&&typeof secretKey==='string'&&secretKey.length>0;
 async function request(path,params){
  if(!ready||typeof fetchImpl!=='function')throw error('REGION_UNAVAILABLE');
  const encode=v=>encodeURIComponent(String(v)).replace(/%2C/gi,','),query=Object.entries({...params,key}).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${encode(v)}`).join('&');
  const sig=createHash('md5').update(`${path}?${query}${secretKey}`).digest('hex'),controller=new AbortController();let timer;
  try{
   const work=(async()=>{const response=await fetchImpl(`https://apis.map.qq.com${path}?${query}&sig=${sig}`,{signal:controller.signal,redirect:'error'});
   if(!response?.ok)throw error('REGION_UNAVAILABLE');let body;
   if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxResponseBytes){await reader.cancel();throw error('REGION_UNAVAILABLE');}chunks.push(Buffer.from(value));}body=JSON.parse(Buffer.concat(chunks,size).toString('utf8'));}
   else {body=await response.json();if(Buffer.byteLength(JSON.stringify(body))>maxResponseBytes)throw error('REGION_UNAVAILABLE');}
   if(body?.status!==0)throw error('REGION_UNAVAILABLE');return body;})();
   return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(error('REGION_UNAVAILABLE'));},timeoutMs);})]);
  }catch{throw error('REGION_UNAVAILABLE');}finally{clearTimeout(timer);}
 }
 return {isConfigured:()=>ready,async getDistrictDirectory(){return projectDirectory(await request('/ws/district/v1/list',{}));},async translateGps(input){const {latitude,longitude}=coordinates(input),body=await request('/ws/coord/v1/translate',{locations:`${latitude},${longitude}`,type:1}),point=body.locations?.[0];try{return coordinates({latitude:point?.lat,longitude:point?.lng});}catch{throw error('REGION_UNAVAILABLE');}},async reverse(input){const {latitude,longitude}=coordinates(input),body=await request('/ws/geocoder/v1',{location:`${latitude},${longitude}`,get_poi:0}),ad=body.result?.ad_info;if(!ad||!/^\d{6}$/.test(String(ad.adcode??'')))throw error('REGION_UNAVAILABLE');return {districtId:String(ad.adcode),cityName:String(ad.city??'').slice(0,80),districtName:String(ad.district??'').slice(0,80)};}};
}
module.exports={createTencentLocationClient,projectDirectory,coordinates};
