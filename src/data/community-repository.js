const failure=(code,messageKey)=>Object.assign(new Error(code),{code,messageKey});
export function createCommunityRepository({invoke,getPrincipal,getGeneration,getAuthorization,timeoutMs=15000,uploadTimeoutMs=35000}={}){
 if(typeof invoke!=='function'||typeof getPrincipal!=='function'||typeof getGeneration!=='function')throw failure('UNAVAILABLE');let disposed=false;
 const capture=()=>({ownerId:getPrincipal()?.userId??null,generation:getGeneration()});
 const current=scope=>!disposed&&scope.ownerId===(getPrincipal()?.userId??null)&&scope.generation===getGeneration();
 return{async request(action,payload={},options={}){
   if(disposed)throw failure('IDENTITY_CHANGED');const scope=capture(),request={version:1,action,payload};if(options.operationId!==undefined)request.idempotencyKey=options.operationId;if(options.baseRevision!==undefined)request.expectedRevision=options.baseRevision;
   if(scope.ownerId){let authorization;try{authorization=await getAuthorization?.();}catch(error){if(!current(scope))throw failure('IDENTITY_CHANGED');throw error?.code?error:failure('UNAUTHENTICATED');}if(!current(scope))throw failure('IDENTITY_CHANGED');if(!authorization?.authToken||authorization.principal?.userId!==scope.ownerId)throw failure('UNAUTHENTICATED');request.authToken=authorization.authToken;}
   if(!current(scope))throw failure('IDENTITY_CHANGED');let timer;
   try{const raw=await Promise.race([invoke(request),new Promise((_,reject)=>timer=setTimeout(()=>reject(failure('TIMEOUT')),action==='community.media.confirm'?uploadTimeoutMs:timeoutMs))]);if(!current(scope))throw failure('IDENTITY_CHANGED');let reply=raw?.result??raw;if(typeof reply==='string')reply=JSON.parse(reply);if(!reply?.ok)throw failure(reply?.error?.code??'UNAVAILABLE',reply?.error?.messageKey);return reply.data;}
   catch(error){if(!current(scope))throw failure('IDENTITY_CHANGED');throw error?.code?error:failure('UNAVAILABLE');}finally{clearTimeout(timer);}
 },dispose(){disposed=true;}};
}
