'use strict';
const{createHash}=require('node:crypto');
const collections=Object.freeze({profiles:'community_profiles',posts:'community_posts',comments:'community_comments',likes:'community_likes',reports:'community_reports',hidden:'community_hidden',receipts:'community_receipts',media:'community_media',rate_limits:'community_rate_limits',regions:'community_regions'});
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hash=value=>createHash('sha256').update(value).digest('hex');
const hashOwner=userId=>{if(typeof userId!=='string'||!userId)fail('UNAUTHENTICATED');return hash('paw-community-owner:'+userId);};
const clone=value=>value===undefined?undefined:structuredClone(value);
function checkKind(kind,id){if(!Object.hasOwn(collections,kind)||typeof id!=='string'||!id||id.length>256||/[\x00-\x1f]/.test(id))fail('INVALID_INPUT');}
function checkResult(r){if(r?.code)fail(r.code==='DATABASE_TRANSACTION_CONFLICT'?'CONFLICT':'UNAVAILABLE');return r;}
function profileHelpers(api){api.findProfileByAuthorId=id=>api.get('profiles',id);api.getOwnProfile=async ownerId=>{const index=await api.get('profiles','owner:'+ownerId);if(!index)return undefined;const profile=await api.get('profiles',index.authorId);if(!profile||profile.ownerId!==ownerId)fail('FORBIDDEN');return profile;};return api;}
const binding=filters=>hash(JSON.stringify(Object.entries(filters).filter(([k,v])=>!['cursor','limit'].includes(k)&&v!==undefined).sort(([a],[b])=>a.localeCompare(b))));
function pageConfig(filters,sortField,idField){const limit=filters.limit??20;if(!Number.isInteger(limit)||limit<1||limit>50)fail('INVALID_INPUT');let after=null;if(filters.cursor!==undefined&&filters.cursor!==null){if(typeof filters.cursor!=='string'||filters.cursor.length>1024)fail('INVALID_INPUT');try{after=JSON.parse(Buffer.from(filters.cursor,'base64url').toString());}catch{fail('INVALID_INPUT');}if(after?.v!==1||after.filter!==binding(filters)||typeof after.time!=='string'||typeof after.id!=='string'||after.time.length>64||after.id.length>128)fail('INVALID_INPUT');}return{limit,after,sortField,idField};}
function page(items,filters,sortField='createdAt',idField='id'){
 const{limit,after}=pageConfig(filters,sortField,idField),sorted=items.filter(v=>typeof v[sortField]==='string'&&typeof v[idField]==='string').sort((a,b)=>b[sortField].localeCompare(a[sortField])||b[idField].localeCompare(a[idField]));
 const eligible=after?sorted.filter(v=>v[sortField]<after.time||(v[sortField]===after.time&&v[idField]<after.id)):sorted,visible=eligible.slice(0,limit),last=visible.at(-1);
 return{items:visible.map(clone),nextCursor:eligible.length>limit?Buffer.from(JSON.stringify({v:1,filter:binding(filters),time:last[sortField],id:last[idField]})).toString('base64url'):null};
}
const livePost=p=>!!p&&p.deletedAt===null&&p.moderationStatus==='visible';
const matchProfile=(p,f)=>p.discoverable===true&&(!f.cityId||p.cityId===f.cityId)&&(!f.districtId||p.districtId===f.districtId)&&(!f.petTypes?.length||f.petTypes.some(t=>p.petTypes?.includes(t)))&&(!f.purposes?.length||f.purposes.some(t=>p.purposes?.includes(t)));
const matchPost=(p,f)=>livePost(p)&&(!f.cityId||p.cityId===f.cityId)&&(!f.districtId||p.districtId===f.districtId)&&(!f.topic||p.topic===f.topic)&&(!f.authorId||p.authorId===f.authorId)&&(!f.query||`${p.title}\n${p.text}`.toLowerCase().includes(f.query.toLowerCase()));
function createMemoryCommunityStore(){let data=new Map(),queue=Promise.resolve();const key=(kind,id)=>{checkKind(kind,id);return kind+'\0'+id;};const read=async(kind,id)=>clone(data.get(key(kind,id)));const values=kind=>[...data].filter(([k])=>k.startsWith(kind+'\0')).map(([,v])=>clone(v));
 const store=profileHelpers({get:read,async transaction(callback){const operation=queue.then(async()=>{const draft=new Map([...data].map(([k,v])=>[k,clone(v)]));const tx=profileHelpers({get:async(kind,id)=>clone(draft.get(key(kind,id))),put:async(kind,id,v)=>{draft.set(key(kind,id),clone(v));},remove:async(kind,id)=>{draft.delete(key(kind,id));}});const result=await callback(tx);data=draft;return result;});queue=operation.catch(()=>{});return operation;},async query(kind,filters={},options={}){checkKind(kind,'query');const limit=options.limit??100;if(!Number.isInteger(limit)||limit<1||limit>100)fail('INVALID_INPUT');return values(kind).filter(v=>Object.entries(filters).every(([k,x])=>v[k]===x)).slice(0,limit);},async discover(f={}){return page(values('profiles').filter(p=>matchProfile(p,f)),f,'updatedAt','authorId');},async listPosts(f={}){return page(values('posts').filter(p=>matchPost(p,f)),f);},async listComments(f={}){return page(values('comments').filter(c=>c.deletedAt===null&&c.postId===f.postId),f);},async listOwnHidden(ownerId,filters={}){return page(values('hidden').filter(h=>h.ownerId===ownerId&&h.hidden!==false),{...filters,ownerId});}});return store;
}
function createCommunityStore({db}={}){
 if(!db||typeof db.runTransaction!=='function')fail('UNAVAILABLE');
 const wrap=client=>profileHelpers({async get(kind,id){checkKind(kind,id);const r=checkResult(await client.collection(collections[kind]).doc(id).get());const doc=Array.isArray(r?.data)?r.data[0]:r?.data;if(!doc)return undefined;const value=clone(doc);delete value._id;return value;},async put(kind,id,value){checkKind(kind,id);if(!value||typeof value!=='object'||Array.isArray(value)||Buffer.byteLength(JSON.stringify(value))>64*1024)fail('INVALID_INPUT');checkResult(await client.collection(collections[kind]).doc(id).set(clone(value)));},async remove(kind,id){checkKind(kind,id);checkResult(await client.collection(collections[kind]).doc(id).remove());}});
 const api=wrap(db);
 async function query(kind,filters={},options={}){checkKind(kind,'query');const limit=options.limit??100;if(!Number.isInteger(limit)||limit<1||limit>100)fail('INVALID_INPUT');const r=checkResult(await db.collection(collections[kind]).where(filters).limit(limit).get());return(r.data??[]).map(v=>{const p=clone(v);delete p._id;return p;});}
 // Query windows are bounded. Stable keyset conditions use SDK command operators.
 async function list(kind,filters,where,sortField,idField,match){const{limit,after}=pageConfig(filters,sortField,idField),_=db.command;let condition=where;
   if(after){if(!_?.or||!_?.lt)fail('UNAVAILABLE');condition=_.and([where,_.or([{[sortField]:_.lt(after.time)},{[sortField]:after.time,[idField]:_.lt(after.id)}])]);}
   const result=checkResult(await db.collection(collections[kind]).where(condition).orderBy(sortField,'desc').orderBy(idField,'desc').limit(limit+1).get());const rows=(result.data??[]).map(v=>{const p=clone(v);delete p._id;return p;});
   // Client-visible filtering is also enforced here, regardless of query result shape.
   const passed=rows.filter(v=>match(v,filters));return page(passed,filters,sortField,idField);
 }
 return{get:api.get,findProfileByAuthorId:api.findProfileByAuthorId,getOwnProfile:api.getOwnProfile,transaction:callback=>db.runTransaction(tx=>callback(wrap(tx))),query,
  discover:async(f={})=>{const where={discoverable:true};if(f.cityId)where.cityId=f.cityId;if(f.districtId)where.districtId=f.districtId;if(f.petTypes?.length)where.petTypes=db.command.in(f.petTypes);if(f.purposes?.length)where.purposes=db.command.in(f.purposes);return list('profiles',f,where,'updatedAt','authorId',matchProfile);},
  listPosts:async(f={})=>{const where={deletedAt:null,moderationStatus:'visible'};for(const k of ['cityId','districtId','topic','authorId'])if(f[k])where[k]=f[k];if(f.query){if(!db.RegExp||!db.command?.or||!db.command?.and)fail('UNAVAILABLE');const regex=db.RegExp({regexp:f.query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),options:'i'});return list('posts',f,db.command.and([where,db.command.or([{title:regex},{text:regex}])]),'createdAt','id',matchPost);}return list('posts',f,where,'createdAt','id',matchPost);},
  listComments:f=>list('comments',f,{postId:f.postId,deletedAt:null},'createdAt','id',(c,f)=>c.deletedAt===null&&c.postId===f.postId),
  listOwnHidden:(ownerId,filters={})=>list('hidden',{...filters,ownerId},{ownerId},'createdAt','id',(h,f)=>h.ownerId===f.ownerId&&h.hidden!==false)};
}
module.exports={matchesPostFilters:matchPost,createCommunityStore,createMemoryCommunityStore,collections,hashOwner,hash,livePost,pageConfig,page};
