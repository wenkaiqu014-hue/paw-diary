import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const load=()=>require('../backend/ai/provider.cjs');
test('text provider returns only answer and numeric usage',async()=>{
 const {createTextModel}=load();let body;
 const model=createTextModel({apiKey:'sentinel-secret',model:'free-model',fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:'{"ok":true}',reasoning_content:'never expose'}}],usage:{prompt_tokens:10,completion_tokens:5}})};}});
 const result=await model.complete({messages:[{role:'user',content:'test'}]});
 assert.equal(result.content,'{"ok":true}');assert.equal(result.usage.promptTokens,10);assert.equal(JSON.stringify(result).includes('never expose'),false);assert.equal(body.max_tokens,1200);assert.equal(body.stream,false);
});
test('429 is a bounded error without supplier detail or retry',async()=>{
 const {createTextModel}=load();let calls=0;
 const model=createTextModel({apiKey:'sentinel-secret',model:'free-model',fetchImpl:async()=>{calls++;return{ok:false,status:429,json:async()=>({message:'sentinel-secret'})};}});
 await assert.rejects(()=>model.complete({messages:[{role:'user',content:'test'}]}),e=>e.code==='RATE_LIMITED'&&!e.message.includes('sentinel'));assert.equal(calls,1);
});
test('empty body and timeout fail with explicit codes',async()=>{
 const {createTextModel}=load();
 await assert.rejects(()=>createTextModel({apiKey:'x',model:'m',fetchImpl:async()=>({ok:true,json:async()=>({choices:[]})})}).complete({messages:[{role:'user',content:'x'}]}),e=>e.code==='INVALID_MODEL_OUTPUT');
 await assert.rejects(()=>createTextModel({apiKey:'x',model:'m',timeoutMs:5,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort'))))}).complete({messages:[{role:'user',content:'x'}]}),e=>e.code==='TIMEOUT');
});
