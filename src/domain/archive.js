import {clone,validateSnapshot,migrateV1,migrateV2,isoTime} from './schema.js?v=0.2.0';
import {inspectImageBlob,MAX_DISPLAY_BYTES} from '../media/process-image.js';
export const MAX_ARCHIVE_BYTES=100*1024*1024;
const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['ownerId','fileId','fileRef','url','downloadUrl','token','session'].includes(key)).map(([key,item])=>[key,clean(item)])):value;
const bytesToBase64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
function base64ToBytes(base64){if(typeof base64!=='string'||!base64.length||base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error('照片编码无效');try{const binary=atob(base64);return Uint8Array.from(binary,c=>c.charCodeAt(0));}catch{throw new Error('照片编码无效');}}
export async function hashBlob(blob){const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function checkSize(raw,maxBytes){if(new Blob([typeof raw==='string'?raw:JSON.stringify(raw)]).size>maxBytes)throw new Error('完整备份超过100MiB上限');}
function portableSnapshot(snapshot){const result=clean(snapshot);result.mode='local';result.posts=[];result.profile={city:result.profile?.city??'深圳'};return validateSnapshot(result);}
function assetMetadata(raw){if(!raw||typeof raw!=='object')throw new Error('照片元数据无效');const {id,petId,kind,caption='',createdAt,mime,bytes,sha256}=raw;if(typeof id!=='string'||!id.trim()||typeof petId!=='string'||!petId.trim()||!['photo','avatar'].includes(kind)||typeof caption!=='string'||caption.length>200||!['image/jpeg','image/png','image/webp'].includes(mime)||!Number.isInteger(bytes)||bytes<=0||bytes>MAX_DISPLAY_BYTES||typeof sha256!=='string'||!/^[a-f0-9]{64}$/.test(sha256))throw new Error('照片元数据无效');return {id,petId,kind,caption,createdAt:isoTime(createdAt),mime,bytes,sha256};}
export async function validateArchive(raw,{maxBytes=MAX_ARCHIVE_BYTES}={}){
  checkSize(raw,maxBytes);let parsed;try{parsed=typeof raw==='string'?JSON.parse(raw):clone(raw);}catch{throw new Error('备份不是有效JSON');}
  if(!parsed||typeof parsed!=='object')throw new Error('备份格式无效');
  if(parsed.format!=='paw-diary-archive'){
    if(![1,2,3].includes(parsed.version))throw new Error('不支持此备份版本');
    const migrated=parsed.version===1?migrateV1(parsed,{now:'1970-01-01T00:00:00.000Z'}):parsed.version===2?migrateV2(parsed):parsed;
    const snapshot=portableSnapshot(migrated);for(const pet of snapshot.pets)pet.avatarAssetId=null;
    return {format:'paw-diary-archive',formatVersion:1,archiveId:'legacy',sourceWorkspaceId:'legacy:health-json',exportedAt:'1970-01-01T00:00:00.000Z',snapshot,assets:[],legacy:true};
  }
  if(parsed.formatVersion!==1||typeof parsed.archiveId!=='string'||!parsed.archiveId.trim()||typeof parsed.sourceWorkspaceId!=='string'||!parsed.sourceWorkspaceId.trim()||!Array.isArray(parsed.assets))throw new Error('完整备份格式无效');
  const snapshot=portableSnapshot(parsed.snapshot),pets=new Map(snapshot.pets.map(p=>[p.id,p])),assets=[],ids=new Set();let total=0;
  for(const item of parsed.assets){const metadata=assetMetadata(item.metadata);if(ids.has(metadata.id))throw new Error('照片ID重复');ids.add(metadata.id);if(!pets.has(metadata.petId))throw new Error('照片没有对应宠物');const bytes=base64ToBytes(item.base64);if(bytes.byteLength!==metadata.bytes)throw new Error('照片大小不一致');const blob=new Blob([bytes],{type:metadata.mime});await inspectImageBlob(blob,{maxBytes:MAX_DISPLAY_BYTES});if(await hashBlob(blob)!==metadata.sha256)throw new Error('照片hash不一致');total+=blob.size;if(total>50*1024*1024)throw new Error('照片总容量超过50MiB配额');assets.push({metadata,base64:item.base64,blob});}
  const map=new Map(assets.map(a=>[a.metadata.id,a.metadata]));for(const pet of snapshot.pets)if(pet.avatarAssetId){const avatar=map.get(pet.avatarAssetId);if(!avatar||avatar.kind!=='avatar'||avatar.petId!==pet.id)throw new Error('头像照片关联无效或文件缺失');}
  return {format:parsed.format,formatVersion:1,archiveId:parsed.archiveId,sourceWorkspaceId:parsed.sourceWorkspaceId,exportedAt:isoTime(parsed.exportedAt),snapshot,assets};
}
export async function exportArchive({repository,media=repository.media,clock=()=>new Date().toISOString(),idFactory=()=>crypto.randomUUID(),maxBytes=MAX_ARCHIVE_BYTES}={}){
  const snapshot=portableSnapshot(await repository.snapshot()),revision=repository.getRevision?.(),assets=[];
  if(!media?.listAll||!media?.read)throw new Error('完整备份需要可完整读取的媒体仓储');
  for(const metadata of await media.listAll()){const result=await media.read(metadata.id,{includeDeleted:true}),blob=result.blob;if(!(blob instanceof Blob))throw new Error('照片文件缺失');const normalized=assetMetadata(metadata);if(blob.size!==normalized.bytes||await hashBlob(blob)!==normalized.sha256)throw new Error('照片文件校验失败');assets.push({metadata:normalized,base64:bytesToBase64(new Uint8Array(await blob.arrayBuffer()))});}
  if(repository.getRevision?.()!==revision)throw new Error('导出期间资料已更新，请刷新后重试');
  const archive={format:'paw-diary-archive',formatVersion:1,archiveId:idFactory(),sourceWorkspaceId:repository.getWorkspaceId(),exportedAt:isoTime(clock()),snapshot,assets};checkSize(archive,maxBytes);await validateArchive(archive,{maxBytes});return archive;
}
const fields={pet:'pets',record:'records',reminder:'reminders'};
async function mapIncoming(repository,archive,selection){
  const source=archive.sourceWorkspaceId,prefix=source===repository.getWorkspaceId()||source.startsWith('legacy:')?'':`import-${(await hashBlob(new Blob([source]))).slice(0,16)}-`;
  const mapped=(kind,id)=>id==null?null:`${prefix}${prefix?kind+'-':''}${id}`;
  const snapshot=clone(archive.snapshot),all=new Map(snapshot.pets.map(p=>[p.id,p])),records=new Map(snapshot.records.map(r=>[r.id,r])),reminders=new Map(snapshot.reminders.map(r=>[r.id,r])),assets=new Map(archive.assets.map(a=>[a.metadata.id,a]));
  const selectAll=selection==null,chosen={pet:new Set(selectAll?snapshot.pets.map(p=>p.id):selection.petIds??[]),record:new Set(selectAll?snapshot.records.map(r=>r.id):selection.recordIds??[]),reminder:new Set(selectAll?snapshot.reminders.map(r=>r.id):selection.reminderIds??[]),asset:new Set(selectAll?assets.keys():selection.assetIds??[])},dependencies=[];
  const add=(kind,id)=>{if(id&&!chosen[kind].has(id)){chosen[kind].add(id);dependencies.push({kind,id});}};
  for(const id of chosen.reminder){const r=reminders.get(id);if(!r)throw new Error('所选事项不存在');add('pet',r.petId);if(r.originRecordId&&records.has(r.originRecordId))add('record',r.originRecordId);if(r.completionRecordId)add('record',r.completionRecordId);}
  for(const id of chosen.record){const r=records.get(id);if(!r)throw new Error('所选记录不存在');add('pet',r.petId);}
  for(const id of chosen.asset){const a=assets.get(id);if(!a)throw new Error('所选照片不存在');add('pet',a.metadata.petId);}
  for(const id of chosen.pet){const p=all.get(id);if(!p)throw new Error('所选宠物不存在');if(p.avatarAssetId)add('asset',p.avatarAssetId);}
  snapshot.pets=snapshot.pets.filter(p=>chosen.pet.has(p.id)).map(p=>({...p,id:mapped('pet',p.id),avatarAssetId:mapped('asset',p.avatarAssetId)}));
  snapshot.records=snapshot.records.filter(r=>chosen.record.has(r.id)).map(r=>({...r,id:mapped('record',r.id),petId:mapped('pet',r.petId)}));
  snapshot.reminders=snapshot.reminders.filter(r=>chosen.reminder.has(r.id)).map(r=>({...r,id:mapped('reminder',r.id),petId:mapped('pet',r.petId),originRecordId:r.originRecordId&&records.has(r.originRecordId)?mapped('record',r.originRecordId):r.originRecordId,completionRecordId:mapped('record',r.completionRecordId)}));
  snapshot.activePetId=snapshot.pets.some(p=>p.id===mapped('pet',archive.snapshot.activePetId)&&p.deletedAt===null)?mapped('pet',archive.snapshot.activePetId):snapshot.pets.find(p=>p.deletedAt===null)?.id??null;
  return {snapshot:validateSnapshot(snapshot),assets:archive.assets.filter(a=>chosen.asset.has(a.metadata.id)).map(a=>({...a,metadata:{...a.metadata,id:mapped('asset',a.metadata.id),petId:mapped('pet',a.metadata.petId)}})),dependencies};
}
export async function previewArchiveImport({repository,archive,selection}={}){
  const checked=await validateArchive(archive),current=await repository.snapshot(),baseRevision=repository.getRevision(),incoming=await mapIncoming(repository,checked,selection),existingAssets=await repository.media.listAll(),conflicts=[],newPets=[],newRecords=[],newReminders=[],newAssets=[];
  for(const [kind,field]of Object.entries(fields)){const existing=new Map(current[field].map(item=>[item.id,item]));for(const item of incoming.snapshot[field]){const old=existing.get(item.id);if(old&&kind!=='pet'&&old.petId!==item.petId)throw new Error('资料宠物归属冲突');if(!old)({pet:newPets,record:newRecords,reminder:newReminders})[kind].push(item);else if(!same(old,item))conflicts.push({kind,id:item.id,current:old,incoming:item,effect:old.deletedAt!==item.deletedAt?item.deletedAt===null?'restore':'trash':'update'});}}
  const existing=new Map(existingAssets.map(a=>[a.id,a]));for(const asset of incoming.assets){const old=existing.get(asset.metadata.id);if(old&&(old.petId!==asset.metadata.petId||old.kind!==asset.metadata.kind))throw new Error('照片宠物归属或用途冲突');if(!old)newAssets.push(asset.metadata);else if(!same(clean(old),asset.metadata))conflicts.push({kind:'asset',id:asset.metadata.id,current:clean(old),incoming:asset.metadata,effect:'update'});}
  return {archive:checked,selection:clone(selection),sourceWorkspaceId:checked.sourceWorkspaceId,baseRevision,incoming,conflicts,newPets,newRecords,newReminders,newAssets,dependencies:incoming.dependencies};
}
export async function commitArchiveImport({repository,preview,acceptedConflictIds=[]}={}){
  if(!repository?._archiveCommit)throw new Error('云端导入须走受身份保护的确认接口');
  if(!Array.isArray(acceptedConflictIds)||acceptedConflictIds.some(id=>typeof id!=='string'))throw new Error('请按预览逐项确认冲突');
  const latest=await previewArchiveImport({repository,archive:preview.archive,selection:preview.selection});if(latest.baseRevision!==preview.baseRevision){const error=new Error('预览后资料已更新，请重新预览');error.code='CONFLICT';throw error;}
  const allowed=new Set(latest.conflicts.map(c=>`${c.kind}:${c.id}`));for(const id of acceptedConflictIds)if(!allowed.has(id))throw new Error('确认项不属于当前预览');const accepted=new Set(acceptedConflictIds);
  return repository._archiveCommit(ctx=>{const next=ctx.envelope.snapshot;for(const [kind,field]of Object.entries(fields)){const newItems=latest[{pet:'newPets',record:'newRecords',reminder:'newReminders'}[kind]];const changes=new Map(latest.conflicts.filter(c=>c.kind===kind&&accepted.has(`${kind}:${c.id}`)).map(c=>[c.id,c.incoming]));next[field]=next[field].map(item=>changes.get(item.id)??item).concat(clone(newItems));}
    for(const conflict of latest.conflicts)if(accepted.has(`${conflict.kind}:${conflict.id}`)){if(conflict.effect==='restore'&&['record','reminder'].includes(conflict.kind)&&next.pets.find(p=>p.id===conflict.incoming.petId)?.deletedAt!==null)throw new Error('请一起确认恢复所属宠物');if(conflict.kind==='record'&&conflict.effect==='trash')for(const reminder of next.reminders)if(reminder.originRecordId===conflict.id&&reminder.status==='pending')reminder.status='cancelled';}
    for(const asset of latest.incoming.assets){const id=asset.metadata.id,exists=ctx.media.has(id);if(exists&&!accepted.has(`asset:${id}`))continue;ctx.media.set(id,{...asset.metadata,fileRef:id});ctx.blobs.set(id,asset.blob);}
    if([...ctx.blobs.values()].reduce((n,b)=>n+b.size,0)>repository._mediaOptions.mediaMaxBytes)throw new Error('照片总容量超过空间配额');
    if(latest.selection?.profile===true)next.profile.city=latest.incoming.snapshot.profile.city;
    if(!next.pets.some(p=>p.id===next.activePetId&&p.deletedAt===null))next.activePetId=next.pets.find(p=>p.deletedAt===null)?.id??null;
    for(const pet of next.pets)if(pet.avatarAssetId){const a=ctx.media.get(pet.avatarAssetId);if(!a||a.petId!==pet.id||a.kind!=='avatar')throw new Error('头像照片关联缺失');}
    return validateSnapshot(next);
  },preview.baseRevision);
}

// Explicit whole-archive recovery is separate from healthy-storage merge/import.
const archiveFingerprint=archive=>hashBlob(new Blob([JSON.stringify({format:archive.format,formatVersion:archive.formatVersion,archiveId:archive.archiveId,sourceWorkspaceId:archive.sourceWorkspaceId,exportedAt:archive.exportedAt,snapshot:archive.snapshot,assets:archive.assets.map(({metadata,base64})=>({metadata,base64}))})]));
export async function previewCorruptArchiveRestore({repository,archive}={}){
  if(!repository?._corruptArchiveRead)throw new Error('损坏资料恢复只支持个人本地仓储');
  const checked=await validateArchive(archive),source=await repository._corruptArchiveRead(),rawBackup=JSON.stringify(source.envelope.snapshot);
  const revision=source.envelope.revision;if(!Number.isSafeInteger(revision)||revision<0)throw new Error('损坏资料版本无效，请先导出原始备份');
  const incoming={snapshot:clone(checked.snapshot),assets:checked.assets,dependencies:[]},potentialRestorations=[];
  // Partial markers are advisory only; recovery deliberately uses the confirmed archive state.
  const original=source.envelope.snapshot;
  if(original&&typeof original==='object')for(const [kind,field]of Object.entries(fields)){
    const old=Array.isArray(original[field])?new Map(original[field].filter(item=>item&&typeof item.id==='string').map(item=>[item.id,item])):new Map();
    for(const item of checked.snapshot[field])if(item.deletedAt===null&&old.get(item.id)?.deletedAt!=null)potentialRestorations.push({kind,id:item.id,deletedAt:old.get(item.id).deletedAt});
  }
  return {mode:'corrupt-restore',archive:checked,archiveFingerprint:await archiveFingerprint(checked),sourceWorkspaceId:checked.sourceWorkspaceId,baseRevision:revision,rawBackup,recoveryReference:{workspaceId:source.envelope.workspaceId,baseRevision:revision,sourceFingerprint:source.sourceFingerprint},incoming,conflicts:[],newPets:clone(checked.snapshot.pets),newRecords:clone(checked.snapshot.records),newReminders:clone(checked.snapshot.reminders),newAssets:checked.assets.map(a=>clone(a.metadata)),dependencies:[],potentialRestorations};
}
export async function commitCorruptArchiveRestore({repository,preview}={}){
  if(!repository?._corruptArchiveCommit||preview?.mode!=='corrupt-restore')throw new Error('请先预览损坏资料恢复');
  const checked=await validateArchive(preview.archive);
  if(await archiveFingerprint(checked)!==preview.archiveFingerprint)throw new Error('备份预览已改变，请重新预览');
  if(!preview.recoveryReference||preview.baseRevision!==preview.recoveryReference.baseRevision)throw new Error('恢复预览引用无效');
  return repository._corruptArchiveCommit(ctx=>{
    if(checked.assets.reduce((n,a)=>n+a.blob.size,0)>repository._mediaOptions.mediaMaxBytes)throw new Error('照片总容量超过空间配额');
    // Keep the complete corrupt source in the same IDB transaction before replacing anything.
    const recovery={savedAt:repository._mediaOptions.clock(),raw:JSON.stringify(ctx.envelope.snapshot),envelope:clone(ctx.envelope),media:clone(ctx.media),blobs:clone(ctx.blobs)};
    if(!Array.isArray(ctx.envelope.recoveryArchives))ctx.envelope.recoveryArchives=[];ctx.envelope.recoveryArchives.push(recovery);
    ctx.envelope.snapshot=clone(checked.snapshot);ctx.envelope.receipts={};ctx.envelope.importMaps={};
    ctx.media.clear();ctx.blobs.clear();
    for(const asset of checked.assets){const id=asset.metadata.id;ctx.media.set(id,{...asset.metadata,fileRef:id});ctx.blobs.set(id,asset.blob);}
    return clone(ctx.envelope.snapshot);
  },preview.recoveryReference);
}
