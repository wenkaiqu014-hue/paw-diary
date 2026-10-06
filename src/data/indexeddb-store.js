const names=['workspace','media','blobs'];
export function storageError(code,message,cause){const error=new Error(message,{cause});error.code=code;return error;}
export function createIndexedDBStore({indexedDB=globalThis.indexedDB,dbName='paw-diary-personal'}={}){
  let pending;
  const open=()=>pending??=(new Promise((resolve,reject)=>{
    if(!indexedDB?.open)return reject(storageError('UNAVAILABLE','IndexedDB本地存储不可用'));
    const request=indexedDB.open(dbName,1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('workspace'))db.createObjectStore('workspace');if(!db.objectStoreNames.contains('media')){const store=db.createObjectStore('media',{keyPath:'id'});store.createIndex('petId','petId');}if(!db.objectStoreNames.contains('blobs'))db.createObjectStore('blobs');};
    request.onerror=()=>reject(storageError('UNAVAILABLE','本地存储打开失败',request.error));request.onblocked=()=>reject(storageError('UNAVAILABLE','本地存储升级被另一窗口阻止'));
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
  }));
  async function run(mode,expectedRevision,callback){const db=await open();return new Promise((resolve,reject)=>{
    let result,failure,context;const tx=db.transaction(names,mode);
    tx.onabort=()=>reject(failure??storageError(tx.error?.name==='QuotaExceededError'?'QUOTA_EXCEEDED':'UNAVAILABLE','本地存储事务未完成，资料未保存',tx.error));
    tx.onerror=()=>{};tx.oncomplete=()=>resolve(result);
    const workspace=tx.objectStore('workspace'),media=tx.objectStore('media'),blobs=tx.objectStore('blobs');
    const requests=[workspace.get('singleton'),media.getAll(),blobs.getAllKeys(),blobs.getAll()];let left=requests.length;
    const ready=()=>{if(--left)return;try{
      context={envelope:requests[0].result??null,media:new Map(requests[1].result.map(asset=>[asset.id,asset])),blobs:new Map(requests[2].result.map((id,i)=>[id,requests[3].result[i]])),transaction:tx};
      if(expectedRevision!==undefined&&context.envelope?.revision!==expectedRevision)throw storageError('CONFLICT','资料已在另一窗口更新，请刷新后重试');
      const oldMedia=new Map([...context.media].map(([id,asset])=>[id,JSON.stringify(asset)])),oldBlobs=new Map(context.blobs);
      result=callback(context);
      if(result&&typeof result.then==='function')throw new Error('事务内不能执行异步处理');
      if(mode==='readwrite'&&tx.readyState!=='done'){
        if(context.envelope)workspace.put(context.envelope,'singleton');
        for(const id of oldMedia.keys())if(!context.media.has(id))media.delete(id);
        for(const [id,asset]of context.media)if(oldMedia.get(id)!==JSON.stringify(asset))media.put(asset);
        for(const id of oldBlobs.keys())if(!context.blobs.has(id))blobs.delete(id);
        for(const [id,blob]of context.blobs)if(oldBlobs.get(id)!==blob)blobs.put(blob,id);
      }
    }catch(error){failure=error.name==='QuotaExceededError'?storageError('QUOTA_EXCEEDED','本地存储空间不足，资料未保存',error):error;try{tx.abort();}catch{reject(failure);}}};
    for(const request of requests)request.onsuccess=ready;
  });}
  return {
    initialize:envelope=>run('readwrite',undefined,ctx=>{if(!ctx.envelope)ctx.envelope=structuredClone(envelope);return structuredClone(ctx.envelope);}),
    read:()=>run('readonly',undefined,ctx=>({envelope:structuredClone(ctx.envelope),media:structuredClone(ctx.media),blobs:ctx.blobs})),
    transaction:(expectedRevision,callback)=>run('readwrite',expectedRevision,callback),
    close:async()=>{if(pending)(await pending).close();pending=undefined;}
  };
}
