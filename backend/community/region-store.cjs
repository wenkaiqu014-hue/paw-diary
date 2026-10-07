'use strict';
const {createHash}=require('node:crypto');
const error=code=>Object.assign(new Error(code),{code});
const LIMIT=64*1024;
function createRegionStore({db}={}){
 if(!db?.runTransaction)throw error('REGION_UNAVAILABLE');
 const id=key=>createHash('sha256').update(key).digest('hex');
 const check=result=>{if(result?.code)throw error('REGION_UNAVAILABLE');return result;};
 const read=async(client,collection,key)=>{const result=check(await client.collection(collection).doc(id(key)).get()),value=Array.isArray(result.data)?result.data[0]:result.data;return value?.value===undefined?null:structuredClone(value.value);};
 const put=async(client,collection,key,value)=>{const doc={value:structuredClone(value)};if(Buffer.byteLength(JSON.stringify(doc))>LIMIT)throw error('REGION_UNAVAILABLE');check(await client.collection(collection).doc(id(key)).set(doc));};
 const store={
  transaction:callback=>db.runTransaction(tx=>callback({get:key=>read(tx,'community_rate_limits','regions:'+key),put:(key,value)=>put(tx,'community_rate_limits','regions:'+key,value)})),
  async readDirectory(){const meta=await read(db,'community_regions','manifest');if(!meta)return null;const items=[];for(const chunk of meta.chunks){const block=await read(db,'community_regions',chunk);if(!Array.isArray(block))throw error('REGION_UNAVAILABLE');items.push(...block);}return {items,version:meta.version,updatedAt:meta.updatedAt};},
  async writeDirectory({items,version,updatedAt}){
   if(!Array.isArray(items)||!items.length||!Number.isFinite(Date.parse(updatedAt))||typeof version!=='string'||version.length>100)throw error('REGION_UNAVAILABLE');
   const allowed=items.map(item=>{if(!/^\d{6}$/.test(item.id??'')||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||!['city','district'].includes(item.level)||item.parentId!==null&&!/^\d{6}$/.test(item.parentId??''))throw error('REGION_UNAVAILABLE');return {id:item.id,name:item.name,level:item.level,parentId:item.parentId,pinyin:String(item.pinyin??'').toLowerCase().slice(0,120)};});
   if(new Set(allowed.map(r=>r.id)).size!==allowed.length)throw error('REGION_UNAVAILABLE');
   const chunks=[];let block=[];const flush=async()=>{if(!block.length)return;const key=`chunk:${createHash('sha256').update(JSON.stringify(block)).digest('hex')}`;await put(db,'community_regions',key,block);chunks.push(key);block=[];};
   for(const item of allowed){if(Buffer.byteLength(JSON.stringify({value:[...block,item]}))>LIMIT)await flush();block.push(item);}await flush();await db.runTransaction(tx=>put(tx,'community_regions','manifest',{version,updatedAt,chunks}));
  },
  claimRefresh:async(now,leaseMs=20000)=>store.transaction(async tx=>{const lease=await tx.get('refresh-lease');if(lease&&lease.until>now)return false;await tx.put('refresh-lease',{until:now+leaseMs});return true;}),
 };return store;
}
module.exports={createRegionStore};
