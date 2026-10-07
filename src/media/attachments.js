import {storageError} from '../data/indexeddb-store.js';
export const MAX_ATTACHMENT_BYTES=5*1024*1024;
export const MAX_ATTACHMENTS=3;
export const ATTACHMENT_MIMES=['image/jpeg','image/png','image/webp','application/pdf'];
const invalid=message=>storageError('INVALID_INPUT',message??'附件格式无效');
export async function inspectAttachmentBlob(blob){
 if(!(blob instanceof Blob)||!ATTACHMENT_MIMES.includes(blob.type)||blob.size<=0||blob.size>MAX_ATTACHMENT_BYTES)throw invalid('附件仅支持图片、PDF，单个不超过5MiB');
 const bytes=new Uint8Array(await blob.slice(0,40).arrayBuffer()),ascii=new TextDecoder().decode(bytes);let mime;
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))mime='image/png';
 else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
 else if(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')mime='image/webp';
 else if(ascii.startsWith('%PDF-')&&/%%EOF\s*$/.test(await blob.slice(-1024).text()))mime='application/pdf';
 if(mime!==blob.type)throw invalid('附件内容与文件类型不一致');return blob;
}
async function digest(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function parent(snapshot,input,includeDeleted=false){if(!['record','reminder'].includes(input.parentKind))throw invalid();const pet=snapshot.pets.find(x=>x.id===input.petId),item=snapshot[input.parentKind==='record'?'records':'reminders'].find(x=>x.id===input.parentId);if(!pet||!item||item.petId!==pet.id||(!includeDeleted&&(pet.deletedAt!==null||item.deletedAt!==null)))throw invalid('附件所属记录不存在或已在回收站');return item;}
export function createAttachmentRepository({repository}={}){
 const {clock,idFactory,mediaMaxBytes}=repository._mediaOptions;
 return {
 list:input=>repository._mediaRead(({envelope,media})=>{try{parent(envelope.snapshot,input);}catch{return {items:[],nextCursor:null};}return {items:structuredClone([...media.values()].filter(a=>a.kind==='attachment'&&a.petId===input.petId&&a.parentKind===input.parentKind&&a.parentId===input.parentId)),nextCursor:null};}),
 listAll:()=>repository._mediaRead(({media})=>structuredClone([...media.values()].filter(a=>a.kind==='attachment'))),
 read:(id,{includeDeleted=false}={})=>repository._mediaRead(({envelope,media,blobs})=>{const metadata=media.get(id);if(!metadata||metadata.kind!=='attachment')throw invalid('附件不存在');parent(envelope.snapshot,metadata,includeDeleted);const blob=blobs.get(metadata.fileRef);if(!(blob instanceof Blob))throw invalid('附件文件缺失');return {metadata:structuredClone(metadata),blob};}),
 async save({petId,parentKind,parentId,blob,filename='',operationId,baseRevision}={},options={}){
  await inspectAttachmentBlob(blob);if(typeof filename!=='string'||filename.length>200)throw invalid('附件名称过长');operationId=options.operationId??operationId;baseRevision=options.baseRevision??baseRevision;const sha256=await digest(blob),signature=JSON.stringify({petId,parentKind,parentId,filename,sha256});
  return repository._mediaWrite(ctx=>{parent(ctx.envelope.snapshot,{petId,parentKind,parentId});ctx.envelope.receipts??={};const prior=operationId&&ctx.envelope.receipts[operationId];if(prior){if(prior.signature!==signature)throw invalid();ctx.unchanged=true;return prior.result;}if([...ctx.media.values()].filter(a=>a.kind==='attachment'&&a.parentKind===parentKind&&a.parentId===parentId).length>=3)throw invalid('每项最多三个附件');if([...ctx.blobs.values()].reduce((n,b)=>n+b.size,0)+blob.size>mediaMaxBytes)throw storageError('QUOTA_EXCEEDED','附件与照片总容量超过配额');const id=idFactory();if(ctx.media.has(id))throw invalid();const metadata={id,petId,kind:'attachment',parentKind,parentId,filename,caption:'',createdAt:clock(),mime:blob.type,bytes:blob.size,sha256,fileRef:id};ctx.media.set(id,metadata);ctx.blobs.set(id,blob);if(operationId)ctx.envelope.receipts[operationId]={signature,result:metadata};return metadata;},{baseRevision,idempotency:operationId?{operationId,signature}:undefined});
 },
 remove:({assetId,...options})=>repository.media.remove({assetId,...options}),
 async resolveUrl(id){const {blob}=await this.read(id),url=URL.createObjectURL(blob);return {url,release:()=>URL.revokeObjectURL(url)};}
 };
}
