import {clone} from './domain/schema.js?v=0.2.0';
export function createAppSession(repository) {
  let visible=null,queue=Promise.resolve(),loading=false,error=null,pending=0;
  function enqueue(operation){pending++;loading=true;const result=queue.then(async()=>{try{const output=await operation();visible=await repository.snapshot();error=null;return output;}catch(failure){error=failure;throw failure;}finally{pending--;loading=pending>0;}});queue=result.catch(()=>{});return result;}
  return {load:()=>enqueue(async()=>{}),snapshot:()=>clone(visible),run:operation=>enqueue(()=>operation(repository)),get loading(){return loading;},get error(){return error;}};
}
