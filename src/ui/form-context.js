const id=()=>globalThis.crypto?.randomUUID?.()??`form-${Date.now()}-${Math.random()}`;
export function captureFormContext({repository,getGeneration,petId,entityId=null}={}){return {generation:getGeneration(),petId,entityId,baseRevision:repository.getRevision?.()??0,operationId:id(),intent:null};}
const writeArgs=new Map([['savePet',1],['saveRecord',1],['saveRecordBatch',1],['saveOnboarding',1],['saveRecap',1],['saveReminder',1],['completeReminder',2],['moveToTrash',1],['restoreFromTrash',1],['reorderPets',1],['deleteRecord',1],['saveProfile',1]]);
export function bindFormRepository(repository,context,getGeneration){return new Proxy(repository,{get(target,name){const fn=target[name];if(typeof fn!=='function')return fn;if(!writeArgs.has(name))return fn.bind(target);return (...args)=>{
 if(context.generation!==getGeneration())return Promise.reject(Object.assign(new Error('空间已切换，请重新打开表单。'),{code:'WORKSPACE_CHANGED',messageKey:'errors.workspace.changed'}));
 const count=writeArgs.get(name),input=args.slice(0,count);
 if(['saveRecord','saveReminder'].includes(name)&&context.petId)input[0]={...input[0],petId:context.petId};
 const intent=JSON.stringify([name,input]);if(context.intent!==intent){context.operationId=id();context.intent=intent;}
 const options={...(args[count]??{}),baseRevision:context.baseRevision,operationId:context.operationId};
 return fn.apply(target,[...input,options]);
 };}});}
