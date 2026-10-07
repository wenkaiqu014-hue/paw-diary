import {clone} from './domain/schema.js?v=0.2.0';
function stale(){const error=new Error('空间已切换，请返回当前空间后重试。');error.code='WORKSPACE_CHANGED';error.messageKey='errors.workspace.changed';return error;}
export function createAppSession(initialRepository) {
 let repository=initialRepository,visible=null,queue=Promise.resolve(),error=null,generation=0,mode=null,principal=null;
 const pending=new Map();
 function enqueue(operation,{refresh=false}={}){
  const captured=generation,currentRepository=repository;pending.set(captured,(pending.get(captured)??0)+1);
  const result=queue.then(async()=>{
   try{
    if(captured!==generation)throw stale();
    const output=await operation(currentRepository);
    if(captured!==generation)throw stale();
    const next=await (refresh&&currentRepository.refresh?currentRepository.refresh():currentRepository.snapshot());
    if(captured!==generation)throw stale();visible=next;mode=next?.mode??mode;error=null;return output;
   }catch(failure){if(captured===generation)error=failure;throw failure;}
   finally{pending.set(captured,Math.max(0,(pending.get(captured)??1)-1));}
  });
  queue=result.catch(()=>{});return result;
 }
 return {
  load:()=>enqueue(async()=>{}),snapshot:()=>clone(visible),run:operation=>enqueue(operation),refresh:()=>enqueue(async()=>{},{refresh:true}),
  async switchWorkspace({mode:nextMode,repository:nextRepository,principal:nextPrincipal=null}){
   if(!['demo','local','account'].includes(nextMode)||!nextRepository)throw new Error('空间配置无效');
   if(nextMode==='account'&&!nextPrincipal?.userId)throw new Error('请先完成邮箱登录');
   generation++;repository=nextRepository;mode=nextMode;principal=nextPrincipal;visible=null;error=null;queue=Promise.resolve();
   return enqueue(async()=>{});
  },
  get loading(){return (pending.get(generation)??0)>0;},get error(){return error;},get generation(){return generation;},get mode(){return mode;},get principal(){return principal?{userId:principal.userId}:null;},get repository(){return repository;}
 };
}
