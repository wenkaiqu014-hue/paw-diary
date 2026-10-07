const failure=code=>Object.assign(new Error(code),{code});
export function createAiClient({invoke,getScope,getAuthorization,visitorId,storage=globalThis.localStorage,timeoutMs=35000}={}){
  if(!visitorId){try{visitorId=storage?.getItem('paw-diary:ai-visitor');if(!visitorId){visitorId=crypto.randomUUID();storage?.setItem('paw-diary:ai-visitor',visitorId);}}catch{visitorId=crypto.randomUUID();}}
  const capture=()=>({...getScope()});
  const current=s=>{const n=getScope();return ['repository','generation','mode','workspaceId','petId','ownerId'].every(k=>s[k]===n[k]);};
  return {async request(action,payload={}){
    const scope=capture(),request={version:1,action,payload,requestId:crypto.randomUUID(),visitorId};
    if(scope.mode==='account'){
      const authorization=await getAuthorization?.();
      if(!current(scope))throw failure('WORKSPACE_CHANGED');
      if(!authorization?.authToken||authorization.principal?.userId!==scope.ownerId)throw failure('UNAUTHENTICATED');
      request.authToken=authorization.authToken;
    }
    let timer;
    try{
      const raw=await Promise.race([invoke(request),new Promise((_,reject)=>timer=setTimeout(()=>reject(failure('TIMEOUT')),timeoutMs))]);
      if(!current(scope))throw failure('WORKSPACE_CHANGED');
      let reply=raw?.result??raw;
      if(typeof reply==='string')reply=JSON.parse(reply);
      if(!reply?.ok)throw failure(reply?.error?.code??'UNAVAILABLE');
      return reply.data;
    }catch(error){if(!current(scope))throw failure('WORKSPACE_CHANGED');throw error?.code?error:failure('UNAVAILABLE');}
    finally{clearTimeout(timer);}
  }};
}
