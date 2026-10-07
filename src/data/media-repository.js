import {inspectImageBlob,MAX_DISPLAY_BYTES} from '../media/process-image.js';
import {storageError} from './indexeddb-store.js';
import {hashBlob} from '../domain/archive.js';
function visiblePet(snapshot,petId){const pet=snapshot.pets.find(p=>p.id===petId);if(!pet||pet.deletedAt!==null)throw storageError('INVALID_INPUT','宠物不存在或已在回收站');return pet;}
const sorted=assets=>assets.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
export function createMediaRepository({repository}={}){
  if(!repository?._mediaRead||!repository?._mediaWrite)throw new Error('媒体仓储需要支持事务的本地仓储');
  const {clock,idFactory,mediaMaxBytes}=repository._mediaOptions;
  async function read(assetId,{includeDeleted=false}={}){return repository._mediaRead(({envelope,media,blobs})=>{const metadata=media.get(assetId);if(!metadata)throw storageError('INVALID_INPUT','照片不存在');if(!includeDeleted){visiblePet(envelope.snapshot,metadata.petId);if(metadata.kind==='attachment'){const item=envelope.snapshot[metadata.parentKind==='record'?'records':'reminders'].find(x=>x.id===metadata.parentId);if(!item||item.deletedAt!==null)throw storageError('INVALID_INPUT','附件所属记录已在回收站');}}const blob=blobs.get(metadata.fileRef);if(!(blob instanceof Blob))throw storageError('UNAVAILABLE','照片文件缺失');return {metadata:structuredClone(metadata),blob};});}
  return {
    list:({petId,cursor,limit=20,kind='photo'}={})=>repository._mediaRead(({envelope,media})=>{if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('照片分页数量无效');const pet=envelope.snapshot.pets.find(p=>p.id===petId);if(!pet||pet.deletedAt!==null)return {items:[],nextCursor:null};const assets=sorted([...media.values()].filter(a=>a.petId===petId&&a.kind===kind));const start=cursor?assets.findIndex(a=>a.id===cursor)+1:0;if(cursor&&start===0)throw new Error('照片分页位置无效');const items=assets.slice(start,start+limit);return {items:structuredClone(items),nextCursor:start+limit<assets.length?items.at(-1).id:null};}),
    listAll:()=>repository._mediaRead(({media})=>structuredClone(sorted([...media.values()]))),read,
    save:async({petId,kind='photo',blob,caption='',displayName,baseRevision,operationId}={},options={})=>{
      baseRevision=options.baseRevision??baseRevision;operationId=options.operationId??operationId;
      displayName=displayName??(kind==='photo'&&typeof blob?.name==='string'?blob.name.trim().slice(0,60)||undefined:undefined);
      if(displayName!==undefined&&(kind!=='photo'||typeof displayName!=='string'||!displayName.trim()||displayName.trim().length>60))throw storageError('INVALID_INPUT','照片名称需为1到60字');if(displayName!==undefined)displayName=displayName.trim();
      if(!['avatar','photo'].includes(kind)||typeof caption!=='string'||caption.length>200)throw storageError('INVALID_INPUT','照片用途或说明无效');
      await inspectImageBlob(blob,{maxBytes:MAX_DISPLAY_BYTES});const sha256=await hashBlob(blob),signature=JSON.stringify({petId,kind,caption,displayName,sha256});
      if(operationId){const receipt=await repository._mediaRead(({envelope})=>envelope.receipts?.[operationId]);if(receipt){if(receipt.signature!==signature)throw storageError('INVALID_INPUT','同一操作标识对应不同内容');return structuredClone(receipt.result);}}
      return repository._mediaWrite(ctx=>{
        const pet=visiblePet(ctx.envelope.snapshot,petId);
        ctx.envelope.receipts??={};const receipt=operationId&&ctx.envelope.receipts[operationId];if(receipt){if(receipt.signature!==signature)throw storageError('INVALID_INPUT','同一操作标识对应不同内容');ctx.unchanged=true;return receipt.result;}
        const previous=kind==='avatar'&&pet.avatarAssetId?ctx.media.get(pet.avatarAssetId):null;
        const total=[...ctx.blobs.values()].reduce((n,b)=>n+b.size,0)-(previous?ctx.blobs.get(previous.fileRef)?.size??0:0);
        if(total+blob.size>mediaMaxBytes)throw storageError('QUOTA_EXCEEDED','照片总容量超过空间配额');
        const id=idFactory();if(ctx.media.has(id)||ctx.blobs.has(id))throw new Error('照片标识重复');
        const metadata={id,petId,kind,caption,...(displayName!==undefined?{displayName}:{}),createdAt:clock(),mime:blob.type,bytes:blob.size,sha256,fileRef:id};ctx.media.set(id,metadata);ctx.blobs.set(id,blob);
        if(kind==='avatar'){pet.avatarAssetId=id;if(previous){ctx.media.delete(previous.id);ctx.blobs.delete(previous.fileRef);}}
        if(operationId)ctx.envelope.receipts[operationId]={signature,result:metadata};return metadata;
      },{baseRevision,idempotency:operationId?{operationId,signature}:undefined});
    },
    rename:async({assetId,displayName,baseRevision,operationId}={},options={})=>{
      baseRevision=options.baseRevision??baseRevision;operationId=options.operationId??operationId;
      if(typeof displayName!=='string'||!displayName.trim()||displayName.trim().length>60)throw storageError('INVALID_INPUT','照片名称需为1到60字');displayName=displayName.trim();
      const signature=JSON.stringify({action:'rename',assetId,displayName});
      if(operationId){const prior=await repository._mediaRead(({envelope})=>envelope.receipts?.[operationId]);if(prior){if(prior.signature!==signature)throw storageError('INVALID_INPUT','同一操作标识对应不同内容');return structuredClone(prior.result);}}
      return repository._mediaWrite(ctx=>{const asset=ctx.media.get(assetId);if(!asset||asset.kind!=='photo')throw storageError('INVALID_INPUT','只能重命名照片');visiblePet(ctx.envelope.snapshot,asset.petId);asset.displayName=displayName;ctx.media.set(assetId,asset);if(operationId){ctx.envelope.receipts??={};ctx.envelope.receipts[operationId]={signature,result:asset};}return asset;},{baseRevision,idempotency:operationId?{operationId,signature}:undefined});
    },
    remove:async({assetId,baseRevision,operationId}={},options={})=>{
      baseRevision=options.baseRevision??baseRevision;operationId=options.operationId??operationId;
      const signature=JSON.stringify({action:'remove',assetId});
      if(operationId){const receipt=await repository._mediaRead(({envelope})=>envelope.receipts?.[operationId]);if(receipt){if(receipt.signature!==signature)throw storageError('INVALID_INPUT','同一操作标识对应不同内容');return;}}
      await repository._mediaWrite(ctx=>{const asset=ctx.media.get(assetId);if(!asset)throw storageError('INVALID_INPUT','照片不存在');const pet=visiblePet(ctx.envelope.snapshot,asset.petId);if(asset.kind==='attachment'){const item=ctx.envelope.snapshot[asset.parentKind==='record'?'records':'reminders'].find(x=>x.id===asset.parentId);if(!item||item.deletedAt!==null)throw storageError('INVALID_INPUT','附件所属记录已在回收站');}ctx.media.delete(assetId);ctx.blobs.delete(asset.fileRef);if(pet.avatarAssetId===assetId)pet.avatarAssetId=null;if(operationId){ctx.envelope.receipts??={};ctx.envelope.receipts[operationId]={signature,result:null};}},{baseRevision,idempotency:operationId?{operationId,signature}:undefined});
    },
    resolveUrl:async assetId=>{const {blob}=await read(assetId);const url=URL.createObjectURL(blob);let released=false;return {url,release(){if(!released){URL.revokeObjectURL(url);released=true;}}};}
  };
}
