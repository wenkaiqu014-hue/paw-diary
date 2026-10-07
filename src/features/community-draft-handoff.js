const failure=code=>Object.assign(new Error(code),{code});
const fields=new Set(['kind','postId','id','title','text','topic','cityId','districtId','imageAssetId','imageFile','operationId','baseRevision']);
function safeDraft(draft,ownerId){
 if(!draft||typeof draft!=='object'||Array.isArray(draft)||Object.keys(draft).some(k=>!fields.has(k)))throw failure('INVALID_INPUT');
 for(const name of ['title','text','topic','operationId','id','postId','cityId','districtId','imageAssetId'])if(draft[name]!==undefined&&draft[name]!==null&&typeof draft[name]!=='string')throw failure('INVALID_INPUT');
 if(draft.kind!==undefined&&!['post','comment'].includes(draft.kind)||draft.title?.length>60||draft.text?.length>1500||draft.operationId?.length>128)throw failure('INVALID_INPUT');
 if(!ownerId&&(draft.imageAssetId||draft.id))throw failure('INVALID_INPUT');
 if(draft.imageFile!==undefined&&draft.imageFile!==null&&(!(draft.imageFile instanceof Blob)||draft.imageFile.size>10*1024*1024))throw failure('INVALID_INPUT');
 return {...structuredClone(Object.fromEntries(Object.entries(draft).filter(([key])=>key!=='imageFile'))),...(draft.imageFile?{imageFile:draft.imageFile}:{})};
}
export function createDraftHandoff({clock=Date.now,idFactory=()=>crypto.randomUUID(),ttlMs=30*60*1000}={}){
 let pending=null;
 const now=()=>Number(new Date(clock()));
 const current=()=>{if(pending&&pending.expiresAt<=now())pending=null;return pending;};
 return {
  stage({draft,ownerId=null,intent}={}){if(!['login','profile'].includes(intent)||ownerId!==null&&(typeof ownerId!=='string'||!ownerId)||intent==='profile'&&!ownerId)throw failure('INVALID_INPUT');const value=safeDraft(draft,ownerId),id=idFactory();pending={id,draft:value,ownerId,intent,expiresAt:now()+ttlMs};return id;},
  bindLoginOwner(ownerId){const value=current();if(!value)return false;if(typeof ownerId!=='string'||!ownerId||value.intent!=='login'||value.ownerId&&value.ownerId!==ownerId)throw failure('IDENTITY_CHANGED');value.ownerId=ownerId;return true;},
  consume(ownerId){const value=current();if(!value||!ownerId||value.ownerId!==ownerId)return null;pending=null;return safeDraft(value.draft,ownerId);},
  clear(){pending=null;},
 };
}
export const createCommunityDraftHandoff=createDraftHandoff;
