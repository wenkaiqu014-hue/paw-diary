'use strict';
class AiError extends Error{constructor(code){super(code);this.code=code;}}
function createTextModel({fetchImpl=globalThis.fetch,baseUrl='https://api.siliconflow.cn/v1',apiKey,model,timeoutMs=25000}={}){
 return{async complete({messages,maxTokens=1200,responseFormat={type:'json_object'}}={}){
  if(!apiKey||!model)throw new AiError('UNAVAILABLE');
  if(!Array.isArray(messages)||!messages.length||Buffer.byteLength(JSON.stringify(messages))>24*1024||!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>1200)throw new AiError('INVALID_INPUT');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const response=await fetchImpl(baseUrl+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},signal:controller.signal,body:JSON.stringify({model,messages,max_tokens:maxTokens,stream:false,temperature:0.2,response_format:responseFormat})});
   if(!response.ok)throw new AiError(response.status===429?'RATE_LIMITED':'UNAVAILABLE');
   const result=await response.json(),content=result?.choices?.[0]?.message?.content;
   if(typeof content!=='string'||!content.trim()||content.length>12000)throw new AiError('INVALID_MODEL_OUTPUT');
   return{content,usage:{promptTokens:Number(result.usage?.prompt_tokens)||0,completionTokens:Number(result.usage?.completion_tokens)||0}};
  }catch(error){if(controller.signal.aborted)throw new AiError('TIMEOUT');if(error instanceof AiError)throw error;throw new AiError('UNAVAILABLE');}finally{clearTimeout(timer);}
 }};
}
function parseJson(content){try{const data=JSON.parse(content);if(!data||typeof data!=='object'||Array.isArray(data))throw 0;return data;}catch{throw new AiError('INVALID_MODEL_OUTPUT');}}
module.exports={createTextModel,AiError,parseJson};
