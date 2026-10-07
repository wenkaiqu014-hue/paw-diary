import {processImage} from './process-image.js';
const failure=code=>Object.assign(new Error(code),{code});
const sha256=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function prepareCommunityImage(blob,{kind='post',...options}={}){
 if(!['avatar','post'].includes(kind))throw failure('INVALID_INPUT');
 if(blob?.type==='image/webp'){
  // Decode WebP locally and emit PNG; the public server never accepts undecoded WebP bytes.
  const makeCanvas=options.createCanvas??((width,height)=>{if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(width,height);if(!globalThis.document)throw failure('UNAVAILABLE');const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;});
  options.createCanvas=(width,height)=>{const canvas=makeCanvas(width,height);return {getContext:canvas.getContext.bind(canvas),...(canvas.convertToBlob?{convertToBlob:opts=>canvas.convertToBlob({...opts,type:'image/png'})}:{toBlob:(callback)=>canvas.toBlob(callback,'image/png')})};};
 }
 const image=await processImage(blob,{...options,kind:kind==='post'?'photo':'avatar'}),bytes=new Uint8Array(await image.blob.arrayBuffer());
 let binary='';for(let at=0;at<bytes.length;at+=32768)binary+=String.fromCharCode(...bytes.subarray(at,at+32768));
 return {metadata:{kind,mime:image.mime,bytes:image.bytes,width:image.width,height:image.height,sha256:await sha256(bytes)},bytesBase64:btoa(binary)};
}
async function validateReply(reply){
 if(!reply||typeof reply.dataUrl!=='string'||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(reply.dataUrl)||reply.dataUrl.length>1398200||!/[a-f0-9]{64}/.test(reply.sha256))throw failure('INVALID_INPUT');
 const encoded=reply.dataUrl.slice(reply.dataUrl.indexOf(',')+1);let raw;try{raw=atob(encoded);}catch{throw failure('INVALID_INPUT');}if(raw.length>1048576||!raw.length)throw failure('INVALID_INPUT');const bytes=Uint8Array.from(raw,x=>x.charCodeAt(0));if(await sha256(bytes)!==reply.sha256)throw failure('INVALID_INPUT');return reply;
}
export function createCommunityImageLoader({read,concurrency=3}={}){
 if(typeof read!=='function'||!Number.isInteger(concurrency)||concurrency<1||concurrency>3)throw failure('INVALID_INPUT');
 let generation=0,running=0;const queue=[],pending=new Map();
 function pump(){while(running<concurrency&&queue.length){const task=queue.shift();if(task.generation!==generation){task.reject(failure('STALE_CONTEXT'));continue;}running++;
  Promise.resolve().then(()=>read({assetId:task.assetId,reference:task.reference})).then(validateReply).then(reply=>{if(task.generation!==generation)throw failure('STALE_CONTEXT');task.resolve(reply);},task.reject).catch(task.reject).finally(()=>{running--;if(pending.get(task.key)===task.promise)pending.delete(task.key);pump();});
 }}
 return {
  load(assetId,reference){if(typeof assetId!=='string'||!reference||!['post','comment','profile'].includes(reference.kind)||typeof reference.id!=='string')return Promise.reject(failure('INVALID_INPUT'));const key=JSON.stringify([assetId,reference.kind,reference.id]);if(pending.has(key))return pending.get(key);let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});pending.set(key,promise);queue.push({key,assetId,reference:{...reference},generation,promise,resolve,reject});pump();return promise;},
  reset(){generation++;pending.clear();for(const task of queue.splice(0))task.reject(failure('STALE_CONTEXT'));},
  // The UI can observe visible nodes without starting requests for offscreen images.
  observe(element,{assetId,reference,onLoad,onError}={}){let active=true;const start=()=>{if(!active)return;this.load(assetId,reference).then(r=>{if(active)onLoad?.(r);},e=>{if(active)onError?.(e);});};if(typeof IntersectionObserver==='undefined'){start();return ()=>{active=false;};}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();start();}},{rootMargin:'120px'});observer.observe(element);return ()=>{active=false;observer.disconnect();};}
 };
}
